import Icon from './Icon.jsx'
import { money } from '../utils.js'

/**
 * Tarjeta de habitación. Todos los textos vienen de la habitación (editables en el admin):
 * name, tag, rating, location, capacity, beds, size, details (showAmenities), price, oldPrice, priceUnit, bookLabel, available
 */
export default function RoomCard({ room, fav, onFav, onOpen, onBook, location, wide = false, preview = false }) {
  const cover = room.images?.[0]
  const loc = room.location?.trim() || location
  const unit = room.priceUnit?.trim() || 'noche'
  const amenities = room.showAmenities ? (room.details || []).slice(0, 3) : []
  const oldPrice = Number(room.oldPrice) > Number(room.price) ? Number(room.oldPrice) : 0
  return (
    <article className={`room-card ${wide ? 'wide' : ''} ${preview ? 'is-preview' : ''}`} onClick={onOpen}>
      <div className="room-card__media">
        {cover ? <img src={cover} alt={room.name} loading="lazy" /> : <div className="img-ph"><Icon name="image" size={32} /></div>}
        <button
          className={`fav-btn ${fav ? 'on' : ''}`}
          aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          onClick={(e) => { e.stopPropagation(); onFav?.() }}
        >
          <Icon name="heart" size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
        {!room.available
          ? <span className="badge badge--off">No disponible</span>
          : room.tag?.trim() && <span className="badge badge--tag">{room.tag}</span>}
        {room.images?.length > 1 && <span className="badge badge--count"><Icon name="image" size={13} /> {room.images.length}</span>}
      </div>
      <div className="room-card__body">
        <div className="row-between">
          <h3>{room.name || 'Nombre de la habitación'}</h3>
          {room.rating ? <span className="rating"><Icon name="star" size={14} fill="currentColor" /> {Number(room.rating).toFixed(1)}</span> : null}
        </div>
        {loc && <p className="muted small with-icon"><Icon name="pin" size={14} /> {loc}</p>}
        <div className="chips-mini">
          {room.capacity ? <span><Icon name="users" size={13} /> {room.capacity} pers.</span> : null}
          {room.beds && <span><Icon name="bed" size={13} /> {room.beds}</span>}
          {room.size && <span><Icon name="ruler" size={13} /> {room.size}</span>}
          {amenities.map((a) => <span key={a} className="amen"><Icon name="check" size={13} /> {a}</span>)}
        </div>
        <div className="room-card__foot">
          <div>
            {oldPrice > 0 && <s className="old-price">{money(oldPrice)}</s>}
            <p className="price">{money(room.price)}<small>/{unit}</small></p>
          </div>
          <button
            className="btn btn--primary btn--sm"
            disabled={!room.available}
            onClick={(e) => { e.stopPropagation(); onBook?.() }}
          >
            <Icon name="calendar" size={16} /> {room.bookLabel?.trim() || 'Reservar'}
          </button>
        </div>
      </div>
    </article>
  )
}
