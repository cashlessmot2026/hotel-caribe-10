import { useMemo, useState } from 'react'
import Icon, { WhatsAppIcon } from './Icon.jsx'
import { useData } from '../store.jsx'
import { money, openWhatsApp } from '../utils.js'

export default function Restaurant() {
  const { data } = useData()
  const [q, setQ] = useState('')
  const items = data.restaurant.items || []

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
        <h1>{data.restaurant.title || 'Restaurante'}</h1>
      </header>
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
      <button
        className="btn btn--wa btn--block btn--lg"
        onClick={() => openWhatsApp(data.hotel.whatsapp, `¡Hola! 👋 Quiero hacer un pedido del restaurante de ${data.hotel.name}:\n\n`)}
      >
        <WhatsAppIcon /> Pedir por WhatsApp
      </button>
    </div>
  )
}
