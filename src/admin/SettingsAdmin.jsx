import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import { compressImage, downloadFile } from '../utils.js'
import { adminSetPin, uploadImage } from '../supabase.js'

export default function SettingsAdmin() {
  const { data, update, reset, normalize, pin, login } = useData()
  const h = data.hotel
  const [newPin, setNewPin] = useState('')
  const [busy, setBusy] = useState(false)
  const setH = (k) => (e) => update((d) => ({ ...d, hotel: { ...d.hotel, [k]: e.target.value } }))

  const exportData = () => downloadFile(`caribe-diez-respaldo-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2))
  const importData = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const json = JSON.parse(await f.text())
      if (!json.rooms) throw new Error('Archivo inválido')
      if (!confirm('Esto reemplazará todo el contenido de la web. ¿Continuar?')) return
      update(normalize(json))
    } catch (err) { alert('No se pudo importar: ' + err.message) }
  }
  const addGallery = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    setBusy(true)
    try {
      for (const f of files) {
        const url = await uploadImage(await compressImage(f), 'gallery')
        update((d) => ({ ...d, hotel: { ...d.hotel, gallery: [...(d.hotel.gallery || []), url] } }))
      }
    } catch (err) { alert('No se pudo subir una imagen: ' + err.message) }
    setBusy(false)
  }
  const delGallery = (i) => update((d) => ({ ...d, hotel: { ...d.hotel, gallery: d.hotel.gallery.filter((_, j) => j !== i) } }))

  const changePin = async () => {
    if (newPin.length < 4) return alert('Mínimo 4 caracteres')
    try {
      await adminSetPin(pin, newPin)
      await login(newPin)
      setNewPin('')
      alert('Clave actualizada ✅')
    } catch (err) { alert('No se pudo cambiar: ' + err.message) }
  }

  return (
    <>
      <div className="admin__head"><div><h1>Ajustes</h1><p className="muted small">Información general del hotel</p></div></div>

      <div className="card">
        <div className="grid-2">
          <label className="field"><span>Nombre del hotel</span><input value={h.name} onChange={setH('name')} /></label>
          <label className="field"><span>Ubicación</span><input value={h.location} onChange={setH('location')} /></label>
          <label className="field"><span>WhatsApp de reservas (con indicativo)</span><input value={h.whatsapp} onChange={setH('whatsapp')} placeholder="573157981773" /></label>
          <div className="grid-2">
            <label className="field"><span>Check-in</span><input value={h.checkInTime} onChange={setH('checkInTime')} /></label>
            <label className="field"><span>Check-out</span><input value={h.checkOutTime} onChange={setH('checkOutTime')} /></label>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Reseñas de Google</h3>
        <label className="field"><span>Enlace "Ver reseñas"</span><input value={h.reviewsUrl} onChange={setH('reviewsUrl')} /></label>
        <label className="field">
          <span>Place ID de Google (opcional — abre directo "Escribir reseña")</span>
          <input value={h.placeId} onChange={setH('placeId')} placeholder="ChIJ…" />
        </label>
        <p className="muted tiny">Búscalo en developers.google.com/maps/documentation/places/web-service/place-id</p>
      </div>

      <div className="card">
        <h3 className="section-label">Galería del hotel ({h.gallery?.length || 0})</h3>
        <label className="dropzone">
          <input type="file" accept="image/*" multiple onChange={addGallery} hidden />
          <Icon name="upload" size={24} /><strong>{busy ? 'Subiendo…' : 'Agregar fotos del hotel'}</strong>
        </label>
        <div className="img-grid">
          {(h.gallery || []).map((src, i) => (
            <div key={i} className="img-tile">
              <img src={src} alt="" />
              <div className="img-tile__ops"><button className="danger" onClick={() => delGallery(i)}><Icon name="trash" size={14} /></button></div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Clave de administrador</h3>
        <div className="row-gap">
          <input className="grow" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Nueva clave" />
          <button className="btn btn--soft" onClick={changePin}>Cambiar</button>
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Respaldo</h3>
        <p className="muted small">Todo se guarda automáticamente en la base de datos (Supabase). Aquí puedes descargar una copia o restaurarla.</p>
        <div className="row-gap wrap">
          <button className="btn btn--primary" onClick={exportData}><Icon name="download" size={18} /> Descargar respaldo</button>
          <label className="btn btn--soft">
            <Icon name="upload" size={18} /> Restaurar respaldo
            <input type="file" accept="application/json,.json" hidden onChange={importData} />
          </label>
          <button className="btn btn--ghost danger" onClick={() => confirm('¿Volver a los datos de ejemplo? Se reemplazará todo el contenido publicado.') && reset()}>Datos de ejemplo</button>
        </div>
      </div>
    </>
  )
}
