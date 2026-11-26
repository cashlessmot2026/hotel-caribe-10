import { useEffect, useMemo, useState } from 'react'
import Icon, { WhatsAppIcon } from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import {
  STATUS, addDays, bookingTotals, csvCell, dateTime, downloadFile, extraTotal, money, onlyDigits, openWhatsApp, prepareWhatsApp, prettyDate, reviewLinks, shortDate, todayISO, uid
} from '../utils.js'

const ACTIVE = ['pendiente', 'confirmada', 'checkin']

const FILTERS = [
  ['activas', 'Próximas y en curso'],
  ['pendiente', 'Pendientes'],
  ['confirmada', 'Confirmadas'],
  ['checkin', 'Hospedados'],
  ['checkout', 'Finalizadas'],
  ['cancelada', 'Canceladas'],
  ['ocultas', 'Ocultas'],
  ['todas', 'Todas']
]

function matches(b, f, today) {
  if (f === 'ocultas') return b.hidden
  if (b.hidden) return false
  switch (f) {
    case 'activas': return ACTIVE.includes(b.status)
    case 'cancelada': return b.status === 'cancelada' || b.status === 'no_show'
    case 'llegadas': return b.check_in === today && (b.status === 'pendiente' || b.status === 'confirmada')
    case 'salidas': return b.status === 'checkin' && !!b.check_out && b.check_out <= today
    case 'todas': return true
    default: return b.status === f
  }
}

/** Avisos automáticos según fechas */
function alertsFor(b, today) {
  const a = []
  if (b.hidden) return a
  if ((b.status === 'pendiente' || b.status === 'confirmada') && b.check_in === today) a.push(['ok', 'Llega hoy'])
  if ((b.status === 'pendiente' || b.status === 'confirmada') && b.check_in === addDays(today, 1)) a.push(['info', 'Llega mañana'])
  if ((b.status === 'pendiente' || b.status === 'confirmada') && b.check_in < today) a.push(['bad', 'Debía llegar — ¿no llegó?'])
  if (b.status === 'checkin' && b.check_out === today) a.push(['ok', 'Sale hoy'])
  if (b.status === 'checkin' && b.check_out && b.check_out < today) a.push(['bad', 'Salida vencida'])
  return a
}

const firstName = (n) => String(n || '').trim().split(/\s+/)[0] || ''
const now = () => new Date().toISOString()
const log = (b, text) => ({ ...b, history: [...(b.history || []), { at: now(), text }] })

/** Cambia el estado dejando constancia en el historial */
function withStatus(b, status, reason = '') {
  const next = { ...b, status }
  if (status === 'pendiente' || status === 'confirmada') { next.checked_in_at = null; next.checked_out_at = null }
  if (status === 'checkin') { next.checked_in_at = b.checked_in_at || now(); next.checked_out_at = null }
  if (status === 'checkout') next.checked_out_at = now()
  if (status === 'cancelada') next.cancel_reason = reason
  const texts = {
    pendiente: 'Vuelve a pendiente',
    confirmada: 'Reserva confirmada',
    checkin: 'Check-in realizado',
    checkout: 'Check-out realizado',
    no_show: 'Marcada como "no llegó"',
    cancelada: 'Reserva cancelada' + (reason ? ': ' + reason : '')
  }
  return log(next, texts[status])
}

const NEXT = {
  pendiente: ['confirmada', 'check', 'Confirmar'],
  confirmada: ['checkin', 'login', 'Check-in'],
  checkin: ['checkout', 'logout', 'Check-out']
}

/* ---------- Mensajes de WhatsApp para el cliente ---------- */
const TEMPLATES = [
  ['confirm', 'Confirmación'],
  ['update', 'Cambios en la reserva'],
  ['reminder', 'Recordatorio de llegada'],
  ['payment', 'Estado de pago'],
  ['thanks', 'Gracias + reseña'],
  ['cancel', 'Cancelación'],
  ['blank', 'Mensaje libre']
]

function buildMessage(kind, b, data) {
  const h = data.hotel
  const t = bookingTotals(b)
  const hi = `Hola ${firstName(b.guest_name)} 👋`
  const detail = [
    `🔖 *Reserva:* ${b.code || ''}`,
    `🛏️ *Habitación:* ${b.room_name || ''}`,
    `📅 *Llegada:* ${prettyDate(b.check_in)}${h.checkInTime ? ` (desde ${h.checkInTime})` : ''}`,
    b.check_out ? `📅 *Salida:* ${prettyDate(b.check_out)}${h.checkOutTime ? ` (hasta ${h.checkOutTime})` : ''}` : null,
    t.nights ? `🌙 *Noches:* ${t.nights}` : null,
    `👥 *Huéspedes:* ${b.guests}`,
    b.extras?.length ? `➕ *Adicionales:* ${b.extras.map((e) => (e.qty > 1 ? `${e.name} x${e.qty}` : e.name)).join(', ')}` : null,
    `💰 *Total:* ${money(t.total)}`,
    t.paid > 0 ? `✅ *Abonado:* ${money(t.paid)}` : null,
    t.paid > 0 && t.balance > 0 ? `🧾 *Saldo pendiente:* ${money(t.balance)}` : null,
    b.payment_method ? `💳 *Medio de pago:* ${b.payment_method}` : null
  ]
  const pays = data.payments.filter((p) => p.enabled).map((p) => `• ${p.name}${p.details ? ': ' + p.details : ''}`)
  const msgs = {
    confirm: [hi, '', `¡Tu reserva en *${h.name}* está *confirmada*! ✅`, '', ...detail, '', '¡Te esperamos! 🌴'],
    update: [hi, '', `Actualizamos tu reserva en *${h.name}*. Así quedó:`, '', ...detail, '', 'Si algo no está bien, escríbenos por aquí.'],
    reminder: [hi, '', `Te recordamos tu llegada a *${h.name}* el *${prettyDate(b.check_in)}*${h.checkInTime ? `, check-in desde las ${h.checkInTime}` : ''}. 🌴`, '', ...detail, '', h.location ? `📍 ${h.location}` : null, '¡Buen viaje!'],
    payment: [hi, '', `Este es el estado de pago de tu reserva *${b.code || ''}*:`, '', `💰 *Total:* ${money(t.total)}`, `✅ *Abonado:* ${money(t.paid)}`, `🧾 *Saldo:* ${money(Math.max(t.balance, 0))}`, ...(pays.length ? ['', '*Medios de pago:*', ...pays] : []), '', '¡Gracias!'],
    thanks: [hi, '', `¡Gracias por hospedarte en *${h.name}*! 🌴 Esperamos que lo hayas disfrutado.`, '', `¿Nos ayudas con una reseña? ⭐ ${reviewLinks(h).write}`, '', '¡Vuelve pronto!'],
    cancel: [hi, '', `Te informamos que tu reserva *${b.code || ''}* en *${h.name}* (${b.room_name || ''}, llegada ${prettyDate(b.check_in)}) fue *cancelada*.`, b.cancel_reason ? `Motivo: ${b.cancel_reason}` : null, '', 'Si quieres reprogramar, escríbenos por aquí. ¡Gracias!'],
    blank: [`${hi}, te escribimos de *${h.name}* sobre tu reserva *${b.code || ''}*.`, '']
  }
  return msgs[kind].filter((l) => l !== null).join('\n')
}

/* ======================================================================= */

export default function BookingsAdmin({ bk }) {
  const { data } = useData()
  const today = todayISO()
  const [filter, setFilter] = useState('activas')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState(null)
  const [cancelling, setCancelling] = useState(null) // { booking, onDone }
  const [toast, setToast] = useState(null)
  const [busyId, setBusyId] = useState('')

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.action ? 9000 : 3500)
    return () => clearTimeout(t)
  }, [toast])

  const counts = useMemo(() => {
    const c = {}
    for (const f of [...FILTERS.map(([k]) => k), 'llegadas', 'salidas']) c[f] = bk.list.filter((b) => matches(b, f, today)).length
    return c
  }, [bk.list, today])

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const digits = onlyDigits(q)
    const asc = ['activas', 'pendiente', 'confirmada', 'checkin', 'llegadas', 'salidas'].includes(filter)
    return bk.list
      .filter((b) => matches(b, filter, today))
      .filter((b) => !needle || [b.code, b.guest_name, b.room_name, b.guest_doc, b.guest_email].some((v) => String(v || '').toLowerCase().includes(needle)) || (digits.length >= 3 && String(b.guest_phone || '').includes(digits)))
      .sort((a, b) => (asc ? a.check_in.localeCompare(b.check_in) : b.check_in.localeCompare(a.check_in)) || String(b.created_at).localeCompare(String(a.created_at)))
  }, [bk.list, filter, q, today])

  const persist = async (b, okText) => {
    setBusyId(b.id || 'new')
    try {
      const row = await bk.save(b)
      if (okText) setToast({ text: okText })
      return row
    } catch (e) {
      alert('No se pudo guardar: ' + e.message)
      return null
    } finally { setBusyId('') }
  }

  const quick = async (b, status) => {
    if (status === 'checkout') {
      const t = bookingTotals(b)
      if (t.balance > 0 && !confirm(`Queda un saldo pendiente de ${money(t.balance)}. ¿Hacer el check-out igual?`)) return
    }
    bk.seen(b.id)
    const row = await persist(withStatus(b, status))
    if (!row) return
    const label = STATUS[status].short
    if (status === 'confirmada' && row.guest_phone) {
      setToast({ text: `${row.code} confirmada`, action: { label: 'Enviar confirmación', fn: () => openWhatsApp(row.guest_phone, buildMessage('confirm', row, data)) } })
    } else if (status === 'checkout' && row.guest_phone) {
      setToast({ text: `${row.code} finalizada`, action: { label: 'Enviar gracias + reseña', fn: () => openWhatsApp(row.guest_phone, buildMessage('thanks', row, data)) } })
    } else setToast({ text: `${row.code}: ${label}` })
  }

  const toggleHidden = async (b) => {
    const row = await persist(log({ ...b, hidden: !b.hidden }, b.hidden ? 'Reserva visible de nuevo' : 'Reserva ocultada'))
    if (row) setToast({ text: row.hidden ? `${row.code} ocultada · la ves en "Ocultas"` : `${row.code} visible de nuevo` })
  }

  const newBooking = () => {
    const room = data.rooms[0]
    setEditing({
      status: 'confirmada', hidden: false, room_id: room?.id || '', room_name: room?.name || '',
      check_in: today, check_out: addDays(today, 1), guests: Math.min(2, room?.capacity || 2),
      guest_name: '', guest_phone: '', guest_email: '', guest_doc: '', guest_origin: '',
      price_night: Number(room?.price) || 0, extras: [], discount: 0, paid: 0,
      payment_method: data.payments.find((p) => p.enabled)?.name || '',
      note: '', admin_note: '', cancel_reason: '', history: [{ at: now(), text: 'Reserva creada desde el panel' }]
    })
  }

  const exportCSV = () => {
    const head = ['Código', 'Estado', 'Oculta', 'Huésped', 'WhatsApp', 'Email', 'Documento', 'Procedencia', 'Habitación', 'Llegada', 'Salida', 'Noches', 'Huéspedes', 'Adicionales', 'Precio noche', 'Descuento', 'Total', 'Abonado', 'Saldo', 'Medio de pago', 'Origen', 'Creada']
    const rows = shown.map((b) => {
      const t = bookingTotals(b)
      return [b.code, STATUS[b.status]?.short, b.hidden ? 'sí' : '', b.guest_name, b.guest_phone, b.guest_email, b.guest_doc, b.guest_origin, b.room_name, b.check_in, b.check_out, t.nights, b.guests, b.extras.map((e) => e.name + (e.qty > 1 ? ' x' + e.qty : '')).join(', '), b.price_night, b.discount, t.total, t.paid, t.balance, b.payment_method, b.source, dateTime(b.created_at)]
    })
    downloadFile(`reservas-${today}.csv`, '﻿' + [head, ...rows].map((r) => r.map(csvCell).join(';')).join('\n'), 'text/csv;charset=utf-8')
  }

  const askCancel = (b, onDone) => setCancelling({ booking: b, onDone })

  const doCancel = async (reason, notify) => {
    const { booking, onDone } = cancelling
    const wa = notify ? prepareWhatsApp() : null
    const row = await persist(withStatus(booking, 'cancelada', reason.trim()))
    if (!row) { wa?.cancel(); return }
    setCancelling(null)
    setToast({ text: `${row.code} cancelada` })
    if (wa) wa.go(row.guest_phone, buildMessage('cancel', row, data))
    onDone?.(row)
  }

  /* ---------- Vistas ---------- */
  if (bk.state === 'missing') {
    return (
      <>
        <div className="admin__head"><div><h1>Reservas</h1></div></div>
        <div className="notice warn">
          <div>
            <strong>Falta activar las reservas en la base de datos.</strong>
            <small>Abre Supabase › SQL Editor, pega todo el archivo <code>supabase/schema.sql</code> y pulsa <b>Run</b>. Luego vuelve aquí y pulsa Reintentar.</small>
          </div>
          <button className="btn btn--primary btn--sm" onClick={bk.reload}><Icon name="refresh" size={16} /> Reintentar</button>
        </div>
      </>
    )
  }

  const cancelDialog = cancelling && (
    <CancelDialog booking={cancelling.booking} busy={!!busyId} onClose={() => setCancelling(null)} onConfirm={doCancel} />
  )
  const toastEl = toast && (
    <div className="toast" role="status">
      <span>{toast.text}</span>
      {toast.action && <button className="btn btn--wa btn--sm" onClick={() => { toast.action.fn(); setToast(null) }}><WhatsAppIcon size={16} /> {toast.action.label}</button>}
      <button className="icon-btn sm" onClick={() => setToast(null)} aria-label="Cerrar"><Icon name="close" size={16} /></button>
    </div>
  )

  if (editing) {
    return (
      <>
        <BookingForm
          key={(editing.id || 'new') + (editing.updated_at || '')}
          initial={editing}
          all={bk.list}
          onBack={() => setEditing(null)}
          onSave={async (b, okText) => { const row = await persist(b, okText); if (row) setEditing(row); return row }}
          onCancelBooking={(b) => askCancel(b, (row) => setEditing(row))}
          onDelete={async (b) => {
            if (!confirm(`¿Eliminar DEFINITIVAMENTE la reserva ${b.code}? No se puede deshacer.\n\nSi solo quieres sacarla de la lista, usa "Ocultar".`)) return
            try { await bk.remove(b.id); setEditing(null); setToast({ text: `${b.code} eliminada` }) } catch (e) { alert('No se pudo eliminar: ' + e.message) }
          }}
        />
        {cancelDialog}
        {toastEl}
      </>
    )
  }

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Reservas</h1>
          <p className="muted small">Las solicitudes de la web llegan aquí y a WhatsApp · se actualiza cada 30 s</p>
        </div>
        <div className="row-gap wrap">
          <button className="btn btn--ghost btn--sm" onClick={bk.reload}><Icon name="refresh" size={16} /> Actualizar</button>
          <button className="btn btn--ghost btn--sm" onClick={exportCSV} disabled={!shown.length}><Icon name="download" size={16} /> Excel</button>
          <button className="btn btn--primary" onClick={newBooking}><Icon name="plus" size={18} /> Nueva reserva</button>
        </div>
      </div>

      {bk.state === 'error' && (
        <div className="notice warn"><div><strong>No se pudieron cargar las reservas.</strong><small>{bk.error}</small></div><button className="btn btn--ghost btn--sm" onClick={bk.reload}>Reintentar</button></div>
      )}

      <div className="bk-stats">
        {[
          ['llegadas', 'login', 'Llegadas hoy'],
          ['checkin', 'bed', 'Hospedados'],
          ['salidas', 'logout', 'Salidas hoy'],
          ['pendiente', 'clock', 'Por confirmar']
        ].map(([k, icon, label]) => (
          <button key={k} className={`bk-stat ${filter === k ? 'on' : ''}`} onClick={() => setFilter(filter === k ? 'activas' : k)}>
            <Icon name={icon} size={18} />
            <strong>{counts[k]}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>

      <div className="search">
        <Icon name="search" />
        <input placeholder="Buscar por nombre, teléfono, código o documento…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="pill-group scroll admin-pills">
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`pill ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>
            {l} <small className="pill__count">{counts[k]}</small>
          </button>
        ))}
      </div>

      {bk.state === 'loading' && <div className="card center"><div className="spinner" style={{ margin: '0 auto' }} /></div>}
      {bk.state === 'ok' && shown.length === 0 && (
        <div className="card center muted">{q ? 'Ninguna reserva coincide con la búsqueda.' : 'No hay reservas en esta lista.'}</div>
      )}

      <div className="bk-list">
        {shown.map((b) => (
          <BookingRow
            key={b.id}
            b={b}
            today={today}
            isNew={bk.fresh.includes(b.id) || (b.status === 'pendiente' && b.source === 'web' && !b.hidden && Date.now() - new Date(b.created_at) < 6 * 3600e3)}
            busy={busyId === b.id}
            onOpen={() => { bk.seen(b.id); setEditing(b) }}
            onQuick={(s) => quick(b, s)}
            onHide={() => toggleHidden(b)}
            onWhatsApp={() => openWhatsApp(b.guest_phone, buildMessage('blank', b, data))}
          />
        ))}
      </div>

      <ExtrasCatalog />

      {cancelDialog}
      {toastEl}
    </>
  )
}

/* ---------- Fila de la lista ---------- */
function BookingRow({ b, today, isNew, busy, onOpen, onQuick, onHide, onWhatsApp }) {
  const t = bookingTotals(b)
  const next = NEXT[b.status]
  return (
    <article className={`bk-row st-line--${b.status} ${b.hidden ? 'is-hidden' : ''}`}>
      <button className="bk-row__main" onClick={onOpen}>
        <div className="bk-row__top">
          <code>{b.code}</code>
          <span className={`st st--${b.status}`}>{STATUS[b.status]?.short}</span>
          {isNew && <span className="st st--new">Nueva</span>}
          {b.hidden && <span className="st st--checkout"><Icon name="eyeOff" size={12} /> Oculta</span>}
          {alertsFor(b, today).map(([kind, text]) => <span key={text} className={`flag flag--${kind}`}>{text}</span>)}
        </div>
        <strong className="bk-row__name">{b.guest_name || 'Sin nombre'}</strong>
        <span className="muted small">
          {b.room_name} · {shortDate(b.check_in)} → {shortDate(b.check_out)}{t.nights ? ` · ${t.nights} ${t.nights === 1 ? 'noche' : 'noches'}` : ''} · {b.guests} {b.guests === 1 ? 'huésped' : 'huéspedes'}
        </span>
        <span className="small">
          <b>{money(t.total)}</b>
          {t.paid > 0 && (t.balance > 0 ? <span className="danger"> · saldo {money(t.balance)}</span> : <span className="brand"> · pagado</span>)}
          {b.extras.length > 0 && <span className="muted"> · +{b.extras.length} adicional{b.extras.length > 1 ? 'es' : ''}</span>}
        </span>
      </button>
      <div className="bk-row__actions">
        {next && !b.hidden && (
          <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => onQuick(next[0])}>
            <Icon name={next[1]} size={16} /> {next[2]}
          </button>
        )}
        <button className="icon-btn sm wa" onClick={onWhatsApp} disabled={!b.guest_phone} title="Escribir al cliente por WhatsApp" aria-label="WhatsApp"><WhatsAppIcon size={16} /></button>
        <button className="icon-btn sm" onClick={onHide} disabled={busy} title={b.hidden ? 'Mostrar' : 'Ocultar'} aria-label={b.hidden ? 'Mostrar' : 'Ocultar'}><Icon name={b.hidden ? 'eye' : 'eyeOff'} size={16} /></button>
        <button className="icon-btn sm" onClick={onOpen} title="Ver y editar" aria-label="Editar"><Icon name="edit" size={16} /></button>
      </div>
    </article>
  )
}

/* ---------- Editor de una reserva ---------- */
const FIELD_LABELS = {
  room_id: 'habitación', check_in: 'llegada', check_out: 'salida', guests: 'huéspedes', guest_name: 'nombre',
  guest_phone: 'teléfono', guest_email: 'email', guest_doc: 'documento', guest_origin: 'procedencia',
  price_night: 'precio por noche', discount: 'descuento', paid: 'abono', payment_method: 'medio de pago',
  note: 'petición', admin_note: 'notas internas'
}
const toInt = (v) => Number(onlyDigits(v)) || 0

function BookingForm({ initial, all, onBack, onSave, onCancelBooking, onDelete }) {
  const { data } = useData()
  const [b, setB] = useState(() => structuredClone(initial))
  const [orig] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [tpl, setTpl] = useState('confirm')
  const [custom, setCustom] = useState({ name: '', price: '', unit: 'estadia' })
  const isNew = !initial.id
  const t = bookingTotals(b)
  const catalog = (data.hotel.extras || [])
  const today = todayISO()

  const patch = (p) => { setB((cur) => ({ ...cur, ...p })); setDirty(true); setErr('') }
  const set = (k, fn = (v) => v) => (e) => patch({ [k]: fn(e.target.value) })

  const changeRoom = (id) => {
    const room = data.rooms.find((r) => r.id === id)
    patch({ room_id: id, room_name: room?.name || '', price_night: Number(room?.price) || b.price_night })
  }

  // Otras reservas activas de la misma habitación que se cruzan con estas fechas
  const conflicts = useMemo(() => {
    if (!b.room_id || !b.check_in || !ACTIVE.includes(b.status)) return []
    const out = b.check_out || addDays(b.check_in, 1)
    return all.filter((o) => o.id !== b.id && !o.hidden && o.room_id === b.room_id && ACTIVE.includes(o.status) &&
      o.check_in < out && b.check_in < (o.check_out || addDays(o.check_in, 1)))
  }, [all, b.id, b.room_id, b.check_in, b.check_out, b.status])

  /* adicionales */
  const hasExtra = (id) => b.extras.some((e) => e.id === id)
  const toggleExtra = (x) => patch({ extras: hasExtra(x.id) ? b.extras.filter((e) => e.id !== x.id) : [...b.extras, { id: x.id, name: x.name, price: Number(x.price) || 0, unit: x.unit || 'estadia', qty: 1 }] })
  const setExtra = (id, p) => patch({ extras: b.extras.map((e) => (e.id === id ? { ...e, ...p } : e)) })
  const addCustom = () => {
    if (!custom.name.trim()) return
    patch({ extras: [...b.extras, { id: 'x-' + uid(), name: custom.name.trim(), price: toInt(custom.price), unit: custom.unit, qty: 1 }] })
    setCustom({ name: '', price: '', unit: custom.unit })
  }

  const validate = (x) => {
    if (!x.guest_name?.trim()) return 'Escribe el nombre del huésped.'
    if (!x.check_in) return 'Falta la fecha de llegada.'
    if (x.check_out && x.check_out <= x.check_in) return 'La salida debe ser después de la llegada.'
    if (!x.room_id) return 'Elige la habitación.'
    return ''
  }

  const changesText = () => {
    const changed = Object.keys(FIELD_LABELS).filter((k) => String(orig[k] ?? '') !== String(b[k] ?? '')).map((k) => FIELD_LABELS[k])
    if (JSON.stringify(orig.extras || []) !== JSON.stringify(b.extras)) changed.push('adicionales')
    return changed.length ? 'Modificada: ' + changed.join(', ') : ''
  }

  const save = async (next = b, okText = 'Cambios guardados ✅') => {
    const v = validate(next)
    if (v) { setErr(v); return null }
    setBusy(true)
    const row = await onSave(next, okText)
    setBusy(false)
    if (row) setDirty(false)
    return row
  }
  const saveEdits = () => {
    if (isNew) return save(b.status === 'checkin' ? { ...b, checked_in_at: now() } : b, 'Reserva creada ✅')
    const txt = changesText()
    return save(txt ? log(b, txt) : b)
  }
  const status = (s) => {
    if (s === 'checkout' && t.balance > 0 && !confirm(`Queda un saldo pendiente de ${money(t.balance)}. ¿Hacer el check-out igual?`)) return
    const txt = !isNew && changesText()
    save(withStatus(txt ? log(b, txt) : b, s), `${STATUS[s].short} ✅`)
  }
  const back = () => { if (!dirty || confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) onBack() }

  const sendMsg = () => {
    if (!b.guest_phone) return setErr('Agrega el WhatsApp del huésped para enviarle mensajes.')
    openWhatsApp(b.guest_phone, buildMessage(tpl, b, data))
  }

  const payOptions = [...new Set([...data.payments.map((p) => p.name), b.payment_method].filter(Boolean))]
  const rooms = data.rooms.some((r) => r.id === b.room_id) || !b.room_id ? data.rooms : [...data.rooms, { id: b.room_id, name: b.room_name + ' (eliminada)' }]

  return (
    <>
      <div className="admin__head sticky-head">
        <div className="row-gap">
          <button className="icon-btn" onClick={back} aria-label="Volver"><Icon name="back" /></button>
          <div>
            <h1>{isNew ? 'Nueva reserva' : `Reserva ${b.code}`}</h1>
            <p className="muted small">
              {!isNew && <span className={`st st--${b.status}`}>{STATUS[b.status]?.label}</span>}
              {b.hidden && <> · <Icon name="eyeOff" size={12} /> oculta</>}
              {!isNew && <> · {b.source === 'web' ? 'llegó desde la web' : 'creada en el panel'} · {dateTime(b.created_at)}</>}
            </p>
          </div>
        </div>
        <div className="row-gap">
          {dirty && <span className="muted tiny">Sin guardar</span>}
          <button className="btn btn--primary" onClick={saveEdits} disabled={busy || (!dirty && !isNew)}>
            <Icon name="check" size={18} /> {busy ? 'Guardando…' : isNew ? 'Crear reserva' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {err && <p className="error">{err}</p>}

      {!isNew && (
        <div className="card">
          <h3 className="section-label">Estado de la reserva</h3>
          <div className="row-gap wrap">
            {b.status === 'pendiente' && <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => status('confirmada')}><Icon name="check" size={16} /> Confirmar</button>}
            {(b.status === 'pendiente' || b.status === 'confirmada') && <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => status('checkin')}><Icon name="login" size={16} /> Hacer check-in</button>}
            {b.status === 'checkin' && <button className="btn btn--primary btn--sm" disabled={busy} onClick={() => status('checkout')}><Icon name="logout" size={16} /> Hacer check-out</button>}
            {(b.status === 'pendiente' || b.status === 'confirmada') && <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => status('no_show')}>No llegó</button>}
            {ACTIVE.includes(b.status) && <button className="btn btn--ghost btn--sm danger" disabled={busy} onClick={() => onCancelBooking(b)}><Icon name="ban" size={16} /> Cancelar reserva</button>}
            {!ACTIVE.includes(b.status) && <button className="btn btn--soft btn--sm" disabled={busy} onClick={() => status('confirmada')}><Icon name="refresh" size={16} /> Reactivar (confirmada)</button>}
            {b.status === 'checkin' && <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => status('confirmada')}>Deshacer check-in</button>}
            {b.status === 'checkout' && <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => status('checkin')}>Deshacer check-out</button>}
            <button className="btn btn--ghost btn--sm" disabled={busy} onClick={() => save(log({ ...b, hidden: !b.hidden }, b.hidden ? 'Reserva visible de nuevo' : 'Reserva ocultada'), b.hidden ? 'Visible de nuevo' : 'Reserva ocultada')}>
              <Icon name={b.hidden ? 'eye' : 'eyeOff'} size={16} /> {b.hidden ? 'Mostrar' : 'Ocultar'}
            </button>
          </div>
          {(b.checked_in_at || b.checked_out_at) && (
            <p className="muted small">
              {b.checked_in_at && <>Check-in: {dateTime(b.checked_in_at)}</>}
              {b.checked_out_at && <> · Check-out: {dateTime(b.checked_out_at)}</>}
            </p>
          )}
          {b.status === 'cancelada' && (
            <label className="field"><span>Motivo de cancelación</span><input value={b.cancel_reason || ''} onChange={set('cancel_reason')} /></label>
          )}
        </div>
      )}

      {isNew && (
        <div className="card">
          <label className="field">
            <span>Estado inicial</span>
            <select value={b.status} onChange={set('status')}>
              {['pendiente', 'confirmada', 'checkin'].map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="card">
        <h3 className="section-label">Huésped</h3>
        <div className="grid-2">
          <label className="field"><span>Nombre completo</span><input value={b.guest_name || ''} onChange={set('guest_name')} placeholder="Nombre y apellido" /></label>
          <label className="field"><span><WhatsAppIcon size={14} /> WhatsApp / teléfono</span><input type="tel" value={b.guest_phone || ''} onChange={set('guest_phone')} placeholder="57 315 000 0000" /></label>
          <label className="field"><span>Documento (cédula / pasaporte)</span><input value={b.guest_doc || ''} onChange={set('guest_doc')} /></label>
          <label className="field"><span>Email</span><input type="email" value={b.guest_email || ''} onChange={set('guest_email')} /></label>
          <label className="field"><span>Procedencia (ciudad / país)</span><input value={b.guest_origin || ''} onChange={set('guest_origin')} /></label>
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Estadía</h3>
        <label className="field">
          <span><Icon name="bed" size={16} /> Habitación</span>
          <select value={b.room_id || ''} onChange={(e) => changeRoom(e.target.value)}>
            {!b.room_id && <option value="">Elige…</option>}
            {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}{r.price ? ` — ${money(r.price)}/noche` : ''}</option>)}
          </select>
        </label>
        <div className="grid-3">
          <label className="field"><span>Llegada (check-in)</span><input type="date" value={b.check_in || ''} onChange={(e) => patch({ check_in: e.target.value, ...(b.check_out && b.check_out <= e.target.value ? { check_out: addDays(e.target.value, 1) } : {}) })} /></label>
          <label className="field"><span>Salida (check-out)</span><input type="date" min={b.check_in ? addDays(b.check_in, 1) : undefined} value={b.check_out || ''} onChange={set('check_out')} /></label>
          <div className="field">
            <span>Huéspedes</span>
            <div className="stepper">
              <button type="button" onClick={() => patch({ guests: Math.max(1, b.guests - 1) })} aria-label="Menos"><Icon name="minus" size={16} /></button>
              <strong>{b.guests}</strong>
              <button type="button" onClick={() => patch({ guests: b.guests + 1 })} aria-label="Más"><Icon name="plus" size={16} /></button>
            </div>
          </div>
        </div>
        <p className="muted small">{t.nights ? `${t.nights} ${t.nights === 1 ? 'noche' : 'noches'}` : 'Sin fecha de salida'}{b.check_in === today ? ' · llega hoy' : ''}</p>
        {conflicts.length > 0 && (
          <div className="warn-box">
            <Icon name="alert" size={18} />
            <div>
              <strong>Cruce de fechas en esta habitación</strong>
              <small>{conflicts.map((o) => `${o.code} · ${o.guest_name || 'sin nombre'} (${shortDate(o.check_in)} → ${shortDate(o.check_out)})`).join(' — ')}</small>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="section-label">Adicionales</h3>
        {catalog.length > 0 && (
          <div className="pill-group">
            {catalog.map((x) => (
              <button type="button" key={x.id} className={`pill ${hasExtra(x.id) ? 'on' : ''}`} onClick={() => toggleExtra(x)}>
                {hasExtra(x.id) ? '✓ ' : '+ '}{x.name}
              </button>
            ))}
          </div>
        )}
        {b.extras.length > 0 && (
          <div className="extra-list">
            {b.extras.map((e) => (
              <div key={e.id} className="extra-row">
                <input className="inline-input strong grow" value={e.name} onChange={(ev) => setExtra(e.id, { name: ev.target.value })} aria-label="Nombre" />
                <div className="stepper sm">
                  <button type="button" onClick={() => setExtra(e.id, { qty: Math.max(1, e.qty - 1) })} aria-label="Menos"><Icon name="minus" size={14} /></button>
                  <strong>{e.qty}</strong>
                  <button type="button" onClick={() => setExtra(e.id, { qty: e.qty + 1 })} aria-label="Más"><Icon name="plus" size={14} /></button>
                </div>
                <input className="inline-input money-input" inputMode="numeric" value={e.price} onChange={(ev) => setExtra(e.id, { price: toInt(ev.target.value) })} aria-label="Precio" />
                <select className="inline-select" value={e.unit} onChange={(ev) => setExtra(e.id, { unit: ev.target.value })} aria-label="Cobro">
                  <option value="estadia">por estadía</option>
                  <option value="noche">por noche</option>
                </select>
                <b className="extra-row__sum">{money(extraTotal(e, t.nights))}</b>
                <button className="icon-btn sm danger" onClick={() => patch({ extras: b.extras.filter((x) => x.id !== e.id) })} aria-label="Quitar"><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="row-gap wrap">
          <input className="grow" placeholder="Otro adicional (ej: decoración, traslado…)" value={custom.name} onChange={(e) => setCustom({ ...custom, name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <input style={{ width: 120 }} inputMode="numeric" placeholder="Precio" value={custom.price} onChange={(e) => setCustom({ ...custom, price: e.target.value })} />
          <select style={{ width: 150 }} value={custom.unit} onChange={(e) => setCustom({ ...custom, unit: e.target.value })}>
            <option value="estadia">por estadía</option>
            <option value="noche">por noche</option>
          </select>
          <button className="btn btn--soft" onClick={addCustom}><Icon name="plus" size={18} /></button>
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Valores y pago</h3>
        <div className="grid-3">
          <label className="field"><span>Precio por noche</span><input inputMode="numeric" value={b.price_night} onChange={set('price_night', toInt)} /></label>
          <label className="field"><span>Descuento</span><input inputMode="numeric" value={b.discount} onChange={set('discount', toInt)} /></label>
          <label className="field"><span>Abonado / pagado</span><input inputMode="numeric" value={b.paid} onChange={set('paid', toInt)} /></label>
        </div>
        <label className="field">
          <span><Icon name="card" size={16} /> Medio de pago</span>
          <select value={b.payment_method || ''} onChange={set('payment_method')}>
            <option value="">Sin definir</option>
            {payOptions.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </label>
        <div className="totals">
          <div><span>{t.nights} {t.nights === 1 ? 'noche' : 'noches'} × {money(b.price_night)}</span><b>{money(t.base)}</b></div>
          {t.extras > 0 && <div><span>Adicionales</span><b>{money(t.extras)}</b></div>}
          {t.discount > 0 && <div><span>Descuento</span><b>− {money(t.discount)}</b></div>}
          <div className="totals__main"><span>Total</span><b>{money(t.total)}</b></div>
          <div><span>Abonado</span><b>{money(t.paid)}</b></div>
          <div className={t.balance > 0 ? 'danger' : 'brand'}><span>{t.balance > 0 ? 'Saldo pendiente' : t.balance < 0 ? 'Saldo a favor del cliente' : 'Pagado completo'}</span><b>{money(Math.abs(t.balance))}</b></div>
        </div>
        {t.balance > 0 && <button className="btn btn--ghost btn--sm self-start" onClick={() => patch({ paid: t.total })}>Marcar como pagado completo</button>}
      </div>

      <div className="card">
        <h3 className="section-label">Notas</h3>
        <label className="field"><span>Petición del cliente</span><textarea rows={2} value={b.note || ''} onChange={set('note')} /></label>
        <label className="field"><span>Notas internas (el cliente no las ve)</span><textarea rows={2} value={b.admin_note || ''} onChange={set('admin_note')} placeholder="Ej: llega en vuelo de las 4 p. m., pidió habitación en piso bajo…" /></label>
      </div>

      {!isNew && (
        <div className="card">
          <h3 className="section-label"><WhatsAppIcon size={16} /> Escribir al cliente</h3>
          <div className="row-gap wrap">
            <select className="grow" value={tpl} onChange={(e) => setTpl(e.target.value)}>
              {TEMPLATES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn btn--wa" onClick={sendMsg} disabled={!b.guest_phone}><WhatsAppIcon size={18} /> Abrir WhatsApp</button>
          </div>
          <pre className="msg-preview">{buildMessage(tpl, b, data)}</pre>
          <p className="muted tiny">Se abre WhatsApp con el mensaje listo; puedes editarlo antes de enviar.{dirty ? ' Ojo: incluye los cambios aún sin guardar.' : ''}</p>
        </div>
      )}

      {!isNew && b.history?.length > 0 && (
        <div className="card">
          <h3 className="section-label">Historial</h3>
          <ul className="history">
            {[...b.history].reverse().map((h, i) => <li key={i}><span className="muted tiny">{dateTime(h.at)}</span> {h.text}</li>)}
          </ul>
        </div>
      )}

      {!isNew && (
        <div className="card danger-zone">
          <div><strong>Eliminar reserva</strong><small className="muted">Se borra para siempre. Para solo sacarla de la lista, usa Ocultar.</small></div>
          <button className="btn btn--ghost danger" onClick={() => onDelete(b)}><Icon name="trash" size={16} /> Eliminar</button>
        </div>
      )}
    </>
  )
}

/* ---------- Diálogo de cancelación ---------- */
function CancelDialog({ booking, busy, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [notify, setNotify] = useState(!!booking.guest_phone)
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Cancelar reserva">
        <div className="sheet__head">
          <div><p className="muted small">Cancelar reserva</p><h3>{booking.code} · {booking.guest_name}</h3></div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="close" /></button>
        </div>
        <label className="field">
          <span>Motivo (se incluye en el mensaje al cliente)</span>
          <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: a solicitud del cliente, no se recibió el anticipo…" autoFocus />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={notify} disabled={!booking.guest_phone} onChange={(e) => setNotify(e.target.checked)} />
          Avisar al cliente por WhatsApp {!booking.guest_phone && <small className="muted">(no tiene teléfono)</small>}
        </label>
        <button className="btn btn--block btn--lg btn--danger" disabled={busy} onClick={() => onConfirm(reason, notify)}>
          <Icon name="ban" size={18} /> {busy ? 'Cancelando…' : 'Cancelar reserva'}
        </button>
        <p className="muted tiny center">La reserva queda en "Canceladas" y puedes reactivarla después.</p>
      </div>
    </div>
  )
}

/* ---------- Catálogo de adicionales ---------- */
function ExtrasCatalog() {
  const { data, update } = useData()
  const list = data.hotel.extras || []
  const [form, setForm] = useState({ name: '', price: '', unit: 'estadia' })
  const setList = (fn) => update((d) => ({ ...d, hotel: { ...d.hotel, extras: fn(d.hotel.extras || []) } }))
  const setX = (id, p) => setList((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)))
  const add = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setList((l) => [...l, { id: uid(), name: form.name.trim(), price: toInt(form.price), unit: form.unit, active: true }])
    setForm({ name: '', price: '', unit: form.unit })
  }
  return (
    <details className="card extras-catalog">
      <summary>
        <div><h3 className="section-label">Adicionales disponibles ({list.length})</h3><p className="muted small">Toallas, aire, ventana… El cliente los elige al reservar y tú los cambias en cada reserva.</p></div>
        <Icon name="back" className="rot-90" />
      </summary>
      <form className="row-gap wrap" onSubmit={add}>
        <input className="grow" placeholder="Nombre (ej: Toallas de playa)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <input style={{ width: 120 }} inputMode="numeric" placeholder="Precio" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        <select style={{ width: 150 }} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
          <option value="estadia">por estadía</option>
          <option value="noche">por noche</option>
        </select>
        <button className="btn btn--primary"><Icon name="plus" size={18} /></button>
      </form>
      <div className="table">
        {list.map((x) => (
          <div key={x.id} className="table-row">
            <input className="inline-input grow" value={x.name} onChange={(e) => setX(x.id, { name: e.target.value })} />
            <input className="inline-input money-input" inputMode="numeric" value={x.price} onChange={(e) => setX(x.id, { price: toInt(e.target.value) })} aria-label="Precio" />
            <select className="inline-select" value={x.unit || 'estadia'} onChange={(e) => setX(x.id, { unit: e.target.value })} aria-label="Cobro">
              <option value="estadia">por estadía</option>
              <option value="noche">por noche</option>
            </select>
            <label className="switch sm" title="Visible al reservar">
              <input type="checkbox" checked={x.active !== false} onChange={() => setX(x.id, { active: x.active === false })} />
              <span />
            </label>
            <button className="icon-btn sm danger" onClick={() => confirm(`¿Eliminar "${x.name}"?`) && setList((l) => l.filter((y) => y.id !== x.id))} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
      <p className="muted tiny">Precio 0 = sin costo. Los cambios aquí no alteran reservas ya hechas.</p>
    </details>
  )
}
