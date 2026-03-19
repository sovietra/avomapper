import { useState, useRef, useCallback } from 'react'
import './App.css'
import Map from './components/Map'
import GlobeView from './components/GlobeView'
import SearchBar from './components/SearchBar'
import RoutePanel from './components/RoutePanel'
import PlaceCard from './components/PlaceCard'

const SAMPLE_PLACES = [
  { id: 1, name: 'Red Square', type: 'Landmark', address: 'Red Square, Moscow, Russia', lat: 55.7539, lng: 37.6208 },
  { id: 2, name: 'Kremlin', type: 'Government', address: 'Kremlin, Moscow, Russia', lat: 55.7520, lng: 37.6175 },
  { id: 3, name: 'Bolshoi Theatre', type: 'Culture', address: 'Theatre Square 1, Moscow, Russia', lat: 55.7601, lng: 37.6185 },
]

// Haversine distance in meters between two lat/lng points
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Compass bearing from point A to point B (degrees)
function bearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Find the index of the nearest route coord to a given position
function nearestRouteIndex(coords, lat, lng) {
  let best = 0, bestDist = Infinity
  for (let i = 0; i < coords.length; i++) {
    const d = haversine(lat, lng, coords[i][0], coords[i][1])
    if (d < bestDist) { bestDist = d; best = i }
  }
  return best
}

// Sum route distance from index onwards (metres)
function remainingDist(coords, fromIdx) {
  let d = 0
  for (let i = fromIdx; i < coords.length - 1; i++) {
    d += haversine(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1])
  }
  return d
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.round((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

export default function App() {
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [mapCenter, setMapCenter] = useState([48.8566, 2.3522])
  const [mapZoom, setMapZoom] = useState(5)
  const [coords, setCoords] = useState({ lat: 48.8566, lng: 2.3522 })
  const [routeData, setRouteData] = useState(null)
  const [notification, setNotification] = useState(null)
  const [mapLayer, setMapLayer] = useState('standard')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Navigation state
  const [currentZoom, setCurrentZoom] = useState(5)
  const showGlobe = currentZoom <= 1
  const mapRef = useRef(null)

  const [navMode, setNavMode] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [travelledCoords, setTravelledCoords] = useState([])
  const [navStats, setNavStats] = useState(null) // { remainKm, remainTime, speedKmh }
  const watchIdRef = useRef(null)
  const prevPosRef = useRef(null)
  const totalRouteSeconds = useRef(0)

  const showNotification = (msg) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const handleSelectPlace = (place) => {
    setSelectedPlace(place)
    setMapCenter([place.lat, place.lng])
    setMapZoom(14)
    setSidebarOpen(false)
  }

  const handleMouseMove = (lat, lng) => {
    setCoords({ lat: lat.toFixed(5), lng: lng.toFixed(5) })
  }

  const handleRouteResult = (result) => {
    setRouteData(result)
    setNavMode(false)
    setTravelledCoords([])
    setNavStats(null)
    // Store total seconds based on original distKm (avg 50 km/h driving)
    totalRouteSeconds.current = (result.distKm / 50) * 3600
    showNotification(`Route found: ${result.timeStr} · ${result.distKm} km`)
  }

  const handleClearRoute = () => {
    stopNavigation()
    setRouteData(null)
    setNavStats(null)
  }

  const stopNavigation = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setNavMode(false)
    setUserLocation(null)
    setTravelledCoords([])
    setNavStats(null)
  }, [])

  const startNavigation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      showNotification('Geolocation not supported by your browser.')
      return
    }

    setNavMode(true)
    setSidebarOpen(false)
    setTravelledCoords([])

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, heading: rawHeading, speed } = pos.coords

        // Calculate heading from movement if device doesn't provide it
        let head = rawHeading
        if ((head === null || head === undefined) && prevPosRef.current) {
          head = bearing(prevPosRef.current.lat, prevPosRef.current.lng, lat, lng)
        }
        head = head || 0

        const loc = { lat, lng, heading: head, speed: speed || 0 }
        setUserLocation(loc)
        prevPosRef.current = loc

        // Update travelled path
        setTravelledCoords(prev => {
          const next = [...prev, [lat, lng]]
          return next.slice(-500) // keep last 500 points
        })

        // Update remaining distance + ETA
        if (routeData?.coords) {
          const idx = nearestRouteIndex(routeData.coords, lat, lng)
          const remMetres = remainingDist(routeData.coords, idx)
          const remKm = (remMetres / 1000).toFixed(1)

          // ETA: use speed if available, otherwise assume 50 km/h
          const speedMs = speed > 0.5 ? speed : (50 / 3.6)
          const remSec = remMetres / speedMs
          const speedKmh = Math.round((speed || 0) * 3.6)

          setNavStats({
            remainKm: remKm,
            remainTime: formatTime(remSec),
            speedKmh,
          })

          // Arrived check: within 50m of destination
          const distToDest = haversine(lat, lng, routeData.to.lat, routeData.to.lng)
          if (distToDest < 50) {
            showNotification('You have arrived at your destination!')
            stopNavigation()
          }
        }
      },
      (err) => {
        const msgs = {
          1: 'Location permission denied. Please allow location access.',
          2: 'Location unavailable. Check GPS signal.',
          3: 'Location request timed out.',
        }
        showNotification(msgs[err.code] || 'Could not get location.')
        setNavMode(false)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    )
  }, [routeData, stopNavigation])

  return (
    <div className="app">
      {/* HEADER */}
      <header className="header">
        <button className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Menu">
          {sidebarOpen ? '✕' : '☰'}
        </button>
        <a className="logo" href="#">
          <img src="/home.png" alt="AvoMapper" className="logo-img" />
          <span className="logo-text">Avo<span>MAPPER</span></span>
        </a>
        {navMode && (
          <button className="nav-stop-header-btn" onClick={stopNavigation}>
            ■ End
          </button>
        )}
      </header>

      <div className="main">
        {/* Mobile overlay */}
        <div
          className={`sidebar-overlay ${sidebarOpen ? 'visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* SIDEBAR */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-header">
            <div className="sidebar-section-title">Search</div>
            <SearchBar onSelectPlace={handleSelectPlace} />
          </div>

          <div className="route-panel">
            <div className="sidebar-section-title" style={{ marginBottom: 10 }}>Directions</div>
            <RoutePanel
              onRouteResult={handleRouteResult}
              onClearRoute={handleClearRoute}
              onStartNav={startNavigation}
              onStopNav={stopNavigation}
              navMode={navMode}
            />
          </div>

          <div className="sidebar-content">
            <div className="sidebar-section-title">Landmarks</div>
            {SAMPLE_PLACES.map(place => (
              <PlaceCard
                key={place.id}
                place={place}
                onClick={() => handleSelectPlace(place)}
                selected={selectedPlace?.id === place.id}
              />
            ))}
          </div>
        </aside>

        {/* MAP */}
        <div className="map-wrapper">
          {/* 3D Globe — shown when zoomed all the way out */}
          <GlobeView
            visible={showGlobe}
            onZoomIn={() => {
              setMapZoom(4)
              setCurrentZoom(4)
            }}
          />

          <Map
            center={mapCenter}
            zoom={mapZoom}
            selectedPlace={selectedPlace}
            onMouseMove={handleMouseMove}
            onZoomChange={setCurrentZoom}
            places={SAMPLE_PLACES}
            onPlaceClick={handleSelectPlace}
            routeData={routeData}
            userLocation={userLocation}
            navMode={navMode}
            travelledCoords={travelledCoords}
            mapLayer={mapLayer}
            mapRef={mapRef}
          />


          {!navMode && !showGlobe && (
            <div className="map-controls">
              <button
                className={`map-control-btn ${mapLayer === 'standard' ? 'active' : ''}`}
                onClick={() => setMapLayer('standard')}
              >Standard</button>
              <button
                className={`map-control-btn ${mapLayer === 'satellite' ? 'active' : ''}`}
                onClick={() => setMapLayer('satellite')}
              >Satellite</button>
            </div>
          )}

          <div className="coords-display">
            LAT {coords.lat} · LNG {coords.lng}
          </div>

          {/* Navigation HUD */}
          {navMode && navStats ? (
            <div className="nav-hud">
              <div className="nav-hud-time">{navStats.remainTime}</div>
              <div className="nav-hud-row">
                <span className="nav-hud-dist">{navStats.remainKm} km remaining</span>
                {navStats.speedKmh > 0 && (
                  <span className="nav-hud-speed">{navStats.speedKmh} km/h</span>
                )}
              </div>
              <div className="nav-hud-dest">▶ {routeData?.to?.name}</div>
            </div>
          ) : routeData && !navMode ? (
            <div className="route-banner">
              <span className="route-banner-time">{routeData.timeStr}</span>
              <span className="route-banner-sep">·</span>
              <span className="route-banner-dist">{routeData.distKm} km</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* STATUS BAR */}
      <footer className="status-bar">
        <div className="status-item">
          <div className="status-dot active"></div>
          <span>OSM CONNECTED</span>
        </div>
        {navMode && (
          <div className="status-item">
            <div className="status-dot active" style={{ background: '#d4af37' }}></div>
            <span>NAVIGATING</span>
          </div>
        )}
        <div style={{ marginLeft: 'auto', fontFamily: "'Oswald', sans-serif", letterSpacing: 2, color: 'var(--red)', fontSize: 11 }}>
          AVOMAPPER v1.0
        </div>
      </footer>

      {notification && (
        <div className="notification">{notification}</div>
      )}
    </div>
  )
}
