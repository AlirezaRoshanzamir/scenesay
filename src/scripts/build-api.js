import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONTENT = path.join(ROOT, 'src/content')
const OUTPUT = path.resolve(ROOT, 'dist/build/api')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function writeJson(file, data) {
  ensureDir(path.dirname(file))
  fs.writeFileSync(file, JSON.stringify(data, null, 2))
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest))
  fs.copyFileSync(src, dest)
}

function listDir(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir) : []
}

function hashFile(filePath) {
  const content = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16)
}

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif'])
const VOICE_EXTS = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.aac'])

function findImage(dir) {
  return listDir(dir).find(f => IMAGE_EXTS.has(path.extname(f).toLowerCase())) ?? null
}

async function generateGradient(imagePath) {
  const { data } = await sharp(imagePath)
    .resize(2, 1, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  const toHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
  return `linear-gradient(135deg, ${toHex(data[0], data[1], data[2])} 0%, ${toHex(data[3], data[4], data[5])} 100%)`
}

function processMedia(srcPath, destDir, apiPrefix) {
  const ext = path.extname(srcPath)
  const destName = `${hashFile(srcPath)}${ext}`
  copyFile(srcPath, path.join(destDir, destName))
  return `${apiPrefix}/${destName}`
}

function resolveTerm(termId) {
  const termDir = path.join(CONTENT, 'terms', termId)
  const metaFile = path.join(termDir, 'meta.json')
  if (!fs.existsSync(metaFile)) return null

  const term = readJson(metaFile)
  const files = listDir(termDir).sort()

  const imageFiles = files.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))
  if (imageFiles.length > 0) {
    term.images = imageFiles.map(f =>
      processMedia(path.join(termDir, f), path.join(OUTPUT, 'images'), '/api/images')
    )
  }

  const voiceFiles = files.filter(f => VOICE_EXTS.has(path.extname(f).toLowerCase()))
  if (voiceFiles.length > 0) {
    term.pronunciationVoices = voiceFiles.map(f =>
      processMedia(path.join(termDir, f), path.join(OUTPUT, 'voices'), '/api/voices')
    )
  }

  return term
}

async function buildShowsMeta() {
  const showsDir = path.join(CONTENT, 'shows')
  const imagesOutputDir = path.join(OUTPUT, 'images')

  const showIds = listDir(showsDir).filter(name => fs.statSync(path.join(showsDir, name)).isDirectory())

  const shows = (await Promise.all(showIds.map(async showId => {
    const showDir = path.join(showsDir, showId)
    const metaFile = path.join(showDir, 'meta.json')
    if (!fs.existsSync(metaFile)) return null

    const meta = readJson(metaFile)
    meta.id = meta.id ?? showId

    const imageFile = findImage(showDir)
    if (imageFile) {
      const src = path.join(showDir, imageFile)
      const ext = path.extname(imageFile)
      const destName = `${hashFile(src)}${ext}`
      copyFile(src, path.join(imagesOutputDir, destName))
      meta.poster = `/api/images/${destName}`
      meta.gradient = await generateGradient(src)
    }

    if (meta.type === 'series' && meta.seasons) {
      meta.seasons = meta.seasons.map(season => {
        const episodesDir = path.join(showDir, 'seasons', String(season.number), 'episodes')
        const epMetaMap = new Map(
          listDir(episodesDir)
            .filter(epNum => fs.existsSync(path.join(episodesDir, epNum, 'meta.json')))
            .map(epNum => {
              const epMeta = readJson(path.join(episodesDir, epNum, 'meta.json'))
              return [parseInt(epNum), epMeta]
            })
        )
        const { episodesCount, ...rest } = season
        const episodes = Array.from({ length: episodesCount || 0 }, (_, i) => {
          const num = i + 1
          const epMeta = epMetaMap.get(num)
          return {
            number: num,
            title: epMeta?.title ?? null,
            available: Array.isArray(epMeta?.terms) && epMeta.terms.length > 0
          }
        })
        return { ...rest, episodes }
      })
      meta.available = meta.seasons.some(s => s.episodes.some(ep => ep.available))
    } else {
      meta.available = Array.isArray(meta.terms) && meta.terms.length > 0
    }

    return meta
  }))).filter(Boolean)

  writeJson(path.join(OUTPUT, 'shows', 'meta.json'), shows)
  console.log(`Built shows/meta.json: ${shows.length} shows`)
}

function buildShowContent() {
  const showsDir = path.join(CONTENT, 'shows')

  listDir(showsDir)
    .filter(name => fs.statSync(path.join(showsDir, name)).isDirectory())
    .forEach(showId => {
      const showDir = path.join(showsDir, showId)
      const metaFile = path.join(showDir, 'meta.json')
      if (!fs.existsSync(metaFile)) return

      const meta = readJson(metaFile)

      if (meta.type === 'movie') {
        const termIds = Array.isArray(meta.terms) ? meta.terms : []
        const terms = termIds.map(resolveTerm).filter(Boolean)
        writeJson(path.join(OUTPUT, 'shows', showId, 'meta.json'), { terms })
        console.log(`Built shows/${showId}/meta.json: ${terms.length} terms`)
      } else if (meta.type === 'series' && meta.seasons) {
        meta.seasons.forEach(season => {
          const seasonNum = season.number
          const episodesDir = path.join(showDir, 'seasons', String(seasonNum), 'episodes')
          listDir(episodesDir)
            .filter(epNum => fs.existsSync(path.join(episodesDir, epNum, 'meta.json')))
            .forEach(epNum => {
              const epMeta = readJson(path.join(episodesDir, epNum, 'meta.json'))
              const termIds = Array.isArray(epMeta.terms) ? epMeta.terms : []
              const terms = termIds.map(resolveTerm).filter(Boolean)
              writeJson(
                path.join(OUTPUT, 'shows', showId, 'seasons', String(seasonNum), 'episodes', epNum, 'meta.json'),
                { title: epMeta.title, terms }
              )
              console.log(`Built shows/${showId}/seasons/${seasonNum}/episodes/${epNum}/meta.json: ${terms.length} terms`)
            })
        })
      }
    })
}

await buildShowsMeta()
buildShowContent()
