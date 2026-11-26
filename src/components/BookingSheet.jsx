import { useEffect, useMemo, useState } from 'react'
import Icon, { WhatsAppIcon } from './Icon.jsx'
import { useData } from '../store.jsx'
import { createBooking } from '../supabase.js'
import { addDays, bookingTotals, extraUnit, money, normalizePhone, prepareWhatsApp, prettyDate, todayISO } from '../utils.js'

/** Espera como máximo `ms`; si la base tarda, la reserva igual sale por WhatsApp. */
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

export default function BookingSheet({ room, onClose }) {
  const { data } = useData()
  const payments = data.payments.filter((p) => p.enabled)
  const catalog = (data.hotel.extras || []).filter((e) => e.active !== false)
  const today = todayISO()
  const [checkIn, setCheckIn] = useState('')
  const [checkOut, setCheckOut] = useState('')
  const [guests, setGuests] = useState(Math.min(2, room.capacity || 2))
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [extraIds, setExtraIds] = useState([])
  const [payment, setPayment] = useState(payments[0]?.name || '')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

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

  const extras = catalog.filter((e) => extraIds.includes(e.id)).map((e) => ({ ...e, qty: 1 }))
  const t = useMemo(
    () => bookingTotals({ check_in: checkIn, check_out: checkOut, price_night: room.price, extras }),
    [checkIn, checkOut, room.price, extras] // eslint-disable-line react-hooks/exhaustive-deps
  )
  const toggleExtra = (id) => setExtraIds((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]))

  const submit = async (e) => {
    e.preventDefault()
    if (!checkIn) return setError('Elige el día de llegada (check-in).')
    if (checkIn < today) return setError('La fecha de llegada no puede ser en el pasado.')
    if (name.trim().length < 2) return setError('Escribe tu nombre.')
    if (normalizePhone(phone).length < 10) return setError('Escribe tu número de WhatsApp para confirmarte la reserva.')
    setError('')
    setBusy(true)
    const wa = prepareWhatsApp()

    // 1) Se registra en el panel del admin  2) se envía por WhatsApp (aunque el registro falle)
    let code = ''
    try {
      code = await withTimeout(createBooking({
        room_id: room.id, check_in: checkIn, check_out: checkOut || null, guests,
        guest_name: name.trim(), guest_phone: normalizePhone(phone),
        extra_ids: extraIds, payment_method: payment, note: note.trim()
      }), 8000)
    } catch (err) {
      console.warn('No se pudo registrar la reserva:', err.message)
    }

    const lines = [
      `¡Hola! 👋 Quiero reservar en *${data.hotel.name}* 🌴`,
      code ? `🔖 *Reserva:* ${code}` : null,
      '',
      `🛏️ *Habitación:* ${room.name}`,
      `📅 *Llegada (check-in):* ${prettyDate(checkIn)}`,
      checkOut ? `📅 *Salida (check-out):* ${prettyDate(checkOut)}` : null,
      t.nights ? `🌙 *Noches:* ${t.nights}` : null,
      `👥 *Huéspedes:* ${guests}`,
      extras.length ? `➕ *Adicionales:* ${extras.map((x) => x.name).join(', ')}` : null,
      t.total ? `💰 *Valor estimado:* ${money(t.total)}${t.nights ? ` (${money(room.price)} x noche${t.extras ? ' + adicionales' : ''})` : ''}` : null,
      payment ? `💳 *Medio de pago:* ${payment}` : null,
      `👤 *Nombre:* ${name.trim()}`,
      `📱 *WhatsApp:* +${normalizePhone(phone)}`,
      note.trim() ? `\n📝 *Petición especial:*\n${note.trim()}` : null,
      '',
      '¿Me confirman disponibilidad? ¡Gracias!'
    ].filter((l) => l !== null)
    wa.go(data.hotel.whatsapp, lines.join('\n'))
    setBusy(false)
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
              <p className="price">{money(room.price)}<small>/{room.priceUnit?.trim() || 'noche'}</small></p>
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
          <label className="field">
            <span>Tu nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" autoComplete="name" required />
          </label>
          <label className="field">
            <span><WhatsAppIcon size={15} /> Tu WhatsApp</span>
            <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="315 000 0000" autoComplete="tel" required />
          </label>
        </div>

        <div className="field">
          <span><Icon name="users" size={16} /> Huéspedes</span>
          <div className="stepper">
            <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} aria-label="Menos"><Icon name="minus" size={16} /></button>
            <strong>{guests}</strong>
            <button type="button" onClick={() => setGuests((g) => Math.min(room.capacity || 10, g + 1))} aria-label="Más"><Icon name="plus" size={16} /></button>
          </div>
        </div>

        {catalog.length > 0 && (
          <div className="field">
            <span><Icon name="plus" size={16} /> Adicionales (opcional)</span>
            <div className="pill-group">
              {catalog.map((x) => (
                <button type="button" key={x.id} className={`pill ${extraIds.includes(x.id) ? 'on' : ''}`} onClick={() => toggleExtra(x.id)} aria-pressed={extraIds.includes(x.id)}>
                  {x.name}
                  {Number(x.price) > 0 && <small className="pill__sub"> +{money(x.price)} {extraUnit(x.unit)}</small>}
                </button>
              ))}
            </div>
          </div>
        )}

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
            placeholder="Ej: llegada tarde, decoración de cumpleaños, cuna para bebé…"
          />
        </label>

        {t.nights > 0 && (
          <div className="summary">
            <span>
              {t.nights} {t.nights === 1 ? 'noche' : 'noches'} × {money(room.price)}
              {t.extras > 0 && <><br /><small>+ adicionales {money(t.extras)}</small></>}
            </span>
            <strong>{money(t.total)}</strong>
          </div>
        )}

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn btn--wa btn--block btn--lg" disabled={busy}>
          <WhatsAppIcon /> {busy ? 'Enviando…' : 'Reservar por WhatsApp'}
        </button>
        <p className="muted tiny center">Se abrirá WhatsApp con tu solicitud lista para enviar. Check-in {data.hotel.checkInTime} · Check-out {data.hotel.checkOutTime}</p>
      </form>
    </div>
  )
}
