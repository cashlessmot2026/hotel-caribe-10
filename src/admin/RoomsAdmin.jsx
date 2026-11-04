import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import RoomCard from '../components/RoomCard.jsx'
import { useData } from '../store.jsx'
import { compressImage, uid } from '../utils.js'
import { uploadImage } from '../supabase.js'

const EMPTY = {
  name: '', tag: '', location: '', rating: 5, available: true, bookLabel: '',
  price: '', oldPrice: '', priceUnit: 'noche',
  capacity: 2, beds: '', size: '',
  description: '', details: [], showAmenities: false, images: []
}

const SUGGESTED = [
  'Aire acondicionado', 'Wi-Fi gratis', 'Baño privado', 'Agua caliente', 'Smart TV', 'Minibar', 'Nevera',
  'Clóset', 'Escritorio', 'Balcón', 'Vista a la calle', 'Cocineta', 'Toallas y lencería', 'Caja fuerte',
  'Secador de pelo', 'Limpieza diaria', 'Desayuno incluido', 'Cuna disponible'
]

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
    if (!confirm('¿Eliminar esta habitación? Esta acción no se puede deshacer.')) return false
    update((d) => ({ ...d, rooms: d.rooms.filter((r) => r.id !== id) }))
    return true
  }
  const duplicate = (room) => update((d) => {
    const i = d.rooms.findIndex((r) => r.id === room.id)
    const copy = { ...structuredClone(room), id: uid(), name: room.name + ' (copia)' }
    const rooms = [...d.rooms]
    rooms.splice(i + 1, 0, copy)
    return { ...d, rooms }
  })
  const toggle = (id) => update((d) => ({ ...d, rooms: d.rooms.map((r) => (r.id === id ? { ...r, available: !r.available } : r)) }))
  const move = (i, dir) => update((d) => {
    const rooms = [...d.rooms]
    const j = i + dir
    if (j < 0 || j >= rooms.length) return d
    ;[rooms[i], rooms[j]] = [rooms[j], rooms[i]]
    return { ...d, rooms }
  })

  if (editing) {
    const isNew = !data.rooms.some((r) => r.id === editing.id)
    return (
      <RoomForm
        initial={editing}
        isNew={isNew}
        location={data.hotel.location}
        onCancel={() => setEditing(null)}
        onSave={save}
        onDelete={() => { if (isNew || remove(editing.id)) setEditing(null) }}
      />
    )
  }

  return (
    <>
      <div className="admin__head">
        <div><h1>Habitaciones</h1><p className="muted small">{data.rooms.length} publicadas · toca una tarjeta para editarla</p></div>
        <button className="btn btn--primary" onClick={() => setEditing({ ...EMPTY, id: uid() })}><Icon name="plus" size={18} /> Nueva habitación</button>
      </div>

      {data.rooms.length === 0 && (
        <div className="card center">
          <p className="muted">Aún no hay habitaciones.</p>
          <button className="btn btn--primary" onClick={() => setEditing({ ...EMPTY, id: uid() })}><Icon name="plus" size={18} /> Crear la primera</button>
        </div>
      )}

      <div className="admin-rooms">
        {data.rooms.map((r, i) => (
          <div className="admin-room" key={r.id}>
            <RoomCard room={r} location={data.hotel.location} preview onOpen={() => setEditing(r)} onBook={() => setEditing(r)} />
            <div className="admin-room__bar">
              <label className="switch sm" title="Disponible para reservar">
                <input type="checkbox" checked={!!r.available} onChange={() => toggle(r.id)} />
                <span />
                <b>{r.available ? 'Disponible' : 'Oculta para reservas'}</b>
              </label>
              <div className="admin-item__actions">
                <button className="icon-btn sm" onClick={() => move(i, -1)} aria-label="Mover antes" title="Mover antes" disabled={i === 0}><Icon name="back" size={16} /></button>
                <button className="icon-btn sm" onClick={() => move(i, 1)} aria-label="Mover después" title="Mover después" disabled={i === data.rooms.length - 1}><Icon name="back" className="flip" size={16} /></button>
                <button className="icon-btn sm" onClick={() => duplicate(r)} aria-label="Duplicar" title="Duplicar"><Icon name="copy" size={16} /></button>
                <button className="icon-btn sm" onClick={() => setEditing(r)} aria-label="Editar" title="Editar"><Icon name="edit" size={16} /></button>
                <button className="icon-btn sm danger" onClick={() => remove(r.id)} aria-label="Eliminar" title="Eliminar"><Icon name="trash" size={16} /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function RoomForm({ initial, isNew, location, onSave, onCancel, onDelete }) {
  const [r, setR] = useState(() => ({ ...EMPTY, ...structuredClone(initial) }))
  const [dirty, setDirty] = useState(false)
  const [newAmenity, setNewAmenity] = useState('')
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)

  const patch = (p) => { setR((cur) => ({ ...cur, ...p })); setDirty(true) }
  const set = (k) => (e) => patch({ [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })

  /* ---- Comodidades ---- */
  const details = r.details || []
  const addAmenities = (text) => {
    const parts = text.split(',').map((s) => s.trim()).filter(Boolean)
    const next = [...details]
    parts.forEach((p) => { if (!next.some((d) => d.toLowerCase() === p.toLowerCase())) next.push(p) })
    patch({ details: next })
  }
  const editAmenity = (i, val) => patch({ details: details.map((d, j) => (j === i ? val : d)) })
  const removeAmenity = (i) => patch({ details: details.filter((_, j) => j !== i) })
  const moveAmenity = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= details.length) return
    const next = [...details]
    ;[next[i], next[j]] = [next[j], next[i]]
    patch({ details: next })
  }

  /* ---- Imágenes ---- */
  const onFiles = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    try {
      for (const f of files) {
        const u = await uploadImage(await compressImage(f), 'rooms')
        setR((cur) => ({ ...cur, images: [...(cur.images || []), u] }))
        setDirty(true)
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
    if (op === 'right' && i < imgs.length - 1) [imgs[i + 1], imgs[i]] = [imgs[i], imgs[i + 1]]
    patch({ images: imgs })
  }

  const clean = () => ({
    ...r,
    name: r.name.trim(),
    details: details.map((d) => d.trim()).filter(Boolean),
    price: Number(String(r.price).replace(/\D/g, '')) || 0,
    oldPrice: Number(String(r.oldPrice ?? '').replace(/\D/g, '')) || 0,
    capacity: Number(r.capacity) || 1,
    rating: r.rating === '' ? null : Math.min(5, Math.max(0, Number(r.rating) || 0))
  })

  const submit = (e) => { e.preventDefault(); onSave(clean()) }
  const cancel = () => { if (!dirty || confirm('Tienes cambios sin guardar. ¿Salir sin guardar?')) onCancel() }

  return (
    <form onSubmit={submit} className="admin-form">
      <div className="admin__head sticky-head">
        <div>
          <button type="button" className="link-btn" onClick={cancel}><Icon name="back" size={16} /> Habitaciones</button>
          <h1>{isNew ? 'Nueva habitación' : 'Editar habitación'}</h1>
        </div>
        <div className="row-gap">
          <button type="button" className="btn btn--ghost" onClick={cancel}>Cancelar</button>
          <button className="btn btn--primary" disabled={busy || !r.name.trim()}><Icon name="check" size={18} /> Guardar</button>
        </div>
      </div>

      <div className="editor">
        <div className="editor__fields">
          {/* ---------- Tarjeta ---------- */}
          <div className="card">
            <h3 className="section-label">Información de la tarjeta</h3>
            <label className="field"><span>Nombre *</span><input required value={r.name} onChange={set('name')} placeholder="Habitación Doble Superior" /></label>
            <div className="grid-2">
              <label className="field">
                <span>Etiqueta sobre la foto</span>
                <input value={r.tag || ''} onChange={set('tag')} placeholder="Ej: 25% OFF, Más reservada" />
              </label>
              <label className="field"><span>Calificación (0 a 5)</span><input type="number" min="0" max="5" step="0.1" value={r.rating ?? ''} onChange={set('rating')} /></label>
            </div>
            <label className="field">
              <span>Ubicación que se muestra</span>
              <input value={r.location || ''} onChange={set('location')} placeholder={`Vacío = ${location}`} />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>Texto del botón</span>
                <input value={r.bookLabel || ''} onChange={set('bookLabel')} placeholder="Reservar" />
              </label>
              <label className="check-row boxed">
                <input type="checkbox" checked={!!r.available} onChange={set('available')} />
                Disponible para reservar
              </label>
            </div>
          </div>

          {/* ---------- Precio ---------- */}
          <div className="card">
            <h3 className="section-label">Precio</h3>
            <div className="grid-3">
              <label className="field"><span>Valor (COP) *</span><input required inputMode="numeric" value={r.price} onChange={set('price')} placeholder="220000" /></label>
              <label className="field"><span>Precio anterior (tachado)</span><input inputMode="numeric" value={r.oldPrice || ''} onChange={set('oldPrice')} placeholder="Opcional" /></label>
              <label className="field">
                <span>Se cobra por</span>
                <select value={r.priceUnit || 'noche'} onChange={set('priceUnit')}>
                  <option value="noche">noche</option>
                  <option value="persona">persona</option>
                  <option value="semana">semana</option>
                  <option value="mes">mes</option>
                </select>
              </label>
            </div>
          </div>

          {/* ---------- Capacidad ---------- */}
          <div className="card">
            <h3 className="section-label">Capacidad y espacio</h3>
            <div className="grid-3">
              <label className="field"><span>Personas</span><input type="number" min="1" value={r.capacity} onChange={set('capacity')} /></label>
              <label className="field"><span>Camas</span><input value={r.beds || ''} onChange={set('beds')} placeholder="2 camas dobles" /></label>
              <label className="field"><span>Tamaño</span><input value={r.size || ''} onChange={set('size')} placeholder="25 m²" /></label>
            </div>
          </div>

          {/* ---------- Descripción ---------- */}
          <div className="card">
            <h3 className="section-label">Descripción</h3>
            <textarea rows={5} value={r.description || ''} onChange={set('description')} placeholder="Cuenta cómo es la habitación, qué la hace especial…" />
            <small className="muted">{(r.description || '').length} caracteres</small>
          </div>

          {/* ---------- Comodidades ---------- */}
          <div className="card">
            <div className="row-between">
              <h3 className="section-label">Comodidades ({details.length})</h3>
              <label className="switch sm">
                <input type="checkbox" checked={!!r.showAmenities} onChange={set('showAmenities')} />
                <span />
                <b>Mostrar 3 en la tarjeta</b>
              </label>
            </div>

            <div className="amenity-list">
              {details.length === 0 && <p className="muted small">Sin comodidades. Agrega abajo o elige de las sugeridas.</p>}
              {details.map((d, i) => (
                <div className="amenity-row" key={i}>
                  <Icon name="check" size={16} className="brand" />
                  <input className="inline-input grow" value={d} onChange={(e) => editAmenity(i, e.target.value)} aria-label={`Comodidad ${i + 1}`} />
                  <button type="button" className="icon-btn sm" onClick={() => moveAmenity(i, -1)} disabled={i === 0} aria-label="Subir"><Icon name="back" className="rot90" size={14} /></button>
                  <button type="button" className="icon-btn sm" onClick={() => moveAmenity(i, 1)} disabled={i === details.length - 1} aria-label="Bajar"><Icon name="back" className="rot-90" size={14} /></button>
                  <button type="button" className="icon-btn sm danger" onClick={() => removeAmenity(i)} aria-label="Quitar"><Icon name="trash" size={14} /></button>
                </div>
              ))}
            </div>

            <div className="row-gap">
              <input
                className="grow"
                value={newAmenity}
                onChange={(e) => setNewAmenity(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAmenities(newAmenity); setNewAmenity('') } }}
                placeholder="Nueva comodidad (puedes separar varias con comas)"
              />
              <button type="button" className="btn btn--soft" onClick={() => { addAmenities(newAmenity); setNewAmenity('') }}><Icon name="plus" size={18} /> Agregar</button>
            </div>

            <div>
              <small className="muted">Sugeridas — toca para agregar:</small>
              <div className="suggest">
                {SUGGESTED.filter((s) => !details.some((d) => d.toLowerCase() === s.toLowerCase())).map((s) => (
                  <button type="button" key={s} onClick={() => addAmenities(s)}><Icon name="plus" size={13} /> {s}</button>
                ))}
              </div>
            </div>
            {details.length > 0 && (
              <button type="button" className="btn btn--ghost btn--sm danger self-start" onClick={() => confirm('¿Quitar todas las comodidades?') && patch({ details: [] })}>Quitar todas</button>
            )}
          </div>

          {/* ---------- Imágenes ---------- */}
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
              <button type="button" className="btn btn--soft" onClick={() => { if (url.trim()) { patch({ images: [...(r.images || []), url.trim()] }); setUrl('') } }}>Añadir</button>
            </div>
            <div className="img-grid">
              {(r.images || []).map((src, i) => (
                <div key={src + i} className="img-tile">
                  <img src={src} alt="" />
                  {i === 0 && <span className="badge badge--cover">Portada</span>}
                  <div className="img-tile__ops">
                    {i > 0 && <button type="button" onClick={() => imgOp(i, 'cover')} title="Hacer portada"><Icon name="star" size={14} /></button>}
                    {i > 0 && <button type="button" onClick={() => imgOp(i, 'left')} title="Mover antes"><Icon name="back" size={14} /></button>}
                    {i < r.images.length - 1 && <button type="button" onClick={() => imgOp(i, 'right')} title="Mover después"><Icon name="back" className="flip" size={14} /></button>}
                    <button type="button" className="danger" onClick={() => imgOp(i, 'del')} title="Eliminar"><Icon name="trash" size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {!isNew && (
            <div className="card danger-zone">
              <div>
                <strong>Eliminar habitación</strong>
                <small className="muted">Se quitará de la web para todos los visitantes.</small>
              </div>
              <button type="button" className="btn btn--ghost danger" onClick={onDelete}><Icon name="trash" size={16} /> Eliminar</button>
            </div>
          )}
        </div>

        {/* ---------- Vista previa en vivo ---------- */}
        <aside className="editor__preview">
          <p className="eyebrow">Vista previa en vivo</p>
          <RoomCard room={clean()} location={location} preview />
          <button className="btn btn--primary btn--block" disabled={busy || !r.name.trim()}><Icon name="check" size={18} /> Guardar cambios</button>
        </aside>
      </div>
    </form>
  )
}
