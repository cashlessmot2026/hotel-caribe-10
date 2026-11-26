import { useMemo, useState } from 'react'
import Icon, { WhatsAppIcon } from './Icon.jsx'
import { useData } from '../store.jsx'
import { money, openWhatsApp } from '../utils.js'

export default function Restaurant() {
  const { data } = useData()
  const rest = data.restaurant
  const [q, setQ] = useState('')
  const items = rest.items || []
  const images = rest.images || []
  const phones = (rest.phones || []).filter((p) => p.trim())
  const orderTo = rest.whatsapp || phones[0] || data.hotel.whatsapp
  const mapsUrl = rest.mapsUrl || (rest.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(rest.address + ' ' + (data.hotel.location || ''))}` : '')

  const groups = useMemo(() => {
    const f = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()))
    return f.reduce((acc, it) => {
      const c = it.category || 'Carta'
      ;(acc[c] = acc[c] || []).push(it)
      return acc
    }, {})
  }, [items, q])

  return (
    <div className="page">
      <header className="page-head">
        <p className="eyebrow">Sabor del Caribe</p>
        <h1>{rest.title || 'Restaurante'}</h1>
        {rest.description && <p className="muted">{rest.description}</p>}
      </header>

      {images.length > 0 && (
        <div className="gallery">
          {images.map((src, i) => <img key={i} src={src} alt={rest.title || 'Restaurante'} loading="lazy" />)}
        </div>
      )}

      {(rest.address || rest.hours || phones.length > 0) && (
        <section className="place-card">
          {rest.address && (
            <div className="place-card__row">
              <Icon name="pin" className="brand" />
              <div className="grow"><strong>{rest.address}</strong><small className="muted">Fuera del hotel</small></div>
              {mapsUrl && <a className="btn btn--soft btn--sm" href={mapsUrl} target="_blank" rel="noreferrer">Cómo llegar</a>}
            </div>
          )}
          {rest.hours && (
            <div className="place-card__row">
              <Icon name="clock" className="brand" />
              <div className="grow"><strong>{rest.hours}</strong><small className="muted">Horario</small></div>
            </div>
          )}
          {phones.map((ph, i) => (
            <div key={i} className="place-card__row">
              <Icon name="phone" className="brand" />
              <div className="grow"><strong>{ph}</strong><small className="muted">Teléfono</small></div>
              <a className="icon-btn sm" href={`tel:${ph.replace(/[^\d+]/g, '')}`} aria-label={`Llamar al ${ph}`}><Icon name="phone" size={16} /></a>
              <button className="icon-btn sm wa" onClick={() => openWhatsApp(ph, `¡Hola! 👋 Te escribo desde ${data.hotel.name}.`)} aria-label={`WhatsApp ${ph}`}><WhatsAppIcon size={16} /></button>
            </div>
          ))}
        </section>
      )}

      {items.length > 0 && (
        <>
          <div className="search">
            <Icon name="search" />
            <input placeholder="Buscar en la carta…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {Object.keys(groups).length === 0 && <p className="muted center pad">No hay productos que coincidan.</p>}
          {Object.entries(groups).map(([cat, list]) => (
            <section key={cat} className="menu-group">
              <h3 className="section-label">{cat}</h3>
              <ul className="menu-list">
                {list.map((it) => (
                  <li key={it.id}>
                    <span>{it.name}</span>
                    <i />
                    <strong>{money(it.price)}</strong>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      <button
        className="btn btn--wa btn--block btn--lg"
        onClick={() => openWhatsApp(orderTo, `¡Hola! 👋 Quiero hacer un pedido en ${rest.title || 'el restaurante'} (vengo de ${data.hotel.name}):\n\n`)}
      >
        <WhatsAppIcon /> Pedir por WhatsApp
      </button>
    </div>
  )
}
