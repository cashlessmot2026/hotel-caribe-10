import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { useData } from '../store.jsx'
import { money } from '../utils.js'

export default function RoomDetail({ room, fav, onFav, onBack, onBook }) {
  const { data } = useData()
  const [idx, setIdx] = useState(0)
  const [more, setMore] = useState(false)
  const imgs = room.images?.length ? room.images : []
  const payments = data.payments.filter((p) => p.enabled)

  useEffect(() => { window.scrollTo(0, 0) }, [room.id])

  return (
    <div className="detail">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button>
        <h2>Detalle</h2>
        <button className={`icon-btn ${fav ? 'fav-on' : ''}`} onClick={onFav} aria-label="Favorito">
          <Icon name="heart" fill={fav ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="detail__layout">
        <div>
          <div className="hero-img">
            {imgs[idx] ? <img src={imgs[idx]} alt={room.name} /> : <div className="img-ph"><Icon name="image" size={40} /></div>}
            {imgs.length > 1 && (
              <>
                <button className="nav-arrow left" onClick={() => setIdx((idx - 1 + imgs.length) % imgs.length)} aria-label="Anterior"><Icon name="back" /></button>
                <button className="nav-arrow right" onClick={() => setIdx((idx + 1) % imgs.length)} aria-label="Siguiente"><Icon name="back" /></button>
                <span className="badge badge--count">{idx + 1}/{imgs.length}</span>
              </>
            )}
          </div>
          {imgs.length > 1 && (
            <div className="thumbs">
              {imgs.map((src, i) => (
                <button key={i} className={i === idx ? 'on' : ''} onClick={() => setIdx(i)} aria-label={`Foto ${i + 1}`}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="detail__info">
          <div className="facilities">
            <span><Icon name="users" size={16} /> {room.capacity} personas</span>
            {room.beds && <span><Icon name="bed" size={16} /> {room.beds}</span>}
            {room.size && <span><Icon name="ruler" size={16} /> {room.size}</span>}
            {room.rating ? <span><Icon name="star" size={16} fill="currentColor" className="gold" /> {Number(room.rating).toFixed(1)}</span> : null}
          </div>

          <div className="row-between">
            <h1 className="detail__title">{room.name}</h1>
            <p className="price lg">{money(room.price)}<small>/noche</small></p>
          </div>
          <p className="muted with-icon"><Icon name="pin" size={16} /> {data.hotel.location}</p>

          <h3 className="section-label">Descripción</h3>
          <p className={`desc ${more ? 'open' : ''}`}>{room.description}</p>
          {room.description?.length > 160 && (
            <button className="link-btn" onClick={() => setMore(!more)}>{more ? 'Ver menos' : 'Leer más…'}</button>
          )}

          {room.details?.length > 0 && (
            <>
              <h3 className="section-label">Comodidades</h3>
              <div className="amenities">
                {room.details.map((d) => <span key={d}><Icon name="check" size={15} /> {d}</span>)}
              </div>
            </>
          )}

          {payments.length > 0 && (
            <>
              <h3 className="section-label">Medios de pago</h3>
              <div className="pay-list">
                {payments.map((p) => (
                  <div key={p.id}><Icon name="card" size={18} /><div><strong>{p.name}</strong>{p.details && <small>{p.details}</small>}</div></div>
                ))}
              </div>
            </>
          )}
          <div className="detail__cta-desktop">
            <button className="btn btn--primary btn--lg btn--block" disabled={!room.available} onClick={onBook}>
              <Icon name="calendar" /> {room.available ? 'Reservar ahora' : 'No disponible'}
            </button>
          </div>
        </div>
      </div>

      <div className="bottom-cta">
        <div>
          <small className="muted">Precio</small>
          <p className="price">{money(room.price)}<small>/noche</small></p>
        </div>
        <button className="btn btn--primary btn--lg" disabled={!room.available} onClick={onBook}>
          {room.available ? 'Reservar ahora' : 'No disponible'}
        </button>
      </div>
    </div>
  )
}
