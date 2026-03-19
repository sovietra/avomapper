import { useState, useEffect, useRef } from 'react'

const HISTORY_KEY = 'avomapper_history'
const MAX_HISTORY = 8

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') } catch { return [] }
}

function saveToHistory(place) {
  const hist = loadHistory().filter(h => h.id !== place.id)
  hist.unshift(place)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(0, MAX_HISTORY)))
}

export default function SearchBar({ onSelectPlace }) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [history, setHistory] = useState(loadHistory)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const wrapperRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced live search
  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim()) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=6&addressdetails=1`
        )
        const data = await res.json()
        setSuggestions(data.map(item => ({
          id: item.place_id,
          name: item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          type: item.type,
        })))
      } catch { setSuggestions([]) }
      setLoading(false)
    }, 300)
  }, [query])

  const handleSelect = (place) => {
    setQuery(place.name)
    setSuggestions([])
    setOpen(false)
    saveToHistory(place)
    setHistory(loadHistory())
    onSelectPlace(place)
  }

  const clearHistory = (e) => {
    e.stopPropagation()
    localStorage.removeItem(HISTORY_KEY)
    setHistory([])
  }

  const showHistory = open && !query.trim() && history.length > 0
  const showSuggestions = open && suggestions.length > 0
  const showDropdown = showHistory || showSuggestions || (open && loading)

  return (
    <div className="search-container" ref={wrapperRef}>
      <div style={{ position: 'relative' }}>
        <input
          className="search-input"
          type="text"
          placeholder="Search any location worldwide..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
        />
        {query && (
          <button
            className="search-clear-btn"
            type="button"
            onClick={() => { setQuery(''); setSuggestions([]); setOpen(true) }}
          >✕</button>
        )}
        <button className="search-btn" type="button" onClick={() => {
          if (suggestions.length > 0) handleSelect(suggestions[0])
        }}>⌕</button>
      </div>

      {showDropdown && (
        <div className="autocomplete-dropdown">
          {loading && (
            <div className="autocomplete-loading">Searching...</div>
          )}

          {showSuggestions && suggestions.map(s => (
            <div key={s.id} className="autocomplete-item" onMouseDown={() => handleSelect(s)}>
              <span className="autocomplete-icon">📍</span>
              <div>
                <div className="search-result-name">{s.name}</div>
                <div className="autocomplete-sub">{s.address.substring(0, 55)}{s.address.length > 55 ? '…' : ''}</div>
              </div>
            </div>
          ))}

          {showHistory && (
            <>
              <div className="autocomplete-section-label">
                Recent Searches
                <button className="history-clear-btn" onMouseDown={clearHistory}>Clear</button>
              </div>
              {history.map(h => (
                <div key={h.id} className="autocomplete-item" onMouseDown={() => handleSelect(h)}>
                  <span className="autocomplete-icon">🕐</span>
                  <div>
                    <div className="search-result-name">{h.name}</div>
                    <div className="autocomplete-sub">{h.address?.substring(0, 55)}{(h.address?.length || 0) > 55 ? '…' : ''}</div>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
