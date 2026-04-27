import { useState, useEffect } from 'react'
import './App.css'
import ShowPage from './ShowPage.jsx'
import TermsPage from './TermsPage.jsx'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClapperboard, faMagnifyingGlass, faUnlock, faCodeBranch, faLanguage, faHeadphones, faTv, faMugHot, faEnvelope } from '@fortawesome/free-solid-svg-icons'

const SHOWS_ENDPOINT = `${import.meta.env.BASE_URL}api/shows/meta.json`

function parseHash() {
  const hash = window.location.hash
  const epM = hash.match(/^#\/show\/([^/]+)\/seasons\/(\d+)\/episodes\/(\d+)\/terms$/)
  if (epM) return {
    showId: decodeURIComponent(epM[1]),
    page: 'episode-terms',
    season: parseInt(epM[2], 10),
    episode: parseInt(epM[3], 10),
  }
  const movieM = hash.match(/^#\/show\/([^/]+)\/terms$/)
  if (movieM) return { showId: decodeURIComponent(movieM[1]), page: 'movie-terms' }
  const showM = hash.match(/^#\/show\/([^/]+)$/)
  if (showM) return { showId: decodeURIComponent(showM[1]), page: 'show' }
  return { showId: null, page: 'home' }
}

function ShowImage({ poster, gradient, emoji, title }) {
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  return (
    <div className="show-tile-bg">
      {poster && !error && (
        <img
          src={poster}
          alt={title}
          style={{
            opacity: loaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
      <div
        className="show-tile-placeholder"
        style={{ background: gradient, opacity: loaded && !error ? 0 : 1, transition: 'opacity 0.3s ease' }}
      >
        {emoji}
      </div>
    </div>
  )
}

export default function App() {
  const [query, setQuery] = useState('')
  const [shows, setShows] = useState([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(null)
  const [route, setRoute] = useState(parseHash)

  useEffect(() => {
    fetch(SHOWS_ENDPOINT)
      .then(res => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
        return res.json()
      })
      .then(data => { setShows(data); setLoading(false) })
      .catch(err => { setFetchError(err.message); setLoading(false) })
  }, [])

  useEffect(() => {
    const handler = () => setRoute(parseHash())
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  useEffect(() => {
    if (route.showId && !loading && !fetchError && !shows.find(s => s.id === route.showId)) {
      goHome()
    }
  }, [route, loading, fetchError, shows])

  function openShow(show) {
    window.location.hash = `/show/${encodeURIComponent(show.id)}`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function goHome() {
    window.location.hash = ''
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function openEpisodeTerms(showId, season, episode) {
    window.location.hash = `/show/${encodeURIComponent(showId)}/seasons/${season}/episodes/${episode}/terms`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function openMovieTerms(showId) {
    window.location.hash = `/show/${encodeURIComponent(showId)}/terms`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function goToShow(showId) {
    window.location.hash = `/show/${encodeURIComponent(showId)}`
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const currentShow = route.showId ? shows.find(s => s.id === route.showId) : null

  const nav = (
    <nav className="nav">
      <a
        href="#"
        className="nav-logo"
        onClick={e => { e.preventDefault(); goHome() }}
      >
        <img src="/logo.webp" alt="" className="nav-logo-img" />
        <span className="nav-logo-name">Scene<span>say</span></span>
      </a>
      <div className="nav-links">
        <a
          href="https://github.com/AlirezaRoshanzamir/scenesay"
          target="_blank"
          rel="noopener noreferrer"
          className="nav-btn"
        >
          <span>⌥</span> GitHub
        </a>
      </div>
    </nav>
  )

  const footer = (
    <footer className="footer">
      <p>
        Scenesay is a{' '}
        <a href="https://github.com/AlirezaRoshanzamir/scenesay" target="_blank" rel="noopener noreferrer">
          free and open-source
        </a>{' '}
        project by{' '}
        <a href="mailto:a.roshanzamir1996@gmail.com">Alireza Roshanzamir</a>.
      </p>
      <p>Licensed under MIT · No ads, no paywalls, no tracking.</p>
    </footer>
  )

  if (route.page === 'show' || route.page === 'episode-terms' || route.page === 'movie-terms') {
    if (loading) {
      return (
        <>
          {nav}
          <div className="page-loading">Loading…</div>
          {footer}
        </>
      )
    }
    if (currentShow) {
      if (route.page === 'episode-terms') {
        return (
          <>
            {nav}
            <TermsPage
              show={currentShow}
              seasonNum={route.season}
              episodeNum={route.episode}
              onBack={() => goToShow(route.showId)}
            />
            {footer}
          </>
        )
      }
      if (route.page === 'movie-terms') {
        return (
          <>
            {nav}
            <TermsPage
              show={currentShow}
              onBack={() => goToShow(route.showId)}
            />
            {footer}
          </>
        )
      }
      return (
        <>
          {nav}
          <ShowPage
            show={currentShow}
            onBack={goHome}
            onEpisodeClick={(season, episode) => openEpisodeTerms(route.showId, season, episode)}
            onMovieClick={() => openMovieTerms(route.showId)}
          />
          {footer}
        </>
      )
    }
    return null
  }

  const filtered = shows.filter(s =>
    s.title.toLowerCase().includes(query.toLowerCase()) ||
    s.genre.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <>
      {nav}

      {/* Hero */}
      <section className="hero">
        <div className="hero-tag">
          <FontAwesomeIcon icon={faClapperboard} /> Learn English the cinematic way
        </div>
        <h1>
          Master English through<br />
          <em>Movies &amp; TV Shows</em>
        </h1>
        <p className="hero-desc">
          Look up tricky words, phrases, and idioms before or while watching your
          favorite shows. Stop hitting pause — start understanding.
        </p>
        <a href="#browse" className="hero-cta">
          <FontAwesomeIcon icon={faTv} /> Browse Shows
        </a>
      </section>

      {/* Features strip */}
      <div className="features-strip">
        <div className="feat-item"><span className="icon"><FontAwesomeIcon icon={faUnlock} /></span> 100% Free</div>
        <div className="feat-item"><span className="icon"><FontAwesomeIcon icon={faCodeBranch} /></span> Open Source</div>
        <div className="feat-item"><span className="icon"><FontAwesomeIcon icon={faLanguage} /></span> Persian Support</div>
        <div className="feat-item"><span className="icon"><FontAwesomeIcon icon={faHeadphones} /></span> Pronunciation Guides</div>
        <div className="feat-item"><span className="icon"><FontAwesomeIcon icon={faTv} /></span> Episode-level Vocab</div>
      </div>

      {/* Shows */}
      <section id="browse" className="section">
        <div className="section-inner">
          <div className="section-header">
            <h2>Browse Shows</h2>
            <p>
              {query
                ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} for "${query}"`
                : 'Pick a show and explore its vocabulary episode by episode'}
            </p>
            <div className="search-wrap">
              <span className="search-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
              <input
                className="search-input"
                type="text"
                placeholder="Search for a show, e.g. Friends, Breaking Bad…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                aria-label="Search shows"
              />
            </div>
          </div>
          <div className="shows-grid">
            {loading && (
              <div className="no-results"><p>Loading shows…</p></div>
            )}
            {fetchError && (
              <div className="no-results">
                <p>Failed to load shows.</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem', color: 'var(--red)' }}>{fetchError}</p>
              </div>
            )}
            {!loading && !fetchError && filtered.length === 0 && (
              <div className="no-results">
                <p>No shows match "{query}"</p>
                <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
                  Want it added? <a href="mailto:a.roshanzamir1996@gmail.com" style={{ color: 'var(--accent2)' }}>Let me know.</a>
                </p>
              </div>
            )}
            {filtered.map(show => (
              <div
                key={show.id}
                className="show-tile"
                onClick={() => openShow(show)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && openShow(show)}
                aria-label={`View ${show.title}`}
              >
                <ShowImage
                  poster={show.poster}
                  gradient={show.gradient}
                  emoji={show.emoji}
                  title={show.title}
                />
                <div className="show-tile-overlay">
                  <div className="show-tile-title">{show.title}</div>
                  <div className="show-tile-meta">{show.genre}</div>
                </div>
                <span className={`show-tile-badge ${show.available ? 'available' : 'soon'}`}>
                  {show.available ? 'Available' : 'Soon'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Donate */}
      <section className="section donate-section" id="donate">
        <div className="section-inner">
          <div className="donate-card">
            <div className="icon-big"><FontAwesomeIcon icon={faMugHot} /></div>
            <h2>Support the Project</h2>
            <p>
              Scenesay is completely free and will always remain so. If it's helped you
              learn even one new word, consider buying me a coffee — it keeps the
              episodes coming and the servers on.
            </p>
            <a
              href="https://ko-fi.com/AlirezaRoshanzamir"
              target="_blank"
              rel="noopener noreferrer"
              className="donate-btn"
            >
              <FontAwesomeIcon icon={faMugHot} /> Buy me a coffee
            </a>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="section" id="contact">
        <div className="section-inner">
          <div className="section-header">
            <h2>Get in Touch</h2>
            <p>Questions, suggestions, or want to contribute a new show? Reach out.</p>
          </div>
          <div className="contact-list">
            <a
              href="mailto:a.roshanzamir1996@gmail.com"
              className="contact-link"
            >
              <span className="icon"><FontAwesomeIcon icon={faEnvelope} /></span> a.roshanzamir1996@gmail.com
            </a>
            <a
              href="https://github.com/AlirezaRoshanzamir/scenesay"
              target="_blank"
              rel="noopener noreferrer"
              className="contact-link"
            >
              <span className="icon">⌥</span> Open an issue on GitHub
            </a>
          </div>
        </div>
      </section>

      {footer}
    </>
  )
}
