import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

const ROOT = path.resolve(import.meta.dirname, '../..')
const CONTENT = path.join(ROOT, 'src/content')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif'])

function walkDir(dir) {
  const results = []
  for (const name of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, name)
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...walkDir(fullPath))
    } else {
      results.push(fullPath)
    }
  }
  return results
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/')
}

async function optimizeImages(files) {
  const images = files.filter(f => IMAGE_EXTS.has(path.extname(f).toLowerCase()))

  if (images.length === 0) {
    console.log('  No images to convert.')
    return
  }

  let totalBefore = 0
  let totalAfter = 0

  for (const filePath of images) {
    const sizeBefore = fs.statSync(filePath).size
    totalBefore += sizeBefore
    const webpPath = filePath.slice(0, -path.extname(filePath).length) + '.webp'
    try {
      await sharp(filePath).webp({ quality: 85 }).toFile(webpPath)
      const sizeAfter = fs.statSync(webpPath).size
      if (sizeAfter < sizeBefore) {
        totalAfter += sizeAfter
        fs.unlinkSync(filePath)
        console.log(`  ${rel(filePath)} → ${path.basename(webpPath)}  (${formatBytes(sizeBefore)} → ${formatBytes(sizeAfter)})`)
      } else {
        totalAfter += sizeBefore
        fs.unlinkSync(webpPath)
        console.log(`  ${rel(filePath)} skipped — WebP would be larger (${formatBytes(sizeBefore)} vs ${formatBytes(sizeAfter)})`)
      }
    } catch (err) {
      console.error(`  FAILED: ${rel(filePath)}: ${err.message}`)
      totalAfter += sizeBefore
    }
  }

  console.log(`\n  Total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (saved ${formatBytes(Math.max(0, totalBefore - totalAfter))})`)
}

console.log('=== Optimizing Images ===')
await optimizeImages(walkDir(CONTENT))
