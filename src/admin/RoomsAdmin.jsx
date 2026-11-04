import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import { compressImage, money, uid } from '../utils.js'
import { uploadImage } from '../supabase.js'

const EMPTY = { name: '', price: '', capacity: 2, beds: '', size: '', rating: 5, available: true, details: [], description: '', images: [] }

export default function RoomsAdmin() {
  const { data, update } = useData()
  const [editing, setEditing] = useState(null)

  const save = (room) => {
    update((d) => {
      const exists = d.rooms.some((r) => r.id === room.id)
      return { ...d, rooms: exists ? d.rooms.map((r) => (r.id === room.id ? room : r)) : [...d.rooms, room] }
    })
    setEditing(null)
  }
  const remove = (id) => {
    if (!confirm('¿Eliminar esta habitación?')) return
    update((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id) }))
  }
  const toggle = (id) => update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, available: !r.available } : r)) }))
  const move = (i, dir) => update((d) => {
    const rooms = [...d.rooms]
    const j = i + dir
    if (j < 0 || j >= rooms.length) return d
    ;[rooms[i], rooms[j]] = [rooms[j], rooms[i]]
    return { ...d, rooms }
  })

  if (editing) return <RoomForm initial={editing} onCancel={() => setEditing(null)} onSave={save} />

  return (
    <>
      <div className="admin__head">
        <div><h1>Habitaciones</h1><p className="muted small">{data.rooms.length} publicadas</p></div>
        <button className="btn btn--primary" onClick={() => setEditing({ ...EMPTY, id: uid() })}><Icon name="plus" size={18} /> Nueva habitación</button>
      </div>
      <div className="admin-list">
        {data.rooms.map((r, i) => (
          <div className="admin-item" key={r.id}>
            <div className="admin-item__img">{r.images?.[0] ? <img src={r.images[0]} alt="" /> : <Icon name="image" />}</div>
            <div className="admin-item__info">
              <strong>{r.name}</strong>
              <small className="muted">{money(r.price)}/noche · {r.capacity} pers. · {r.images?.length || 0} fotos</small>
            </div>
            <label className="switch" title="Disponible">
              <input type="checkbox" checked={!!r.available} onChange={() => toggle(r.id)} />
              <span />
            </label>
            <div className="admin-item__actions">
              <button className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Subir" disabled={i === 0}><Icon name="back" className="rot90" size={16} /></button>
              <button className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Bajar" disabled={i === data.rooms.length - 1}><Icon name="back" className="rot-90" size={16} /></button>
              <button className="icon-btn sm" onClick={() => setEditing(r)} aria-label="Editar"><Icon name="edit" size={16} /></button>
              <button className="icon-btn sm danger" onClick={() => remove(r.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function RoomForm({ initial, onSave, onCancel }) {
  const [r, setR] = useState(() => structuredClone(initial))
  const [detail, setDetail] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setR({ ...r, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  const addDetail = () => {
    const parts = detail.split(',').map((s) => s.trim()).filter(Boolean)
    if (parts.length) setR({ ...r, details: [...new Set([...(r.details || []), ...parts])] })
    setDetail('')
  }

  const onFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      // Se suben de a una para que se vayan viendo y no se pierdan las que ya subieron si una falla
      for (const f of files) {
        const url = await uploadImage(await compressImage(f), 'rooms')
        setR((cur) => ({ ...cur, images: [...(cur.images || []), url] }))
      }
    } catch (err) {
      alert('No se pudo subir una imagen: ' + err.message)
    }
    setBusy(false)
  }

  const imgOp = (i, op) => {
    const imgs = [...r.images]
    if (op === 'del') imgs.splice(i, 1)
    if (op === 'cover') imgs.unshift(imgs.splice(i, 1)[0])
    if (op === 'left' && i > 0) [imgs[i - 1], imgs[i]] = [imgs[i], imgs[i - 1]]
    setR({ ...r, images: imgs })
  }

  const submit = (e) => {
    e.preventDefault()
    onSave({ ...r, price: Number(String(r.price).replace(/\D/g, '')) || 0, capacity: Number(r.capacity) || 1, rating: Number(r.rating) || 0 })
  }

  return (
    <form onSubmit={submit} className="admin-form">
      <div className="admin__head">
        <div><h1>{initial.name ? 'Editar habitación' : 'Nueva habitación'}</h1></div>
        <div className="row-gap">
          <button type="button" className="btn btn--ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn--primary" disabled={busy}><Icon name="check" size={18} /> Guardar</button>
        </div>
      </div>

      <div className="card">
        <label className="field"><span>Nombre</span><input required value={r.name} onChange={set('name')} placeholder="Habitación Doble Superior" /></label>
        <div className="grid-3">
          <label className="field"><span>Valor por noche (COP)</span><input required inputMode="numeric" value={r.price} onChange={set('price')} placeholder="220000" /></label>
          <label className="field"><span>Capacidad (personas)</span><input type="number" min="1" value={r.capacity} onChange={set('capacity')} /></label>
          <label className="field"><span>Calificación (0-5)</span><input type="number" min="0" max="5" step="0.1" value={r.rating} onChange={set('rating')} /></label>
        </div>
        <div className="grid-2">
          <label className="field"><span>Camas</span><input value={r.beds} onChange={set('beds')} placeholder="2 camas dobles" /></label>
          <label className="field"><span>Tamaño</span><input value={r.size} onChange={set('size')} placeholder="25 m²" /></label>
        </div>
        <label className="field"><span>Descripción</span><textarea rows={4} value={r.description} onChange={set('description')} /></label>
        <label className="check-row"><input type="checkbox" checked={!!r.available} onChange={set('available')} /> Disponible para reservar</label>
      </div>

      <div className="card">
        <h3 className="section-label">Detalles / comodidades</h3>
        <div className="row-gap">
          <input
            className="grow"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDetail() } }}
            placeholder="Ej: Aire acondicionado, Wi-Fi, Balcón (separa con comas)"
          />
          <button type="button" className="btn btn--soft" onClick={addDetail}><Icon name="plus" size={18} /> Agregar</button>
        </div>
        <div className="tags">
          {(r.details || []).map((d) => (
            <span key={d}>{d}<button type="button" onClick={() => setR({ ...r, details: r.details.filter((x) => x !== d) })} aria-label="Quitar">×</button></span>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <h3 className="section-label">Imágenes ({r.images?.length || 0})</h3>
          <small className="muted">Sin límite · la primera es la portada</small>
        </div>
        <label className="dropzone">
          <input type="file" accept="image/*" multiple onChange={onFiles} hidden />
          <Icon name="upload" size={28} />
          <strong>{busy ? 'Subiendo imágenes…' : 'Toca para subir fotos'}</strong>
          <small className="muted">Puedes seleccionar varias a la vez</small>
        </label>
        <div className="row-gap">
          <input className="grow" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="…o pega un enlace de imagen (https://…)" />
          <button type="button" className="btn btn--soft" onClick={() => { if (url.trim()) { setR({ ...r, images: [...(r.images || []), url.trim()] }); setUrl('') } }}>Añadir</button>
        </div>
        <div className="img-grid">
          {(r.images || []).map((src, i) => (
            <div key={i} className="img-tile">
              <img src={src} alt="" />
              {i === 0 && <span className="badge badge--cover">Portada</span>}
              <div className="img-tile__ops">
                {i > 0 && <button type="button" onClick={() => imgOp(i, 'cover')} title="Hacer portada"><Icon name="star" size={14} /></button>}
                {i > 0 && <button type="button" onClick={() => imgOp(i, 'left')} title="Mover antes"><Icon name="back" size={14} /></button>}
                <button type="button" className="danger" onClick={() => imgOp(i, 'del')} title="Eliminar"><Icon name="trash" size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </form>
  )
}
