import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { HumanMessage } from '@langchain/core/messages'
import { program } from 'commander'
import './proxy.js'
import { createLLM } from './llm.js'
import { runWithConcurrency } from './concurrency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, '../content')

program
  .requiredOption('--show <slug>', 'show slug')
  .option('--season <n>', 'season number (series only)', v => parseInt(v, 10))
  .option('--episode <n>', 'episode number (series only, requires --season)', v => parseInt(v, 10))
  .option('--strategy <list>', 'comma-separated strategies: freedict, llm, nothing', 'freedict')
  .option('--provider <name>', 'LLM provider (anthropic, openai)', 'openai')
  .option('--model <name>', 'model name', 'gpt-5.4-mini')
  .option('--chunk-size <n>', 'terms per LLM chunk', v => parseInt(v, 10), 20)
  .option('--parallel <n>', 'number of LLM chunks to process in parallel', v => parseInt(v, 10), 1)
  .parse()

function toSlug(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function slugToReadable(slug) {
  return slug.replace(/_/g, ' ')
}

function capitalize(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

const PERSIAN_CODE = 'fa'

async function defineFreeDict(slugs) {
  const results = await Promise.all(slugs.map(async slug => {
    const word = slugToReadable(slug)
    const url = `https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}?translations=true`

    let data
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      data = await res.json()
    } catch (err) {
      console.warn(`  [freedict] Error fetching "${word}": ${err.message}`)
      return null
    }

    if (!data || !data.entries || data.entries.length === 0) return null

    const entry = data.entries[0]

    const ipaEntry = entry.pronunciations?.find(p => p.type === 'IPA')
    const pronunciation = ipaEntry?.text || entry.pronunciations?.[0]?.text || ''

    const englishDefinitions = []
    const examples = []
    const synonyms = new Set(entry.synonyms || [])
    const antonyms = new Set(entry.antonyms || [])
    const persianTranslations = new Set()

    function processSense(sense) {
      if (sense.definition) englishDefinitions.push(sense.definition)
      for (const ex of sense.examples || []) examples.push(ex)
      for (const s of sense.synonyms || []) synonyms.add(s)
      for (const a of sense.antonyms || []) antonyms.add(a)
      for (const t of sense.translations || []) {
        if (t.language?.code === PERSIAN_CODE) persianTranslations.add(t.word)
      }
      for (const sub of sense.subsenses || []) processSense(sub)
    }

    for (const sense of entry.senses || []) processSense(sense)

    return {
      slug,
      term: data.word || slugToReadable(slug),
      categories: [],
      pronunciation,
      partOfSpeech: capitalize(entry.partOfSpeech || ''),
      englishDefinitions,
      persianTranslation: [...persianTranslations],
      examples,
      synonyms: [...synonyms],
      antonyms: [...antonyms],
    }
  }))

  return results.filter(Boolean)
}

async function defineLLM(slugs, llm) {
  const termList = slugs.map(s => `- slug: "${s}", term: "${slugToReadable(s)}"`).join('\n')
  const response = await llm.invoke([
    new HumanMessage(`You are a dictionary tool for English language learners. For each of the following vocabulary terms/phrases, provide a complete dictionary entry.

Return a JSON array where each item has these exact fields:
- "slug": the exact slug string provided (copy it verbatim)
- "term": display name (properly capitalized)
- "categories": array of one or more categories chosen from: "Idiom", "Slang", "Phrasal Verb", "Cultural Reference", "Academic", "Formal", "Informal", "Technical", "Colloquial"
- "difficultyLevel": string number 1-10 (1=easiest, 10=hardest) for English learners at intermediate level
- "pronunciation": IPA pronunciation string
- "partOfSpeech": e.g. "Noun", "Verb", "Idiomatic expression", "Phrasal verb", "Adjective", etc.
- "englishDefinitions": array of one or more English definition strings
- "persianTranslation": array of one or more Persian translation strings (Farsi/فارسی)
- "examples": array of exactly 3 natural example sentences
- "synonyms": array of synonym strings (empty array if none)
- "antonyms": array of antonym strings (empty array if none)

Terms to define:
${termList}

Return ONLY the JSON array, no other text.`),
  ])

  const raw = response.content.trim()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.error('--- RAW LLM RESPONSE ---')
    console.error(raw)
    console.error('--- END RAW LLM RESPONSE ---')
    throw new Error('LLM did not return a JSON array')
  }
  try {
    return JSON.parse(jsonMatch[0])
  } catch (err) {
    console.error('--- RAW LLM RESPONSE ---')
    console.error(raw)
    console.error('--- END RAW LLM RESPONSE ---')
    throw err
  }
}

async function runChunked(label, define, slugs, termsDir, opts) {
  const { chunkSize, parallel } = opts
  const chunks = []
  for (let i = 0; i < slugs.length; i += chunkSize) {
    chunks.push(slugs.slice(i, i + chunkSize))
  }

  const parallelLabel = parallel > 1 ? ` (${parallel} parallel)` : ''
  console.log(`[${label}] ${slugs.length} term(s), ${chunks.length} chunk(s) of up to ${chunkSize}${parallelLabel}...`)

  const counts = await runWithConcurrency(
    chunks.map((chunk, i) => async () => {
      console.log(`  Chunk ${i + 1}/${chunks.length} (${chunk.length} terms)...`)

      let definitions
      try {
        definitions = await define(chunk)
      } catch (err) {
        console.error(`  [${label}] Failed chunk ${i + 1}: ${err.message}`)
        return 0
      }

      const written = writeDefinitions(definitions, termsDir, chunk)
      const missed = chunk.filter(s => !written.includes(s))
      console.log(`  Chunk ${i + 1} done: ${written.length}/${chunk.length} defined.${missed.length ? ` Missed: ${missed.join(', ')}` : ''}`)
      return written.length
    }),
    parallel,
  )

  return counts.reduce((a, b) => a + b, 0)
}

function writeDefinitions(definitions, termsDir, expectedSlugs) {
  const written = []
  for (const def of definitions) {
    const slug = def.slug || toSlug(def.term || '')
    if (!slug || !expectedSlugs.includes(slug)) continue

    const termDir = path.join(termsDir, slug)
    fs.mkdirSync(termDir, { recursive: true })

    const meta = {
      term: def.term || slugToReadable(slug),
      categories: Array.isArray(def.categories) ? def.categories : [],
      ...(def.difficultyLevel != null ? { difficultyLevel: String(def.difficultyLevel) } : {}),
      pronunciation: def.pronunciation || '',
      partOfSpeech: def.partOfSpeech || '',
      englishDefinitions: Array.isArray(def.englishDefinitions) ? def.englishDefinitions : [],
      persianTranslation: Array.isArray(def.persianTranslation) ? def.persianTranslation : [],
      examples: Array.isArray(def.examples) ? def.examples : [],
      synonyms: Array.isArray(def.synonyms) ? def.synonyms : [],
      antonyms: Array.isArray(def.antonyms) ? def.antonyms : [],
    }

    fs.writeFileSync(path.join(termDir, 'meta.json'), JSON.stringify(meta, null, 2))
    written.push(slug)
  }
  return written
}

function readMetaTerms(metaPath) {
  if (!fs.existsSync(metaPath)) return []
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
  return Array.isArray(meta.terms) ? meta.terms : []
}

function collectTermSlugs(showDir, showMeta, opts) {
  const slugSet = new Set()

  if (showMeta.type !== 'series') {
    for (const slug of showMeta.terms || []) slugSet.add(slug)
    return [...slugSet]
  }

  const seasonsDir = path.join(showDir, 'seasons')
  if (!fs.existsSync(seasonsDir)) return []

  const seasonDirs =
    opts.season != null
      ? [path.join(seasonsDir, String(opts.season))]
      : fs.readdirSync(seasonsDir).map(s => path.join(seasonsDir, s)).filter(p => fs.statSync(p).isDirectory())

  for (const seasonDir of seasonDirs) {
    const episodesDir = path.join(seasonDir, 'episodes')
    if (!fs.existsSync(episodesDir)) continue

    const episodeDirs =
      opts.season != null && opts.episode != null
        ? [path.join(episodesDir, String(opts.episode))]
        : fs.readdirSync(episodesDir).map(e => path.join(episodesDir, e)).filter(p => fs.statSync(p).isDirectory())

    for (const episodeDir of episodeDirs) {
      for (const slug of readMetaTerms(path.join(episodeDir, 'meta.json'))) {
        slugSet.add(slug)
      }
    }
  }

  return [...slugSet]
}

async function main() {
  const opts = program.opts()

  const showDir = path.join(CONTENT_DIR, 'shows', opts.show)
  const showMetaPath = path.join(showDir, 'meta.json')
  if (!fs.existsSync(showMetaPath)) {
    console.error(`Show not found: ${opts.show}`)
    process.exit(1)
  }
  const showMeta = JSON.parse(fs.readFileSync(showMetaPath, 'utf-8'))

  const isSeries = showMeta.type === 'series'
  if (!isSeries && (opts.season != null || opts.episode != null)) {
    console.error('--season and --episode are only valid for series.')
    process.exit(1)
  }

  const strategies = opts.strategy.split(',').map(s => s.trim()).filter(Boolean)

  const allSlugs = collectTermSlugs(showDir, showMeta, opts)
  console.log(`Found ${allSlugs.length} term(s) referenced in target.`)

  const termsDir = path.join(CONTENT_DIR, 'terms')
  let remaining = allSlugs.filter(slug => !fs.existsSync(path.join(termsDir, slug)))

  if (remaining.length === 0) {
    console.log('All terms already have definitions. Nothing to do.')
    return
  }

  console.log(`${remaining.length} term(s) need definitions.`)

  let llm = null
  let totalDefined = 0

  for (const strategy of strategies) {
    if (remaining.length === 0) break

    let label, define
    if (strategy === 'nothing') {
      label = 'nothing'
      break
    } else if (strategy === 'freedict') {
      label = 'freedict'
      define = chunk => defineFreeDict(chunk)
    } else if (strategy === 'llm') {
      if (!llm) llm = await createLLM(opts.provider, opts.model)
      label = `llm/${opts.provider}/${opts.model}`
      define = chunk => defineLLM(chunk, llm)
    } else {
      console.warn(`Unknown strategy: "${strategy}". Skipping.`)
      continue
    }

    const defined = await runChunked(label, define, remaining, termsDir, opts)
    remaining = remaining.filter(s => !fs.existsSync(path.join(termsDir, s)))
    totalDefined += defined
    console.log(`[${label}] Defined ${defined} term(s). ${remaining.length} remaining.`)
  }

  console.log(`Done. Defined ${totalDefined}/${allSlugs.filter(s => !fs.existsSync(path.join(termsDir, s)) || totalDefined > 0).length} term(s).`)
  if (remaining.length > 0) {
    console.log(`Still missing: ${remaining.join(', ')}`)
  }
}

main().catch(err => {
  console.error(err.message)
  if (err.cause) console.error('Cause:', err.cause)
  process.exit(1)
})
