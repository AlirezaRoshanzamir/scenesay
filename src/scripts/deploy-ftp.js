import * as ftp from 'basic-ftp'
import path from 'path'
import { fileURLToPath } from 'url'
import { program } from 'commander'

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
