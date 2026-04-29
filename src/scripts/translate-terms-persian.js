import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'
import { runWithConcurrency } from './concurrency.js'
import './proxy.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const TERMS_DIR = path.resolve(__dirname, '../content/terms')
const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'

program
  .option('--term <slug>', 'process a specific term slug only')
  .option('--dry-run', 'show what would be translated without writing files')
  .option('--parallel <n>', 'number of terms to process in parallel', v => parseInt(v, 10), 3)
  .parse()

async function translateOne(text) {
  const url = `${TRANSLATE_URL}?client=gtx&sl=en&tl=fa&dt=t&q=${encodeURIComponent(text)}`
  const res = await fetch(url)

  if (!res.ok) throw new Error(`HTTP ${res.status}`)

  const data = await res.json()
  return data[0].map(item => item[0]).join('')
}

async function translateAll(texts) {
  const results = []
  for (const text of texts) {
    results.push(await translateOne(text))
  }
  return results
}

async function processSlugs(slugs, opts) {
  const counts = await runWithConcurrency(
    slugs.map(slug => async () => {
      const metaPath = path.join(TERMS_DIR, slug, 'meta.json')
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))

      const texts = meta.englishDefinitions?.length ? meta.englishDefinitions : [meta.term]

      let translations
      try {
        translations = await translateAll(texts)
      } catch (err) {
        console.error(`  [${slug}] Failed: ${err.message}`)
        return 0
      }

      if (opts.dryRun) {
        console.log(`[dry-run] ${slug}: ${JSON.stringify(translations)}`)
        return 1
      }

      meta.persianTranslation = translations
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))
      console.log(`  Updated: ${slug}`)
      return 1
    }),
    opts.parallel,
  )

  return counts.reduce((a, b) => a + b, 0)
}

async function main() {
  const opts = program.opts()

  let slugs
  if (opts.term) {
    const metaPath = path.join(TERMS_DIR, opts.term, 'meta.json')
    if (!fs.existsSync(metaPath)) {
      console.error(`Term not found: ${opts.term}`)
      process.exit(1)
    }
    slugs = [opts.term]
  } else {
    slugs = fs.readdirSync(TERMS_DIR).filter(slug => {
      const metaPath = path.join(TERMS_DIR, slug, 'meta.json')
      if (!fs.existsSync(metaPath)) return false
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      return !Array.isArray(meta.persianTranslation) || meta.persianTranslation.length === 0
    })
  }

  if (slugs.length === 0) {
    console.log('All terms already have Persian translations.')
    return
  }

  console.log(`${slugs.length} term(s) to translate${opts.dryRun ? ' (dry run)' : ''}.`)

  const done = await processSlugs(slugs, opts)
  console.log(`Done. Translated ${done}/${slugs.length} term(s).`)
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
