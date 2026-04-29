import fs from 'fs'
import { program } from 'commander'
import { OpenSubtitlesClient, openSubtitlesConfigFromEnv } from './opensubtitles.js'

program
  .requiredOption('--imdb-id <id>', 'IMDB ID (e.g. tt0108778)')
  .option('--output <path>', 'output file path (defaults to subtitle filename)')
  .option('--language <lang>', 'subtitle language', 'en')
  .option('--season <n>', 'season number', parseInt)
  .option('--episode <n>', 'episode number', parseInt)
  .parse()

async function main() {
  const { imdbId, output, language, season, episode } = program.opts()

  const client = new OpenSubtitlesClient(openSubtitlesConfigFromEnv())

  try {
    await client.login()
    console.log('Logged in to OpenSubtitles.')

    console.log(`Searching subtitles for ${imdbId}${season != null ? ` S${season}E${episode}` : ''}...`)
    const results = await client.searchSubtitles({
      imdbId,
      language,
      seasonNumber: season,
      episodeNumber: episode,
    })

    if (!results.data?.length) {
      console.error('No subtitles found.')
      process.exit(1)
    }

    const subtitle = results.data.find(s => s.attributes?.files?.length > 0)
    if (!subtitle) {
      console.error('No downloadable subtitle files found.')
      process.exit(1)
    }

    const fileId = subtitle.attributes.files[0].file_id
    const release = subtitle.attributes.release ?? subtitle.attributes.slug ?? fileId
    console.log(`Downloading: ${release}`)

    const { content, fileName, remaining } = await client.downloadContent(fileId)

    const outPath = output ?? fileName
    fs.writeFileSync(outPath, content)
    console.log(`Saved: ${outPath}  (downloads remaining today: ${remaining})`)
  } finally {
    await client.logout()
  }
}

main().catch(err => {
  console.error(err.message)
  if (err.cause) console.error('Cause:', err.cause)
  process.exit(1)
})
