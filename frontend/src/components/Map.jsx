import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

const goldIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

const greenIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41]
})

function makeCarIcon(heading = 0) {
  return L.divIcon({
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    html: `<div class="car-icon-wrap" style="transform:rotate(${heading}deg)">
      <svg viewBox="0 0 40 56" width="40" height="40" xmlns="http://www.w3.org/2000/svg">
        <!-- Shadow -->
        <ellipse cx="20" cy="50" rx="12" ry="4" fill="rgba(0,0,0,0.3)"/>
        <!-- Body -->
        <rect x="6" y="12" width="28" height="34" rx="6" fill="#d4af37"/>
        <!-- Roof -->
        <rect x="10" y="18" width="20" height="16" rx="3" fill="#b8960f"/>
        <!-- Windshield front -->
        <rect x="11" y="14" width="18" height="10" rx="2" fill="#1a2a2a" opacity="0.85"/>
        <!-- Rear window -->
        <rect x="11" y="28" width="18" height="8" rx="2" fill="#1a2a2a" opacity="0.6"/>
        <!-- Headlights -->
        <rect x="7"  y="10" width="7" height="4" rx="2" fill="#fffde0"/>
        <rect x="26" y="10" width="7" height="4" rx="2" fill="#fffde0"/>
        <!-- Taillights -->
        <rect x="7"  y="43" width="7" height="4" rx="2" fill="#c41e3a"/>
        <rect x="26" y="43" width="7" height="4" rx="2" fill="#c41e3a"/>
        <!-- Direction arrow at top -->
        <polygon points="20,0 14,12 26,12" fill="#6b7868"/>
      </svg>
    </div>`,
  })
}

// Auto-pan to car when navigating
function NavFollower({ userLocation, navMode }) {
  const map = useMap()
  const prevRef = useRef(null)

  useEffect(() => {
    if (!navMode || !userLocation) return
    const { lat, lng, heading } = userLocation

    // Animate to new position
    map.setView([lat, lng], 17, { animate: true, duration: 0.8 })

    prevRef.current = { lat, lng }
  }, [userLocation, navMode])

  return null
}

// Fit to route bounds when route first loads
function MapUpdater({ center, zoom, routeCoords, navMode }) {
  const map = useMap()

  useEffect(() => {
    if (navMode) return // NavFollower handles it
    if (routeCoords && routeCoords.length > 1) {
      map.fitBounds(routeCoords, { padding: [40, 40], animate: true })
    } else {
      map.setView(center, zoom, { animate: true })
    }
  }, [center, zoom, routeCoords])

  return null
}

function MouseTracker({ onMouseMove, onZoomChange }) {
  useMapEvents({
    mousemove(e) { onMouseMove(e.latlng.lat, e.latlng.lng) },
    zoom(e)     { onZoomChange && onZoomChange(e.target.getZoom()) },
  })
  return null
}

// Applies/removes 'satellite-mode' class directly on the Leaflet container div
// because MapContainer ignores className changes after first mount
function LayerClassApplier({ mapLayer }) {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    if (mapLayer === 'satellite') {
      el.classList.add('satellite-mode')
    } else {
      el.classList.remove('satellite-mode')
    }
  }, [mapLayer, map])
  return null
}

const TILE_LAYERS = {
  standard: {
    layers: [
      {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ],
  },
  satellite: {
    layers: [
      // High-res satellite base (ESRI World Imagery)
      {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
      },
      // Road + label overlay on top (CartoDB — free, no key)
      {
        url: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://carto.com">CARTO</a>',
        pane: 'shadowPane',
      },
    ],
  },
}

export default function Map({
  center, zoom, selectedPlace, onMouseMove, onZoomChange,
  places, onPlaceClick, routeData,
  userLocation, navMode, travelledCoords, mapLayer = 'standard',
  mapRef,
}) {
  const carIcon = userLocation ? makeCarIcon(userLocation.heading || 0) : null
  const { layers } = TILE_LAYERS[mapLayer] || TILE_LAYERS.standard

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      zoomControl={true}
      minZoom={0}
      ref={mapRef}
    >
      {layers.map((l, i) => (
        <TileLayer key={`${mapLayer}-${i}`} attribution={l.attribution} url={l.url} />
      ))}
      <LayerClassApplier mapLayer={mapLayer} />

      <MapUpdater center={center} zoom={zoom} routeCoords={routeData?.coords} navMode={navMode} />
      <NavFollower userLocation={userLocation} navMode={navMode} />
      <MouseTracker onMouseMove={onMouseMove} onZoomChange={onZoomChange} />

      {/* ── ROUTE LINES ── */}
      {routeData?.coords && (
        <>
          {/* Full route shadow */}
          <Polyline positions={routeData.coords} pathOptions={{ color: '#000', weight: 7, opacity: 0.3 }} />
          {/* Remaining route */}
          <Polyline positions={routeData.coords} pathOptions={{ color: '#6b7868', weight: 5, opacity: 0.9 }} />
          {/* Travelled portion (dim) */}
          {travelledCoords && travelledCoords.length > 1 && (
            <Polyline positions={travelledCoords} pathOptions={{ color: '#3a4a38', weight: 5, opacity: 0.7 }} />
          )}
          {/* Destination pin */}
          <Marker position={[routeData.to.lat, routeData.to.lng]} icon={redIcon}>
            <Popup>
              <div style={{ fontFamily: 'Inter, sans-serif' }}>
                <strong>Destination</strong>
                <p style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{routeData.to.name}</p>
              </div>
            </Popup>
          </Marker>
          {/* Start pin (hide when navigating — car is there) */}
          {!navMode && (
            <Marker position={[routeData.from.lat, routeData.from.lng]} icon={greenIcon}>
              <Popup>
                <div style={{ fontFamily: 'Inter, sans-serif' }}>
                  <strong>Start</strong>
                  <p style={{ fontSize: 12, color: '#444', marginTop: 4 }}>{routeData.from.name}</p>
                </div>
              </Popup>
            </Marker>
          )}
        </>
      )}

      {/* ── CAR MARKER ── */}
      {userLocation && carIcon && (
        <Marker position={[userLocation.lat, userLocation.lng]} icon={carIcon} zIndexOffset={1000} />
      )}

      {/* ── LANDMARK MARKERS ── */}
      {!routeData && places.map(place => (
        <Marker
          key={place.id}
          position={[place.lat, place.lng]}
          icon={selectedPlace?.id === place.id ? goldIcon : redIcon}
          eventHandlers={{ click: () => onPlaceClick(place) }}
        >
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{place.name}</strong>
              <span style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: 1 }}>{place.type}</span>
              <p style={{ marginTop: 6, fontSize: 12, color: '#444' }}>{place.address}</p>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* ── SEARCH RESULT ── */}
      {!routeData && selectedPlace && !places.find(p => p.id === selectedPlace.id) && (
        <Marker position={[selectedPlace.lat, selectedPlace.lng]} icon={goldIcon}>
          <Popup>
            <div style={{ fontFamily: 'Inter, sans-serif', minWidth: 160 }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>{selectedPlace.name}</strong>
              <p style={{ marginTop: 6, fontSize: 12, color: '#444' }}>{selectedPlace.address}</p>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  )
}
