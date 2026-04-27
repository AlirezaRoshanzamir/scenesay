import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

function serveApiDirectory() {
  return {
    name: 'serve-api-directory',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        const filePath = path.resolve('dist/build/api', req.url.slice(1))
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          res.end(fs.readFileSync(filePath))
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), serveApiDirectory()],
  base: process.env.DEPLOY_BASE ?? '/',
  root: 'src/frontend',
  build: {
    outDir: '../../dist/build',
  },
})
