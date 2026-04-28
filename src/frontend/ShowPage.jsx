import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faGlobe, faClapperboard, faTv, faHourglassHalf } from '@fortawesome/free-solid-svg-icons'

const DIFFICULTY_CONFIG = {
  'Beginner':            { color: '#34d399', level: 1 },
  'Elementary':          { color: '#22d3ee', level: 2 },
  'Intermediate':        { color: '#fbbf24', level: 3 },
  'Upper-Intermediate':  { color: '#f97316', level: 4 },
  'Advanced':            { color: '#f87171', level: 5 },
}

function DifficultyDots({ difficulty }) {
  const config = DIFFICULTY_CONFIG[difficulty] || { color: '#888', level: 0 }
  return (
    <span className="difficulty-dots">
      {[1, 2, 3, 4, 5].map(i => (
        <span
          key={i}
          className="difficulty-dot"
          style={{ background: i <= config.level ? config.color : 'rgba(255,255,255,0.15)' }}
        />
      ))}
    </span>
  )
}

function PosterImage({ poster, gradient, emoji, title }) {
  const [error, setError] = useState(false)
  return (
    <div className="show-page-poster-wrap" style={{ background: gradient }}>
      {poster && !error ? (
        <img
          src={poster}
          alt={title}
          className="show-page-poster-img"
          onError={() => setError(true)}
        />
      ) : (
        <span className="show-page-poster-emoji">{emoji}</span>
      )}
    </div>
  )
}

function EpisodeTile({ number, title, available, onClick }) {
  return (
    <div
      className={`episode-tile ${available ? 'episode-available' : 'episode-soon'}`}
      onClick={available ? onClick : undefined}
      role={available ? 'button' : undefined}
      tabIndex={available ? 0 : undefined}
      onKeyDown={available ? (e => e.key === 'Enter' && onClick?.()) : undefined}
    >
      <span className="episode-num">E{String(number).padStart(2, '0')}</span>
      <span className="episode-title">{title || `Episode ${number}`}</span>
      <span className={`episode-badge ${available ? 'available' : 'soon'}`}>
        {available ? 'View Vocab' : 'Soon'}
      </span>
    </div>
  )
}

export default function ShowPage({ show, onBack, onEpisodeClick, onMovieClick }) {
  const firstAvailableSeason = show.seasons?.find(s => s.episodes?.some(ep => ep.available))?.number
  const [activeSeason, setActiveSeason] = useState(firstAvailableSeason || 1)
  const [bgError, setBgError] = useState(false)

  const isMovie = show.type === 'movie'
  const currentSeason = show.seasons?.find(s => s.number === activeSeason)

  return (
    <div className="show-page">
      {/* ── Hero ── */}
      <div className="show-page-hero" style={{ background: show.gradient }}>
        {!bgError && show.poster && (
          <img
            className="show-page-hero-bg"
            src={show.poster}
            alt=""
            aria-hidden="true"
            onError={() => setBgError(true)}
          />
        )}
        <div className="show-page-hero-overlay" />

        <div className="show-page-hero-content">
          <button className="show-page-back" onClick={onBack}>
            ← Back to Shows
          </button>

          <div className="show-page-info">
            <PosterImage
              poster={show.poster}
              gradient={show.gradient}
              emoji={show.emoji}
              title={show.title}
            />

            <div className="show-page-meta">
              <div className="show-page-genre-tag">{show.genre}</div>
              <h1 className="show-page-title">{show.title}</h1>

              <div className="show-page-badges">
                <span className="show-page-badge">{show.year}</span>
                {show.nativeLanguage && (
                  <span className="show-page-badge"><FontAwesomeIcon icon={faGlobe} /> {show.nativeLanguage}</span>
                )}
                {isMovie
                  ? <span className="show-page-badge"><FontAwesomeIcon icon={faClapperboard} /> Movie</span>
                  : show.seasons?.length > 0 && (
                    <span className="show-page-badge">
                      <FontAwesomeIcon icon={faTv} /> {show.seasons.length} Season{show.seasons.length !== 1 ? 's' : ''}
                    </span>
                  )
                }
                {show.termsDifficulty && (
                  <span className="show-page-badge difficulty-badge">
                    <DifficultyDots difficulty={show.termsDifficulty} />
                    {show.termsDifficulty}
                  </span>
                )}
              </div>

              {show.description && (
                <p className="show-page-desc">{show.description}</p>
              )}

              {show.available ? (
                <button
                  className="show-page-vocab-btn"
                  onClick={isMovie
                    ? onMovieClick
                    : () => document.getElementById('seasons-section')?.scrollIntoView({ behavior: 'smooth' })
                  }
                >
                  View Vocab
                </button>
              ) : (
                <span className="show-page-status soon"><FontAwesomeIcon icon={faHourglassHalf} /> Coming Soon</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Vocabulary ── */}
      {!isMovie && show.seasons?.length > 0 && (
        <div id="seasons-section" className="show-seasons-section">
          <div className="show-seasons-inner">
            <div className="season-tabs-wrap">
              <div className="season-tabs">
                {show.seasons.map(season => (
                  <button
                    key={season.number}
                    className={`season-tab ${activeSeason === season.number ? 'active' : ''}`}
                    onClick={() => setActiveSeason(season.number)}
                  >
                    Season {season.number}
                    {season.episodes?.some(ep => ep.available) && (
                      <span className="season-tab-dot" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="season-info">
              <h3>Season {activeSeason}</h3>
              {currentSeason?.year && (
                <span className="season-year">{currentSeason.year}</span>
              )}
              <span className="season-ep-count">
                {currentSeason?.episodes?.length} episodes
                {currentSeason?.episodes?.some(ep => ep.available) && (
                  <span className="season-avail-count">
                    {' '}· {currentSeason.episodes.filter(ep => ep.available).length} with vocabulary
                  </span>
                )}
              </span>
            </div>

            <div className="episodes-grid">
              {(currentSeason?.episodes || []).map(ep => (
                <EpisodeTile
                  key={ep.number}
                  number={ep.number}
                  title={ep.title}
                  available={ep.available}
                  onClick={() => onEpisodeClick?.(activeSeason, ep.number)}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
