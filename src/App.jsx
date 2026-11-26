import { useEffect, useMemo, useRef, useState } from 'react'
import { useData, useFavorites } from './store.jsx'
import Icon, { WhatsAppIcon } from './components/Icon.jsx'
import RoomCard from './components/RoomCard.jsx'
import RoomDetail from './components/RoomDetail.jsx'
import BookingSheet from './components/BookingSheet.jsx'
import Reviews from './components/Reviews.jsx'
import Restaurant from './components/Restaurant.jsx'
import Admin from './admin/Admin.jsx'
import { openWhatsApp } from './utils.js'

/* Router por hash: #/ , #/habitaciones , #/habitacion/<id> , #/restaurante , #/resenas , #/admin */
function useHashRoute() {
  const get = () => (window.location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean)
  const [parts, setParts] = useState(get)
  useEffect(() => {
    const on = () => setParts(get())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return parts
}
export const go = (path) => { window.location.hash = path }

/* Botón "Instalar app" (PWA) */
function useInstall() {
  const [evt, setEvt] = useState(null)
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches)
  useEffect(() => {
    const h = (e) => { e.preventDefault(); setEvt(e) }
    const i = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', h)
    window.addEventListener('appinstalled', i)
    return () => { window.removeEventListener('beforeinstallprompt', h); window.removeEventListener('appinstalled', i) }
  }, [])
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  const install = async () => {
    if (evt) { evt.prompt(); await evt.userChoice; setEvt(null) }
    else if (isIOS) alert('Para instalar: toca el botón Compartir ⬆️ y luego "Agregar a pantalla de inicio".')
    else alert('Abre el menú del navegador (⋮) y elige "Instalar aplicación" o "Agregar a pantalla de inicio".')
  }
  return { canShow: !installed, install }
}

export default function App() {
  const route = useHashRoute()
  const { data } = useData()
  const [favs, toggleFav] = useFavorites()
  const [booking, setBooking] = useState(null)
  const { canShow, install } = useInstall()

  const page = route[0] || ''
  const rooms = data.rooms

  if (page === 'admin') return <Admin />

  let content
  if (page === 'habitacion') {
    const room = rooms.find((r) => r.id === route[1])
    content = room ? (
      <RoomDetail room={room} fav={favs.includes(room.id)} onFav={() => toggleFav(room.id)} onBack={() => history.length > 1 ? history.back() : go('/')} onBook={() => setBooking(room)} />
    ) : <p className="pad center">Habitación no encontrada.</p>
  } else if (page === 'habitaciones') {
    content = <RoomsPage rooms={rooms} favs={favs} toggleFav={toggleFav} onBook={setBooking} />
  } else if (page === 'restaurante' && data.restaurant.enabled) {
    content = <Restaurant />
  } else if (page === 'resenas') {
    content = <div className="page"><header className="page-head"><p className="eyebrow">Opiniones reales</p><h1>Reseñas</h1></header><Reviews /></div>
  } else {
    content = <Home rooms={rooms} favs={favs} toggleFav={toggleFav} onBook={setBooking} canInstall={canShow} install={install} />
  }

  return (
    <div className={`app ${page === 'habitacion' ? 'is-detail' : ''}`}>
      <main>{content}</main>
      {page !== 'habitacion' && <BottomNav page={page} restaurant={data.restaurant.enabled} />}
      {booking && <BookingSheet room={booking} onClose={() => setBooking(null)} />}
    </div>
  )
}

function Home({ rooms, favs, toggleFav, onBook, canInstall, install }) {
  const { data } = useData()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('todas')
  const taps = useRef({ n: 0, t: 0 })

  // Acceso oculto al admin: tocar el logo 5 veces seguidas
  const secretTap = () => {
    const now = Date.now()
    taps.current = now - taps.current.t < 600 ? { n: taps.current.n + 1, t: now } : { n: 1, t: now }
    if (taps.current.n >= 5) { taps.current.n = 0; go('/admin') }
  }

  const list = useMemo(() => rooms.filter((r) => {
    const okQ = (r.name + ' ' + r.description + ' ' + (r.details || []).join(' ')).toLowerCase().includes(q.toLowerCase())
    const okF = filter === 'todas' ? true : filter === 'favoritas' ? favs.includes(r.id) : filter === 'pareja' ? r.capacity <= 3 : r.capacity >= 4
    return okQ && okF
  }), [rooms, q, filter, favs])

  return (
    <div className="page home">
      <header className="home-head">
        <button className="avatar" onClick={secretTap} aria-label={data.hotel.name}>
          <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" />
        </button>
        <div className="loc">
          <small className="muted">Ubicación</small>
          <p className="with-icon"><Icon name="pin" size={15} className="brand" /> {data.hotel.location}</p>
        </div>
        {canInstall && (
          <button className="btn btn--soft btn--sm" onClick={install}><Icon name="install" size={16} /> Instalar</button>
        )}
        <button className="icon-btn wa" onClick={() => openWhatsApp(data.hotel.whatsapp, `¡Hola! 👋 Tengo una pregunta sobre ${data.hotel.name}.`)} aria-label="WhatsApp">
          <WhatsAppIcon size={20} />
        </button>
      </header>

      <section className="hero">
        <h1>Encuentra tu <mark>lugar perfecto</mark> en el Caribe</h1>
        <p className="muted">{data.hotel.name} · habitaciones cómodas a pasos del mar</p>
      </section>

      <div className="search">
        <Icon name="search" />
        <input placeholder="Buscar habitación, comodidad…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="pill-group scroll">
        {[
          ['todas', 'Todas'],
          ['pareja', 'Pareja (1-3)'],
          ['familia', 'Familia (4+)'],
          ['favoritas', '♥ Favoritas']
        ].map(([k, l]) => (
          <button key={k} className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{l}</button>
        ))}
      </div>

      <div className="section-head">
        <h2>Nuestras habitaciones</h2>
        <a href="#/habitaciones">Ver todas</a>
      </div>
      {list.length === 0 && <p className="muted pad center">No hay habitaciones con ese filtro.</p>}
      <div className="carousel">
        {list.map((r) => (
          <RoomCard key={r.id} room={r} location={data.hotel.location} fav={favs.includes(r.id)} onFav={() => toggleFav(r.id)} onOpen={() => go('/habitacion/' + r.id)} onBook={() => onBook(r)} />
        ))}
      </div>

      {data.hotel.gallery?.length > 0 && (
        <>
          <div className="section-head"><h2>Conoce el hotel</h2></div>
          <div className="gallery">
            {data.hotel.gallery.map((g, i) => <img key={i} src={g} alt="Apartahotel Caribe Diez" loading="lazy" />)}
          </div>
        </>
      )}

      {data.restaurant.enabled && (
        <a className="promo" href="#/restaurante">
          {data.restaurant.images?.[0] ? <img className="promo__img" src={data.restaurant.images[0]} alt="" /> : <Icon name="food" size={28} />}
          <div><strong>{data.restaurant.title || 'Restaurante'}</strong><small>{data.restaurant.address || 'Mira nuestra carta y pide por WhatsApp'}</small></div>
          <Icon name="back" className="flip" />
        </a>
      )}

      <div className="section-head"><h2>Lo que dicen de nosotros</h2></div>
      <Reviews compact />

      <footer className="foot muted tiny center">© {new Date().getFullYear()} {data.hotel.name} · {data.hotel.location}</footer>
    </div>
  )
}

function RoomsPage({ rooms, favs, toggleFav, onBook }) {
  const { data } = useData()
  return (
    <div className="page">
      <header className="page-head"><p className="eyebrow">{rooms.length} opciones</p><h1>Habitaciones</h1></header>
      <div className="grid-cards">
        {rooms.map((r) => (
          <RoomCard wide key={r.id} room={r} location={data.hotel.location} fav={favs.includes(r.id)} onFav={() => toggleFav(r.id)} onOpen={() => go('/habitacion/' + r.id)} onBook={() => onBook(r)} />
        ))}
      </div>
    </div>
  )
}

function BottomNav({ page, restaurant }) {
  const items = [
    ['', 'home', 'Inicio'],
    ['habitaciones', 'bed', 'Habitaciones'],
    ...(restaurant ? [['restaurante', 'food', 'Restaurante']] : []),
    ['resenas', 'star', 'Reseñas']
  ]
  return (
    <nav className="bottom-nav" aria-label="Navegación">
      {items.map(([p, icon, label]) => (
        <a key={p} href={'#/' + p} className={page === p ? 'on' : ''}>
          <Icon name={icon} size={20} />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  )
}
