import { createClient } from '@supabase/supabase-js'

// La clave "publishable" está hecha para ir en el navegador; la escritura está protegida por la clave del admin (RPC).
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://gnmkfgiarulrhdegcahg.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_JL8-q199JEHBMonSM0Bf-w_JiECg_N5'

export const supabase = createClient(URL, KEY, { auth: { persistSession: false } })

/** Lee todo el contenido. Devuelve null si la base aún no tiene datos (schema sin cargar o vacía). */
export async function fetchRemote() {
  const [s, r, p, m] = await Promise.all([
    supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('rooms').select('*').order('position'),
    supabase.from('payments').select('*').order('position'),
    supabase.from('menu_items').select('*').order('position')
  ])
  const err = s.error || r.error || p.error || m.error
  if (err) throw err
  if (!s.data) return null
  return {
    hotel: s.data.hotel,
    rooms: r.data.map(({ position, updated_at, extra, ...room }) => ({ ...(extra || {}), ...room, price: Number(room.price), rating: room.rating == null ? null : Number(room.rating) })),
    payments: p.data.map(({ position, ...x }) => x),
    restaurant: {
      ...(s.data.restaurant || {}),
      enabled: s.data.restaurant_enabled,
      title: s.data.restaurant_title,
      items: m.data.map(({ position, ...x }) => ({ ...x, price: Number(x.price) }))
    }
  }
}

export async function adminCheck(pin) {
  const { data, error } = await supabase.rpc('admin_check', { p_pin: pin })
  if (error) throw error
  return data === true
}

export async function adminSave(pin, data) {
  const payload = { hotel: data.hotel, rooms: data.rooms, payments: data.payments, restaurant: data.restaurant }
  const { error } = await supabase.rpc('admin_save', { p_pin: pin, p_data: payload })
  if (error) throw error
}

export async function adminSetPin(oldPin, newPin) {
  const { error } = await supabase.rpc('admin_set_pin', { p_old: oldPin, p_new: newPin })
  if (error) throw error
}

/* ---------- Reservas ---------- */

/** La función no existe todavía: falta ejecutar supabase/schema.sql */
export const isMissingFn = (e) => e?.code === 'PGRST202' || /could not find the function/i.test(e?.message || '')

const NUMS = ['price_night', 'discount', 'total', 'paid', 'guests']
const fromRow = (r) => {
  const b = { ...r }
  NUMS.forEach((k) => { b[k] = Number(b[k]) || 0 })
  b.extras = (b.extras || []).map((e) => ({ ...e, price: Number(e.price) || 0, qty: Number(e.qty) || 1 }))
  b.history = b.history || []
  return b
}

/** Registra una solicitud desde la web. Devuelve el código (ej. CD-1001). */
export async function createBooking(b) {
  const { data, error } = await supabase.rpc('create_booking', { p: b })
  if (error) throw error
  return data
}

export async function adminBookings(pin) {
  const { data, error } = await supabase.rpc('admin_bookings', { p_pin: pin })
  if (error) throw error
  return (data || []).map(fromRow)
}

export async function adminBookingSave(pin, b) {
  const { data, error } = await supabase.rpc('admin_booking_save', { p_pin: pin, p: b })
  if (error) throw error
  return fromRow(data)
}

export async function adminBookingDelete(pin, id) {
  const { error } = await supabase.rpc('admin_booking_delete', { p_pin: pin, p_id: id })
  if (error) throw error
}

/** Sube una imagen (dataURL ya comprimida) al bucket "hotel" y devuelve su URL pública. */
export async function uploadImage(dataUrl, folder = 'rooms') {
  const blob = await (await fetch(dataUrl)).blob()
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from('hotel').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' })
  if (error) throw error
  return supabase.storage.from('hotel').getPublicUrl(path).data.publicUrl
}
