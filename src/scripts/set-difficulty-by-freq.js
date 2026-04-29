import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import './proxy.js'
import { runWithConcurrency } from './concurrency.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TERMS_DIR = path.resolve(__dirname, '../content/terms')

program
  .option('--force', 'overwrite existing difficultyLevel values', false)
  .option('--dry-run', 'print what would change without writing', false)
  .option('--parallel <n>', 'concurrent API requests', v => parseInt(v, 10), 5)
  .parse()

function freqToDifficulty(freqPerMillion) {
  if (!freqPerMillion || freqPerMillion <= 0) return 10

  const LOG_MAX = Math.log(500)   // very common words
  const LOG_MIN = Math.log(0.01)  // extremely rare

  const logFreq = Math.max(LOG_MIN, Math.min(LOG_MAX, Math.log(freqPerMillion)))
  const difficulty = 10 * (1 - (logFreq - LOG_MIN) / (LOG_MAX - LOG_MIN))
  return Math.round(Math.max(1, Math.min(10, difficulty)))
}

async function fetchFreq(term) {
  const url = `https://api.datamuse.com/words?sp=${encodeURIComponent(term)}&md=f&max=1`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const result = data[0]
    if (result.word?.toLowerCase() !== term.toLowerCase()) return null
    const freqTag = result.tags?.find(t => t.startsWith('f:'))
    if (!freqTag) return null
    return parseFloat(freqTag.slice(2))
  } catch {
    return null
  }
}

async function processTerm(slug, opts) {
  const metaPath = path.join(TERMS_DIR, slug, 'meta.json')
  if (!fs.existsSync(metaPath)) return { slug, status: 'missing' }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

  if (!opts.force && meta.difficultyLevel != null) return { slug, status: 'skipped' }

  const term = meta.term || slug.replace(/_/g, ' ')
  const freq = await fetchFreq(term)

  if (freq === null) return { slug, status: 'not_found' }

  const difficulty = freqToDifficulty(freq)

  if (!opts.dryRun) {
    meta.difficultyLevel = String(difficulty)
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
  }

  return { slug, status: 'set', freq, difficulty }
}

async function main() {
  const opts = program.opts()

  const slugs = fs.readdirSync(TERMS_DIR).filter(name => {
    const p = path.join(TERMS_DIR, name)
    return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'meta.json'))
  })

  console.log(`Found ${slugs.length} term(s).`)
  if (opts.dryRun) console.log('Dry run — no files will be written.')

  const results = await runWithConcurrency(
    slugs.map(slug => () => processTerm(slug, opts)),
    opts.parallel,
  )

  const set = results.filter(r => r.status === 'set')
  const skipped = results.filter(r => r.status === 'skipped')
  const notFound = results.filter(r => r.status === 'not_found')

  for (const r of set) {
    console.log(`  [set]       ${r.slug}: freq=${r.freq.toFixed(2)} -> difficulty ${r.difficulty}`)
  }
  for (const r of notFound) {
    console.log(`  [not_found] ${r.slug}`)
  }

  console.log(`\nDone: ${set.length} set, ${skipped.length} skipped, ${notFound.length} not found.`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
