import './proxy.js'

const BASE_URL = 'https://api.opensubtitles.com/api/v1'
const USER_AGENT = 'scenesay v1.0.0'

export class OpenSubtitlesClient {
  #apiKey
  #username
  #password
  #token = null

  constructor({ apiKey, username, password }) {
    this.#apiKey = apiKey
    this.#username = username
    this.#password = password
  }

  get isLoggedIn() {
    return this.#token !== null
  }

  #headers(includeAuth = true) {
    const h = {
      'Api-Key': this.#apiKey,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    }
    if (includeAuth && this.#token) h['Authorization'] = `Bearer ${this.#token}`
    return h
  }

  async #request(method, endpoint, body = null, auth = true) {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method,
      headers: this.#headers(auth),
      ...(body !== null && { body: JSON.stringify(body) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(`OpenSubtitles ${res.status}: ${data.message ?? data.error ?? res.statusText}`)
    }
    return data
  }

  async login() {
    if (this.#token) return
    const data = await this.#request('POST', '/login', {
      username: this.#username,
      password: this.#password,
    }, false)
    this.#token = data.token
  }

  async logout() {
    if (!this.#token) return
    try { await this.#request('DELETE', '/logout') } catch { /* ignore */ }
    this.#token = null
  }

  async searchSubtitles({ imdbId, language = 'en', seasonNumber, episodeNumber } = {}) {
    await this.login()
    const params = new URLSearchParams()
    if (imdbId) params.set('imdb_id', String(parseInt(imdbId.replace(/^tt/i, ''), 10)))
    if (language) params.set('languages', language)
    if (seasonNumber != null) params.set('season_number', String(seasonNumber))
    if (episodeNumber != null) params.set('episode_number', String(episodeNumber))
    return this.#request('GET', `/subtitles?${params}`)
  }

  async requestDownload(fileId) {
    await this.login()
    return this.#request('POST', '/download', { file_id: fileId })
  }

  // Returns { content: Buffer, fileName: string, remaining: number }
  async downloadContent(fileId) {
    const result = await this.requestDownload(fileId)
    const res = await fetch(result.link)
    if (!res.ok) throw new Error(`Failed to fetch subtitle file: ${res.status}`)
    return {
      content: Buffer.from(await res.arrayBuffer()),
      fileName: result.file_name,
      remaining: result.remaining,
    }
  }
}

export function openSubtitlesConfigFromEnv() {
  const { OPENSUBTITLES_API_KEY, OPENSUBTITLES_USERNAME, OPENSUBTITLES_PASSWORD } = process.env
  if (!OPENSUBTITLES_API_KEY || !OPENSUBTITLES_USERNAME || !OPENSUBTITLES_PASSWORD) {
    throw new Error(
      'Missing env vars: OPENSUBTITLES_API_KEY, OPENSUBTITLES_USERNAME, OPENSUBTITLES_PASSWORD\n' +
      'Copy .env.example to .env and fill in your credentials.'
    )
  }
  return { apiKey: OPENSUBTITLES_API_KEY, username: OPENSUBTITLES_USERNAME, password: OPENSUBTITLES_PASSWORD }
}
