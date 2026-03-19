import { useState, useEffect, useRef } from 'react'

const MODES = [
  { id: 'driving', label: 'Drive', icon: '🚗', profile: 'car' },
  { id: 'walking', label: 'Walk', icon: '🚶', profile: 'foot' },
  { id: 'cycling', label: 'Bike', icon: '🚴', profile: 'bike' },
]

function useLocationAutocomplete() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selected, setSelected] = useState(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!query.trim() || selected) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`
        )
        const data = await res.json()
        setSuggestions(data.map(item => ({
          id: item.place_id,
          name: item.display_name.split(',')[0],
          address: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
        })))
      } catch { setSuggestions([]) }
      setLoading(false)
    }, 300)
  }, [query, selected])

  const pick = (place) => {
    setQuery(place.name)
    setSelected(place)
    setSuggestions([])
    setOpen(false)
  }

  const clear = () => {
    setQuery('')
    setSelected(null)
    setSuggestions([])
  }

  return { query, setQuery, suggestions, selected, open, setOpen, loading, pick, clear }
}

function LocationInput({ placeholder, dot, value: hook }) {
  const wrapRef = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) hook.setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const showDropdown = hook.open && (hook.suggestions.length > 0 || hook.loading)

  return (
    <div className="route-input-wrapper" ref={wrapRef} style={{ position: 'relative' }}>
      <div className={`route-dot ${dot}`}></div>
      <div style={{ flex: 1, position: 'relative' }}>
        <input
          className="route-input"
          type="text"
          placeholder={placeholder}
          value={hook.query}
          onChange={e => { hook.setQuery(e.target.value); hook.setOpen(true); if (hook.selected) hook.clear() }}
          onFocus={() => hook.setOpen(true)}
          autoComplete="off"
          style={{ width: '100%', paddingRight: hook.query ? 24 : 8 }}
        />
        {hook.query && (
          <button
            type="button"
            onMouseDown={hook.clear}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--cream-dim)', cursor: 'pointer', fontSize: 12, padding: 0
            }}
          >✕</button>
        )}
        {showDropdown && (
          <div className="autocomplete-dropdown" style={{ top: '100%', marginTop: 2 }}>
            {hook.loading && <div className="autocomplete-loading">Searching...</div>}
            {hook.suggestions.map(s => (
              <div key={s.id} className="autocomplete-item" onMouseDown={() => hook.pick(s)}>
                <span className="autocomplete-icon">📍</span>
                <div>
                  <div className="search-result-name">{s.name}</div>
                  <div className="autocomplete-sub">{s.address.substring(0, 50)}{s.address.length > 50 ? '…' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RoutePanel({ onRouteResult, onClearRoute, onStartNav, onStopNav, navMode }) {
  const from = useLocationAutocomplete()
  const to = useLocationAutocomplete()
  const [mode, setMode] = useState('driving')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const canRoute = from.selected && to.selected

  const calculate = async () => {
    if (!canRoute) return
    setLoading(true)
    setError(null)
    setResult(null)

    const profile = MODES.find(m => m.id === mode)?.profile || 'car'
    const url = `https://router.project-osrm.org/route/v1/${profile}/` +
      `${from.selected.lng},${from.selected.lat};${to.selected.lng},${to.selected.lat}` +
      `?overview=full&geometries=geojson&steps=false`

    try {
      const res = await fetch(url)
      const data = await res.json()
      if (data.code !== 'Ok') throw new Error('No route found')

      const route = data.routes[0]
      const distKm = (route.distance / 1000).toFixed(1)
      const mins = Math.round(route.duration / 60)
      const hours = Math.floor(mins / 60)
      const remMins = mins % 60
      const timeStr = hours > 0 ? `${hours}h ${remMins}m` : `${mins} min`

      // GeoJSON coords are [lng, lat] — flip to [lat, lng] for Leaflet
      const coords = route.geometry.coordinates.map(([lng, lat]) => [lat, lng])

      const routeResult = {
        coords,
        distKm,
        timeStr,
        from: from.selected,
        to: to.selected,
      }
      setResult(routeResult)
      onRouteResult(routeResult)
    } catch (e) {
      setError('Could not find a route between these locations.')
    }
    setLoading(false)
  }

  const clear = () => {
    from.clear()
    to.clear()
    setResult(null)
    setError(null)
    onClearRoute()
  }

  return (
    <div className="route-input-group">
      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        {MODES.map(m => (
          <button
            key={m.id}
            type="button"
            className={`mode-btn ${mode === m.id ? 'active' : ''}`}
            onClick={() => { setMode(m.id); setResult(null) }}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </div>

      <LocationInput placeholder="From — any city or address..." dot="start" value={from} />
      <LocationInput placeholder="To — any city or address..." dot="end" value={to} />

      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
        <button
          className="route-btn"
          onClick={calculate}
          disabled={!canRoute || loading}
          style={{ flex: 1, opacity: canRoute ? 1 : 0.5 }}
        >
          {loading ? 'Routing...' : 'Get Directions'}
        </button>
        {(from.query || to.query || result) && (
          <button className="route-btn" onClick={clear} style={{ width: 40, padding: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
            ✕
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 8, padding: '8px 10px', background: '#0f130e', border: '1px solid #3a4a38', fontSize: 12, color: '#a0b89e' }}>
          {error}
        </div>
      )}

      {result && (
        <div className="route-result">
          <div className="route-result-time">{result.timeStr}</div>
          <div className="route-result-dist">{result.distKm} km · {mode}</div>
          <div className="route-result-places">
            <span style={{ color: 'var(--gold)' }}>▶</span> {result.from.name}
            <span style={{ color: 'var(--cream-dim)', margin: '0 6px' }}>→</span>
            <span style={{ color: 'var(--red)' }}>▶</span> {result.to.name}
          </div>
          <button
            className="route-btn nav-start-btn"
            style={{ marginTop: 10, background: navMode ? '#3a4a38' : 'var(--red)' }}
            onClick={() => navMode ? onStopNav() : onStartNav()}
          >
            {navMode ? '■ Stop Navigation' : '▶ Start Navigation'}
          </button>
        </div>
      )}
    </div>
  )
}
