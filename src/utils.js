export const money = (n) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(n) || 0)

export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export const todayISO = () => {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}

export const addDays = (iso, n) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export const nightsBetween = (a, b) => {
  if (!a || !b) return 0
  return Math.max(0, Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000))
}

export const prettyDate = (iso) =>
  iso
    ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
    : ''

export const onlyDigits = (s) => String(s || '').replace(/\D/g, '')

/** Teléfono a formato WhatsApp: solo dígitos y con indicativo de Colombia si es un celular de 10 dígitos. */
export function normalizePhone(s) {
  const d = onlyDigits(s)
  return d.length === 10 && d.startsWith('3') ? '57' + d : d
}

export const waUrl = (number, text) => `https://wa.me/${normalizePhone(number)}?text=${encodeURIComponent(text)}`
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches

export function openWhatsApp(number, text) {
  const url = waUrl(number, text)
  // En la PWA instalada / móviles, ir directo abre la app de WhatsApp de forma más fiable
  const w = isStandalone() ? null : window.open(url, '_blank')
  if (w) w.opener = null
  else window.location.href = url
}

/**
 * Para abrir WhatsApp DESPUÉS de guardar algo: abre la pestaña en el mismo clic
 * (así el navegador no la bloquea) y luego la dirige al chat.
 */
export function prepareWhatsApp() {
  const w = isStandalone() ? null : window.open('', '_blank')
  return {
    go(number, text) {
      const url = waUrl(number, text)
      if (w && !w.closed) { try { w.opener = null } catch { /* */ } w.location.href = url } else window.location.href = url
    },
    cancel() { if (w && !w.closed) w.close() }
  }
}

/* ---------- Reservas ---------- */
export const STATUS = {
  pendiente: { label: 'Pendiente', short: 'Pendiente' },
  confirmada: { label: 'Confirmada', short: 'Confirmada' },
  checkin: { label: 'Hospedado (check-in)', short: 'Hospedado' },
  checkout: { label: 'Finalizada (check-out)', short: 'Finalizada' },
  cancelada: { label: 'Cancelada', short: 'Cancelada' },
  no_show: { label: 'No llegó', short: 'No llegó' }
}

export const extraUnit = (u) => (u === 'noche' ? 'por noche' : 'por estadía')

/** Valor de un adicional dentro de una reserva */
export const extraTotal = (e, nights) =>
  (Number(e.price) || 0) * (Number(e.qty) || 1) * (e.unit === 'noche' ? Math.max(nights, 1) : 1)

/** Misma fórmula que booking_total() en la base de datos */
export function bookingTotals(b) {
  const nights = nightsBetween(b.check_in, b.check_out)
  const base = nights * (Number(b.price_night) || 0)
  const extras = (b.extras || []).reduce((s, e) => s + extraTotal(e, nights), 0)
  const discount = Number(b.discount) || 0
  const total = Math.max(0, base + extras - discount)
  const paid = Number(b.paid) || 0
  return { nights, base, extras, discount, total, paid, balance: total - paid }
}

export const shortDate = (iso) =>
  iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }) : '—'

export const dateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : ''

/** Celdas para CSV (Excel en español usa ;) */
export const csvCell = (v) => {
  const s = String(v ?? '')
  return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

/** Reduce imágenes subidas por el admin (máx 1600px, JPEG) para que quepan en el navegador. */
export function compressImage(file, max = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload = () => {
      const img = new Image()
      img.onerror = reject
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * scale)
        c.height = Math.round(img.height * scale)
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
        resolve(c.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

export function downloadFile(name, content, type = 'application/json') {
  const blob = new Blob([content], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function reviewLinks(hotel) {
  const view = hotel.reviewsUrl || `https://www.google.com/maps?cid=${hotel.mapsCid}`
  const write = hotel.placeId
    ? `https://search.google.com/local/writereview?placeid=${hotel.placeId}`
    : `https://www.google.com/maps?cid=${hotel.mapsCid}`
  const embed = `https://maps.google.com/maps?q=${encodeURIComponent(hotel.name + ' ' + (hotel.location || ''))}&z=16&output=embed`
  return { view, write, embed }
}
