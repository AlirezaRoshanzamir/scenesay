import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import SrtParser2 from 'srt-parser-2'
import { HumanMessage } from '@langchain/core/messages'
import { program } from 'commander'
import { OpenSubtitlesClient, openSubtitlesConfigFromEnv } from './opensubtitles.js'
import { DEFAULT_MODELS, createLLM } from './llm.js'
import { runWithConcurrency } from './concurrency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CONTENT_DIR = path.resolve(__dirname, '../content')

program
  .requiredOption('--show <slug>', 'show slug')
  .option('--season <n>', 'season number (omit for all seasons)', v => parseInt(v, 10))
  .option('--episode <n>', 'episode number (omit for all episodes in season)', v => parseInt(v, 10))
  .option('--strategy <name>', 'extraction strategy', 'llm')
  .option('--provider <name>', 'LLM provider (anthropic, openai)', 'anthropic')
  .option('--model <name>', 'model name (defaults per provider)')
  .option('--max-part-cues <n>', 'max cues per subtitle chunk', v => parseInt(v, 10), 200)
  .option('--min-terms <n>', 'skip episode if it already has at least this many terms', v => parseInt(v, 10), 1)
  .option('--parallel <n>', 'number of chunks to process in parallel', v => parseInt(v, 10), 1)
  .parse()

function toSlug(term) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

function parseSrtCues(srtContent) {
  const parser = new SrtParser2()
  return parser
    .fromSrt(srtContent)
    .map(e => e.text.replace(/<[^>]+>/g, '').trim())
    .filter(Boolean)
}

async function extractTermsLLM(text, llm) {
  const response = await llm.invoke([
    new HumanMessage(`Identify English vocabulary that would be hard for lower-intermediate learners in this subtitle text.
Focus on idioms, slang, phrasal verbs, cultural references, and domain-specific terms. Ignore common words.

Return a JSON array of strings (no other text), each string being the exact phrase as it appears.

Subtitle text:
${text}`),
  ])
  const raw = response.content.trim()
  const jsonMatch = raw.match(/\[[\s\S]*\]/)
  if (!jsonMatch) throw new Error('LLM did not return a JSON array')
  return JSON.parse(jsonMatch[0])
}

const STRATEGIES = { llm: extractTermsLLM }

function listDirNums(dirPath) {
  if (!fs.existsSync(dirPath)) return []
  return fs.readdirSync(dirPath)
    .map(n => parseInt(n, 10))
    .filter(n => !isNaN(n))
    .sort((a, b) => a - b)
}

async function main() {
  const opts = program.opts()

  const strategy = STRATEGIES[opts.strategy]
  if (!strategy) {
    console.error(`Unknown strategy "${opts.strategy}". Available: ${Object.keys(STRATEGIES).join(', ')}`)
    process.exit(1)
  }

  const showDir = path.join(CONTENT_DIR, 'shows', opts.show)
  const showMetaPath = path.join(showDir, 'meta.json')
  if (!fs.existsSync(showMetaPath)) {
    console.error(`Show not found: ${opts.show}`)
    process.exit(1)
  }
  const showMeta = JSON.parse(fs.readFileSync(showMetaPath, 'utf-8'))
  const isSeries = showMeta.type === 'series'

  if (opts.episode != null && opts.season == null) {
    console.error('--episode requires --season.')
    process.exit(1)
  }

  // Build target list: { season, episode, metaPath } or { metaPath } for movies
  let targets = []

  if (!isSeries) {
    targets = [{ metaPath: showMetaPath, label: opts.show }]
  } else if (opts.season != null && opts.episode != null) {
    targets = [{
      season: opts.season,
      episode: opts.episode,
      metaPath: path.join(showDir, 'seasons', String(opts.season), 'episodes', String(opts.episode), 'meta.json'),
    }]
  } else if (opts.season != null) {
    const episodes = listDirNums(path.join(showDir, 'seasons', String(opts.season), 'episodes'))
    targets = episodes.map(ep => ({
      season: opts.season,
      episode: ep,
      metaPath: path.join(showDir, 'seasons', String(opts.season), 'episodes', String(ep), 'meta.json'),
    }))
  } else {
    const seasons = listDirNums(path.join(showDir, 'seasons'))
    for (const s of seasons) {
      const episodes = listDirNums(path.join(showDir, 'seasons', String(s), 'episodes'))
      for (const ep of episodes) {
        targets.push({
          season: s,
          episode: ep,
          metaPath: path.join(showDir, 'seasons', String(s), 'episodes', String(ep), 'meta.json'),
        })
      }
    }
  }

  if (targets.length === 0) {
    console.error('No episodes found.')
    process.exit(1)
  }

  const modelName = opts.model || DEFAULT_MODELS[opts.provider]
  const scopeLabel = !isSeries
    ? opts.show
    : opts.season != null
      ? (opts.episode != null
          ? `S${String(opts.season).padStart(2, '0')}E${String(opts.episode).padStart(2, '0')}`
          : `Season ${opts.season}`)
      : 'all seasons'

  console.log(`Show:    ${opts.show}  (${isSeries ? 'series' : 'movie'})  —  ${scopeLabel}  —  ${targets.length} episode(s)`)
  console.log(`Model:   ${opts.provider}/${modelName}   Strategy: ${opts.strategy}   Max cues/chunk: ${opts.maxPartCues}`)
  if (opts.minTerms != null) console.log(`Skip if: ≥ ${opts.minTerms} terms already present`)
  console.log()

  const llm = await createLLM(opts.provider, opts.model)
  const osClient = new OpenSubtitlesClient(openSubtitlesConfigFromEnv())
  const stats = { added: 0, unchanged: 0, skipped: 0, failed: 0, totalNewTerms: 0 }
  const pad = String(targets.length).length

  await osClient.login()
  try {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]
      const idx = String(i + 1).padStart(pad, ' ')
      const epLabel = target.label
        ?? `S${String(target.season).padStart(2, '0')}E${String(target.episode).padStart(2, '0')}`
      const prefix = `[${idx}/${targets.length}] ${epLabel}`

      if (!fs.existsSync(target.metaPath)) {
        console.log(`${prefix}  no meta.json — skipped`)
        stats.skipped++
        continue
      }

      const meta = JSON.parse(fs.readFileSync(target.metaPath, 'utf-8'))
      const existingCount = (meta.terms || []).length

      if (opts.minTerms != null && existingCount >= opts.minTerms) {
        console.log(`${prefix}  skipped — ${existingCount} terms already (min: ${opts.minTerms})`)
        stats.skipped++
        continue
      }

      process.stdout.write(`${prefix}  downloading...`)

      let srtContent
      try {
        const results = await osClient.searchSubtitles({
          imdbId: showMeta.imdbId,
          language: 'en',
          seasonNumber: target.season,
          episodeNumber: target.episode,
        })
        const subtitleEntry = results.data?.find(s => s.attributes?.files?.length > 0)
        if (!subtitleEntry) {
          process.stdout.write(' no subtitle found\n')
          stats.skipped++
          continue
        }
        const fileId = subtitleEntry.attributes.files[0].file_id
        const { content, remaining } = await osClient.downloadContent(fileId)
        srtContent = content.toString('utf-8')
        process.stdout.write(` ok (${remaining} left)`)
      } catch (err) {
        process.stdout.write(` FAILED: ${err.message}\n`)
        stats.failed++
        continue
      }

      const cues = parseSrtCues(srtContent)
      const chunks = []
      for (let j = 0; j < cues.length; j += opts.maxPartCues) {
        chunks.push(cues.slice(j, j + opts.maxPartCues).join('\n'))
      }

      const parallelLabel = opts.parallel > 1 ? ` (${opts.parallel} parallel)` : ''
      process.stdout.write(` | extracting ${chunks.length} chunk(s)${parallelLabel}...`)

      const extractedTerms = []
      try {
        const results = await runWithConcurrency(
          chunks.map(chunk => () => strategy(chunk, llm)),
          opts.parallel,
        )
        extractedTerms.push(...results.flat())
      } catch (err) {
        process.stdout.write(` FAILED: ${err.message}\n`)
        stats.failed++
        continue
      }

      if (!meta.terms) meta.terms = []
      const existingSlugs = new Set(meta.terms)
      const newSlugs = []
      for (const t of extractedTerms) {
        if (!t) continue
        const slug = toSlug(t)
        if (existingSlugs.has(slug)) continue
        newSlugs.push(slug)
        existingSlugs.add(slug)
      }

      if (newSlugs.length === 0) {
        process.stdout.write(' no new terms\n')
        stats.unchanged++
      } else {
        meta.terms.push(...newSlugs)
        fs.writeFileSync(target.metaPath, JSON.stringify(meta, null, 4))
        process.stdout.write(` +${newSlugs.length} terms (total: ${meta.terms.length})\n`)
        stats.added++
        stats.totalNewTerms += newSlugs.length
      }
    }
  } finally {
    await osClient.logout()
  }

  console.log()
  console.log('─'.repeat(52))
  console.log(`Done — ${targets.length} episode(s) processed`)
  console.log(`  Updated:   ${stats.added}  (+${stats.totalNewTerms} new terms total)`)
  console.log(`  Unchanged: ${stats.unchanged}`)
  console.log(`  Skipped:   ${stats.skipped}`)
  if (stats.failed > 0) console.log(`  Failed:    ${stats.failed}`)
}

main().catch(err => {
  console.error(err.message)
  if (err.cause) console.error('Cause:', err.cause)
  process.exit(1)
})
