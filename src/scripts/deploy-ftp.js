import * as ftp from 'basic-ftp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'

function countBytes(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) total += countBytes(full)
    else total += fs.statSync(full).size
  }
  return total
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCAL_DIR = path.resolve(__dirname, '../../dist/build')

program
  .requiredOption('--host <host>', 'FTP host')
  .requiredOption('--user <user>', 'FTP username')
  .requiredOption('--pass <pass>', 'FTP password')
  .requiredOption('--dir <remote-dir>', 'remote directory')
  .option('--secure', 'use FTPS', false)
  .parse()

async function deploy() {
  const { host, user, pass, dir, secure } = program.opts()

  const client = new ftp.Client()
  client.ftp.verbose = false

  try {
    await client.access({
      host,
      user,
      password: pass,
      secure,
      secureOptions: secure ? { rejectUnauthorized: false } : undefined,
    })
    console.log(`Connected to ${host}`)

    await client.ensureDir(dir)
    console.log(`Uploading ${LOCAL_DIR} → ${dir} ...`)

    await client.clearWorkingDir()

    const totalBytes = countBytes(LOCAL_DIR)
    let lastBytes = Infinity
    client.trackProgress(info => {
      if (info.bytes < lastBytes) {
        const pct = Math.min(100, Math.round(info.bytesOverall / totalBytes * 100))
        console.log(`  [${String(pct).padStart(3)}%] ${info.name}`)
      }
      lastBytes = info.bytes
    })
    await client.uploadFromDir(LOCAL_DIR)
    client.trackProgress()

    console.log('Deploy complete.')
  } catch (err) {
    console.error('FTP deploy failed:', err.message)
    process.exit(1)
  } finally {
    client.close()
  }
}

deploy()
