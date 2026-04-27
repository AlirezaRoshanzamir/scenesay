import * as ftp from 'basic-ftp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOCAL_DIR = path.resolve(__dirname, '../../dist/build')

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = { secure: false }
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--host':   opts.host   = args[++i]; break
      case '--user':   opts.user   = args[++i]; break
      case '--pass':   opts.pass   = args[++i]; break
      case '--dir':    opts.dir    = args[++i]; break
      case '--secure': {
        const next = args[i + 1]
        if (next === 'false' || next === '0') { opts.secure = false; i++ }
        else if (next === 'true' || next === '1') { opts.secure = true; i++ }
        else { opts.secure = true }
        break
      }
    }
  }
  return opts
}

async function deploy() {
  const opts = parseArgs()
  const { host, user, pass, dir, secure } = opts

  if (!host || !user || !pass || !dir) {
    console.error('Usage: node deploy-ftp.js --host <host> --user <user> --pass <pass> --dir <remote-dir> [--secure]')
    process.exit(1)
  }

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
    await client.uploadFromDir(LOCAL_DIR)
    console.log('Deploy complete.')
  } catch (err) {
    console.error('FTP deploy failed:', err.message)
    process.exit(1)
  } finally {
    client.close()
  }
}

deploy()
