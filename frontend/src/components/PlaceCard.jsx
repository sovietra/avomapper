export default function PlaceCard({ place, onClick, selected }) {
  return (
    <div
      className="place-card"
      onClick={onClick}
      style={selected ? { borderLeftColor: 'var(--gold)', background: '#1e1e1e' } : {}}
    >
      <div className="place-card-name">{place.name}</div>
      <div className="place-card-type">{place.type}</div>
      <div className="place-card-address">{place.address}</div>
    </div>
  )
}
