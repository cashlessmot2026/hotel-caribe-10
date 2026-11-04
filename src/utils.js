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

export function openWhatsApp(number, text) {
  const url = `https://wa.me/${onlyDigits(number)}?text=${encodeURIComponent(text)}`
  // En la PWA instalada / móviles, ir directo abre la app de WhatsApp de forma más fiable
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const w = standalone ? null : window.open(url, '_blank')
  if (w) w.opener = null
  else window.location.href = url
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
