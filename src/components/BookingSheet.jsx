import { useEffect, useMemo, useState } from 'react'
import Icon, { WhatsAppIcon } from './Icon.jsx'
import { useData } from '../store.jsx'
import { addDays, money, nightsBetween, openWhatsApp, prettyDate, todayISO } from '../utils.js'

export default function BookingSheet({ room, onClose }) {
  const { data } = useData()
  const payments = data.payments.filter((p) => p.enabled)
  const today = todayISO()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(Math.min(2, room.capacity || 2))
  const [name, setName] = useState('')
  const [payment, setPayment] = useState(payments[0]?.name || '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.classList.add('no-scroll')
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll') }
  }, [onClose])

  // Si la salida queda antes de la llegada, se corrige
  useEffect(() => {
    if (checkIn && (!checkOut || checkOut <= checkIn)) setCheckOut(addDays(checkIn, 1))
  }, [checkIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const nights = nightsBetween(checkIn, checkOut)
  const total = useMemo(() => nights * (Number(room.price) || 0), [nights, room.price])

  const submit = (e) => {
    e.preventDefault()
    if (!checkIn) return setError('Elige el día de llegada (check-in).')
    if (checkIn < today) return setError('La fecha de llegada no puede ser en el pasado.')
    setError('')
    const lines = [
      `¡Hola! 👋 Quiero reservar en *${data.hotel.name}* 🌴`,
      '',
      `🛏️ *Habitación:* ${room.name}`,
      `📅 *Llegada (check-in):* ${prettyDate(checkIn)}`,
      checkOut ? `📅 *Salida (check-out):* ${prettyDate(checkOut)}` : null,
      nights ? `🌙 *Noches:* ${nights}` : null,
      `👥 *Huéspedes:* ${guests}`,
      nights ? `💰 *Valor estimado:* ${money(total)} (${money(room.price)} x noche)` : null,
      payment ? `💳 *Medio de pago:* ${payment}` : null,
      name ? `👤 *Nombre:* ${name}` : null,
      note.trim() ? `\n📝 *Petición especial:*\n${note.trim()}` : null,
      '',
      '¿Me confirman disponibilidad? ¡Gracias!'
    ].filter((l) => l !== null)
    openWhatsApp(data.hotel.whatsapp, lines.join('\n'))
    onClose()
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-label="Reservar habitación">
        <div className="sheet__grab" />
        <div className="sheet__head">
          <div className="sheet__room">
            {room.images?.[0] && <img src={room.images[0]} alt="" />}
            <div>
              <p className="muted small">Reservar</p>
              <h3>{room.name}</h3>
              <p className="price">{money(room.price)}<small>/noche</small></p>
            </div>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>

        <div className="grid-2">
          <label className="field">
            <span><Icon name="calendar" size={16} /> Llegada (check-in)</span>
            <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </label>
          <label className="field">
            <span><Icon name="calendar" size={16} /> Salida (check-out)</span>
            <input type="date" min={checkIn ? addDays(checkIn, 1) : addDays(today, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
          </label>
        </div>

        <div className="grid-2">
          <div className="field">
            <span><Icon name="users" size={16} /> Huéspedes</span>
            <div className="stepper">
              <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Menos"><Icon name="minus" size={16} /></button>
              <strong>{guests}</strong>
              <button type="button" onClick={() => setGuests((g) => Math.min(room.capacity || 10, g + 1))} aria-label="Más"><Icon name="plus" size={16} /></button>
            </div>
          </div>
          <label className="field">
            <span>Tu nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Opcional" />
          </label>
        </div>

        {payments.length > 0 && (
          <div className="field">
            <span><Icon name="card" size={16} /> Medio de pago</span>
            <div className="pill-group">
              {payments.map((p) => (
                <button type="button" key={p.id} className={`pill ${payment === p.name ? 'on' : ''}`} onClick={() => setPayment(p.name)}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="field">
          <span><Icon name="note" size={16} /> Petición especial para la habitación</span>
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: cama extra, llegada tarde, decoración de cumpleaños, cuna para bebé…"
          />
        </label>

        {nights > 0 && (
          <div className="summary">
            <span>{nights} {nights === 1 ? 'noche' : 'noches'} × {money(room.price)}</span>
            <strong>{money(total)}</strong>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn--wa btn--block btn--lg">
          <WhatsAppIcon /> Reservar por WhatsApp
        </button>
        <p className="muted tiny center">Se abrirá WhatsApp con tu solicitud lista para enviar. Check-in {data.hotel.checkInTime} · Check-out {data.hotel.checkOutTime}</p>
      </form>
    </div>
  )
}
