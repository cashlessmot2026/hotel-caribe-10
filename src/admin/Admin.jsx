import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import RoomsAdmin from './RoomsAdmin.jsx'
import PaymentsAdmin from './PaymentsAdmin.jsx'
import RestaurantAdmin from './RestaurantAdmin.jsx'
import SettingsAdmin from './SettingsAdmin.jsx'
import BookingsAdmin from './BookingsAdmin.jsx'
import { useBookings } from './useBookings.js'

const TABS = [
  ['bookings', 'calendar', 'Reservas'],
  ['rooms', 'bed', 'Habitaciones'],
  ['payments', 'card', 'Pagos'],
  ['restaurant', 'food', 'Restaurante'],
  ['settings', 'settings', 'Ajustes']
]

export default function Admin() {
  const { data, pin, logout, saveState, saveError, retrySave, source, update } = useData()
  const [tab, setTab] = useState('bookings')
  const bk = useBookings(pin)
  const pending = bk.list.filter((b) => b.status === 'pendiente' && !b.hidden).length

  if (!pin) return <Login />

  const exit = () => { logout(); window.location.hash = '/' }

  return (
    <div className="admin">
      <aside className="admin__side">
        <div className="admin__brand">
          <img src={import.meta.env.BASE_URL + 'icon-192.png'} alt="" />
          <div><strong>Panel admin</strong><small>{data.hotel.name}</small></div>
        </div>
        <nav>
          {TABS.map(([k, icon, label]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              <Icon name={icon} size={18} /> <span>{label}</span>
              {k === 'bookings' && pending > 0 && <b className="nav-badge" title="Reservas por confirmar">{pending}</b>}
            </button>
          ))}
        </nav>
        <div className="admin__side-foot">
          <SaveBadge state={saveState} error={saveError} onRetry={retrySave} />
          <a className="btn btn--ghost btn--sm" href="#/" target="_blank" rel="noreferrer"><Icon name="external" size={16} /> Ver web</a>
          <button className="btn btn--ghost btn--sm" onClick={exit}><Icon name="logout" size={16} /> Salir</button>
        </div>
      </aside>
      <section className="admin__main">
        {source === 'seed' && (
          <div className="notice">
            <div>
              <strong>La base de datos está vacía.</strong>
              <small>Estás viendo los datos de ejemplo. Publícalos en Supabase para empezar a editarlos.</small>
            </div>
            <button className="btn btn--primary btn--sm" onClick={() => update((d) => ({ ...d }))}><Icon name="upload" size={16} /> Publicar ahora</button>
          </div>
        )}
        {source === 'cache' && (
          <div className="notice warn"><div><strong>Sin conexión con Supabase.</strong><small>Mostrando la última copia guardada. Los cambios no se guardarán hasta recuperar la conexión.</small></div></div>
        )}
        {tab === 'bookings' && <BookingsAdmin bk={bk} />}
        {tab === 'rooms' && <RoomsAdmin />}
        {tab === 'payments' && <PaymentsAdmin />}
        {tab === 'restaurant' && <RestaurantAdmin />}
        {tab === 'settings' && <SettingsAdmin />}
      </section>
    </div>
  )
}

function SaveBadge({ state, error, onRetry }) {
  if (state === 'saving') return <span className="save-badge"><span className="dot pulse" /> Guardando…</span>
  if (state === 'saved') return <span className="save-badge ok"><Icon name="check" size={14} /> Guardado en la nube</span>
  if (state === 'error') return <button className="save-badge err" onClick={onRetry} title={error}>⚠ Error al guardar · Reintentar</button>
  return null
}

function Login() {
  const { login } = useData()
  const [v, setV] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      const ok = await login(v)
      if (!ok) { setErr('Clave incorrecta'); setV('') }
    } catch (ex) {
      setErr('No se pudo conectar con la base de datos: ' + ex.message)
    }
    setBusy(false)
  }
  return (
    <div className="login">
      <form className="login__card" onSubmit={submit}>
        <div className="login__icon"><Icon name="lock" size={28} /></div>
        <h1>Acceso administrador</h1>
        <p className="muted small">Ingresa la clave para gestionar el hotel</p>
        <input
          className={`pin ${err ? 'shake' : ''}`}
          type="password"
          inputMode="numeric"
          autoFocus
          placeholder="••••"
          value={v}
          onChange={(e) => { setV(e.target.value); setErr('') }}
        />
        {err && <p className="error">{err}</p>}
        <button className="btn btn--primary btn--block btn--lg" disabled={busy || !v}>{busy ? 'Verificando…' : 'Entrar'}</button>
        <a className="link-btn" href="#/">← Volver a la web</a>
      </form>
    </div>
  )
}
