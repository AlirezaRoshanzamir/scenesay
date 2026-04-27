import { useState, useEffect, useMemo, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faMagnifyingGlass, faChevronUp, faChevronDown, faPlay, faPause, faAnglesDown, faAnglesUp } from '@fortawesome/free-solid-svg-icons'
import Select from 'react-select'

const DIFFICULTY_ORDER = ['Beginner', 'Elementary', 'Intermediate', 'Upper-Intermediate', 'Advanced']

const rsStyles = {
  control: (base, state) => ({
    ...base,
    background: 'var(--bg2)',
    border: `1px solid ${state.isFocused ? 'var(--accent)' : 'var(--border)'}`,
    borderRadius: '8px',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(124, 106, 247, 0.15)' : 'none',
    minHeight: '38px',
    cursor: 'pointer',
    '&:hover': { borderColor: 'var(--accent)' },
  }),
  menu: base => ({
    ...base,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    zIndex: 200,
  }),
  menuList: base => ({ ...base, padding: '4px' }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected
      ? 'rgba(124, 106, 247, 0.2)'
      : state.isFocused
      ? 'rgba(124, 106, 247, 0.08)'
      : 'transparent',
    color: state.isSelected ? 'var(--accent2)' : 'var(--text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    borderRadius: '6px',
  }),
  multiValue: base => ({
    ...base,
    background: 'rgba(124, 106, 247, 0.18)',
    border: '1px solid rgba(124, 106, 247, 0.3)',
    borderRadius: '999px',
    margin: '2px',
  }),
  multiValueLabel: base => ({
    ...base,
    color: 'var(--accent2)',
    fontSize: '0.78rem',
    fontWeight: 600,
    paddingLeft: '8px',
    paddingRight: '4px',
  }),
  multiValueRemove: base => ({
    ...base,
    color: 'var(--accent2)',
    borderRadius: '0 999px 999px 0',
    '&:hover': { background: 'rgba(124, 106, 247, 0.35)', color: '#fff' },
  }),
  input: base => ({ ...base, color: 'var(--text)' }),
  placeholder: base => ({ ...base, color: 'var(--muted)', fontSize: '0.85rem' }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: base => ({ ...base, color: 'var(--muted)', padding: '0 8px' }),
  clearIndicator: base => ({ ...base, color: 'var(--muted)', '&:hover': { color: 'var(--text)' } }),
  valueContainer: base => ({ ...base, padding: '2px 6px', gap: '2px' }),
}

const DIFFICULTY_COLORS = {
  Beginner: '#34d399',
  Elementary: '#22d3ee',
  Intermediate: '#fbbf24',
  'Upper-Intermediate': '#f97316',
  Advanced: '#f87171',
}

function getDifficultyLabel(level) {
  const n = parseInt(level, 10)
  if (n <= 2) return 'Beginner'
  if (n <= 4) return 'Elementary'
  if (n <= 6) return 'Intermediate'
  if (n <= 8) return 'Upper-Intermediate'
  return 'Advanced'
}

function TermCard({ term, expandSignal }) {
  const [open, setOpen] = useState(false)
  const [playingIdx, setPlayingIdx] = useState(null)
  const audioRef = useRef(null)
  const label = getDifficultyLabel(term.difficultyLevel)
  const color = DIFFICULTY_COLORS[label]
  const voices = term.pronunciationVoices ?? []
  const images = term.images ?? []

  useEffect(() => {
    if (expandSignal.rev > 0) setOpen(expandSignal.value)
  }, [expandSignal.rev])

  useEffect(() => {
    return () => { audioRef.current?.pause() }
  }, [])

  function playVoice(idx) {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (playingIdx === idx) {
      setPlayingIdx(null)
      return
    }
    const audio = new Audio(voices[idx])
    audioRef.current = audio
    setPlayingIdx(idx)
    audio.play().catch(() => setPlayingIdx(null))
    audio.onended = () => setPlayingIdx(null)
    audio.onerror = () => setPlayingIdx(null)
  }

  return (
    <div className="term-card">
      <div className="term-card-body">
        <div className="term-card-accent" style={{ background: color }} />
        <div className="term-card-content">
          <div className="term-card-row1">
            <span className="term-name">{term.term}</span>
            <span className="term-diff-badge" style={{ color, borderColor: color + '55', background: color + '18' }}>
              {label}
            </span>
          </div>

          <div className="term-card-row2">
            {term.pronunciation && <span className="term-ipa">{term.pronunciation}</span>}
            {voices.map((_, i) => (
              <button
                key={i}
                className={`term-voice-btn${playingIdx === i ? ' playing' : ''}`}
                onClick={() => playVoice(i)}
                aria-label={`Play pronunciation${voices.length > 1 ? ` ${i + 1}` : ''}`}
              >
                <FontAwesomeIcon icon={playingIdx === i ? faPause : faPlay} />
                {voices.length > 1 && <span>{i + 1}</span>}
              </button>
            ))}
            {term.partOfSpeech && <span className="term-pos">{term.partOfSpeech}</span>}
          </div>

          {(term.categories?.length ?? 0) > 0 && (
            <div className="term-cats">
              {term.categories.map(c => <span key={c} className="term-cat">{c}</span>)}
            </div>
          )}

          {(term.englishDefinitions?.length ?? 0) > 0 && (
            <p className="term-def">{term.englishDefinitions[0]}</p>
          )}

          {(term.persianTranslation?.length ?? 0) > 0 && (
            <p className="term-fa" dir="rtl">{term.persianTranslation.join(' · ')}</p>
          )}

          {open && (
            <div className="term-details">
              {images.length > 0 && (
                <div className="term-section">
                  <div className="term-section-label">Images</div>
                  <div className="term-images-strip">
                    {images.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt={`${term.term} ${i + 1}`}
                        className="term-image"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {(term.examples?.length ?? 0) > 0 && (
                <div className="term-section">
                  <div className="term-section-label">Examples</div>
                  <ol className="term-examples-list">
                    {term.examples.map((ex, i) => <li key={i}>{ex}</li>)}
                  </ol>
                </div>
              )}

              {((term.synonyms?.length ?? 0) > 0 || (term.antonyms?.length ?? 0) > 0) && (
                <div className="term-syn-ant-row">
                  {(term.synonyms?.length ?? 0) > 0 && (
                    <div className="term-section">
                      <div className="term-section-label">Synonyms</div>
                      <div className="term-word-tags">
                        {term.synonyms.map(s => <span key={s} className="term-syn">{s}</span>)}
                      </div>
                    </div>
                  )}
                  {(term.antonyms?.length ?? 0) > 0 && (
                    <div className="term-section">
                      <div className="term-section-label">Antonyms</div>
                      <div className="term-word-tags">
                        {term.antonyms.map(a => <span key={a} className="term-ant">{a}</span>)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          className="term-toggle-btn"
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Collapse' : 'Expand'}
        >
          <FontAwesomeIcon icon={open ? faChevronUp : faChevronDown} />
        </button>
      </div>
    </div>
  )
}

export default function TermsPage({ show, seasonNum, episodeNum, onBack }) {
  const isMovie = show.type === 'movie'
  const [terms, setTerms] = useState([])
  const [episodeTitle, setEpisodeTitle] = useState('')
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [filterCats, setFilterCats] = useState([])
  const [filterDiffs, setFilterDiffs] = useState([])
  const [sortBy, setSortBy] = useState('alpha-asc')
  const [expandSignal, setExpandSignal] = useState({ value: false, rev: 0 })
  const allExpanded = expandSignal.value && expandSignal.rev > 0

  useEffect(() => {
    setLoading(true)
    const url = isMovie
      ? `${import.meta.env.BASE_URL}api/shows/${show.id}/meta.json`
      : `${import.meta.env.BASE_URL}api/shows/${show.id}/seasons/${seasonNum}/episodes/${episodeNum}/meta.json`
    fetch(url)
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { setTerms(data.terms ?? []); setEpisodeTitle(data.title ?? ''); setLoading(false) })
      .catch(() => setLoading(false))
  }, [show.id, seasonNum, episodeNum])

  const categories = useMemo(() => {
    const s = new Set()
    terms.forEach(t => t.categories?.forEach(c => s.add(c)))
    return [...s].sort()
  }, [terms])

  const visible = useMemo(() => {
    const q = query.toLowerCase().trim()
    const result = terms.filter(t => {
      const matchQ = !q || t.term.toLowerCase().includes(q)
      const matchCat = filterCats.length === 0 || (t.categories ?? []).some(c => filterCats.includes(c))
      const matchDiff = filterDiffs.length === 0 || filterDiffs.includes(getDifficultyLabel(t.difficultyLevel))
      return matchQ && matchCat && matchDiff
    })
    return result.sort((a, b) => {
      if (sortBy === 'alpha-asc') return a.term.localeCompare(b.term)
      if (sortBy === 'alpha-desc') return b.term.localeCompare(a.term)
      const da = parseInt(a.difficultyLevel, 10)
      const db = parseInt(b.difficultyLevel, 10)
      return sortBy === 'diff-asc' ? da - db : db - da
    })
  }, [terms, query, filterCats, filterDiffs, sortBy])

  const hasFilters = query || filterCats.length > 0 || filterDiffs.length > 0

  return (
    <div className="terms-page">
      {/* ── Header ── */}
      <div className="terms-header">
        <div className="terms-header-glow" />
        <div className="terms-header-content">
          <button className="show-page-back" onClick={onBack}>← {show.title}</button>
          {!isMovie && (
            <p className="terms-episode-label">
              Season {seasonNum} · Episode {String(episodeNum).padStart(2, '0')}
            </p>
          )}
          <h1 className="terms-page-title">
            {loading ? <em>{show.title}</em> : (episodeTitle || (isMovie ? show.title : `Episode ${episodeNum}`))}
          </h1>
          <p className="terms-page-subtitle">
            {loading ? 'Loading terms…' : `${terms.length} term${terms.length !== 1 ? 's' : ''}`}
          </p>
        </div>
      </div>

      {/* ── Controls ── */}
      <div className="terms-controls-bar">
        <div className="terms-controls-inner">
          <div className="search-wrap terms-search-wrap">
            <span className="search-icon"><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
            <input
              className="search-input"
              type="text"
              placeholder="Search by term…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Search terms"
            />
          </div>
          <div className="terms-filter-group">
            <Select
              isMulti
              isClearable
              placeholder="All Categories"
              options={categories.map(c => ({ value: c, label: c }))}
              value={filterCats.map(c => ({ value: c, label: c }))}
              onChange={sel => setFilterCats(sel ? sel.map(o => o.value) : [])}
              styles={rsStyles}
              className="terms-rs-wrap"
            />
            <Select
              isMulti
              isClearable
              placeholder="All Difficulties"
              options={DIFFICULTY_ORDER.map(d => ({ value: d, label: d }))}
              value={filterDiffs.map(d => ({ value: d, label: d }))}
              onChange={sel => setFilterDiffs(sel ? sel.map(o => o.value) : [])}
              formatOptionLabel={({ label }) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: DIFFICULTY_COLORS[label], flexShrink: 0, display: 'inline-block' }} />
                  {label}
                </span>
              )}
              styles={rsStyles}
              className="terms-rs-wrap"
            />
            <select className="terms-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="alpha-asc">A → Z</option>
              <option value="alpha-desc">Z → A</option>
              <option value="diff-asc">Easiest First</option>
              <option value="diff-desc">Hardest First</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── List ── */}
      <div className="section">
        <div className="section-inner">
          {loading && <div className="page-loading">Loading vocabulary…</div>}

          {!loading && visible.length === 0 && (
            <div className="no-results">
              <p>{hasFilters ? 'No terms match your filters.' : 'No vocabulary found.'}</p>
              {hasFilters && (
                <button
                  className="terms-clear-btn"
                  onClick={() => { setQuery(''); setFilterCats([]); setFilterDiffs([]) }}
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {!loading && visible.length > 0 && (
            <>
              <div className="terms-result-count">
                <span>
                  {visible.length === terms.length
                    ? `${terms.length} term${terms.length !== 1 ? 's' : ''}`
                    : `${visible.length} of ${terms.length} terms`}
                </span>
                <button
                  className="terms-expand-all-btn"
                  onClick={() => setExpandSignal(s => ({ value: !allExpanded, rev: s.rev + 1 }))}
                  aria-label={allExpanded ? 'Collapse all' : 'Expand all'}
                >
                  <FontAwesomeIcon icon={allExpanded ? faAnglesUp : faAnglesDown} />
                  {allExpanded ? 'Collapse All' : 'Expand All'}
                </button>
              </div>
              <div className="terms-list">
                {visible.map((term, i) => <TermCard key={`${term.term}-${i}`} term={term} expandSignal={expandSignal} />)}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
