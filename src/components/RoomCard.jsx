import Icon from './Icon.jsx'
import { money } from '../utils.js'

export default function RoomCard({ room, fav, onFav, onOpen, onBook, location, wide = false }) {
  const cover = room.images?.[0]
  return (
    <article className={`room-card ${wide ? 'wide' : ''}`} onClick={onOpen}>
      <div className="room-card__media">
        {cover ? <img src={cover} alt={room.name} loading="lazy" /> : <div className="img-ph"><Icon name="image" size={32} /></div>}
        <button
          className={`fav-btn ${fav ? 'on' : ''}`}
          aria-label={fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}
          onClick={(e) => { e.stopPropagation(); onFav() }}
        >
          <Icon name="heart" size={18} fill={fav ? 'currentColor' : 'none'} />
        </button>
        {!room.available && <span className="badge badge--off">No disponible</span>}
        {room.images?.length > 1 && <span className="badge badge--count"><Icon name="image" size={13} /> {room.images.length}</span>}
      </div>
      <div className="room-card__body">
        <div className="row-between">
          <h3>{room.name}</h3>
          {room.rating ? <span className="rating"><Icon name="star" size={14} fill="currentColor" /> {Number(room.rating).toFixed(1)}</span> : null}
        </div>
        <p className="muted small with-icon"><Icon name="pin" size={14} /> {location}</p>
        <div className="chips-mini">
          <span><Icon name="users" size={13} /> {room.capacity} pers.</span>
          {room.beds && <span><Icon name="bed" size={13} /> {room.beds}</span>}
        </div>
        <div className="room-card__foot">
          <p className="price">{money(room.price)}<small>/noche</small></p>
          <button
            className="btn btn--primary btn--sm"
            disabled={!room.available}
            onClick={(e) => { e.stopPropagation(); onBook() }}
          >
            <Icon name="calendar" size={16} /> Reservar
          </button>
        </div>
      </div>
    </article>
  )
}
