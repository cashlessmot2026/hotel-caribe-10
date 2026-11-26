import { useState } from 'react'
import readXlsxFile from 'read-excel-file'
import Icon from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import { compressImage, downloadFile, money, uid } from '../utils.js'
import { uploadImage } from '../supabase.js'

const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

function parsePrice(v) {
  if (typeof v === 'number') return Math.round(v)
  return Number(String(v ?? '').replace(/[^\d]/g, '')) || 0
}

/** Convierte filas (array de arrays) en productos. Detecta encabezados: Producto/Nombre, Precio/Valor, Categoría. */
function rowsToItems(rows) {
  rows = rows.filter((r) => r && r.some((c) => String(c ?? '').trim() !== ''))
  if (!rows.length) return []
  const head = rows[0].map(norm)
  let iName = head.findIndex((h) => /producto|nombre|plato|item|descripcion/.test(h))
  let iPrice = head.findIndex((h) => /precio|valor|price|costo/.test(h))
  let iCat = head.findIndex((h) => /categor|tipo|seccion|grupo/.test(h))
  let body = rows.slice(1)
  if (iName < 0 || iPrice < 0) {
    iName = 0; iPrice = 1; iCat = rows[0].length > 2 ? 2 : -1
    body = parsePrice(rows[0][1]) ? rows : rows.slice(1)
  }
  return body
    .map((r) => ({ id: uid(), name: String(r[iName] ?? '').trim(), price: parsePrice(r[iPrice]), category: iCat >= 0 ? String(r[iCat] ?? '').trim() : '' }))
    .filter((i) => i.name)
}

function parseCSV(text) {
  const first = text.split(/\r?\n/)[0]
  const sep = [';', '\t', ','].sort((a, b) => first.split(b).length - first.split(a).length)[0]
  return text.split(/\r?\n/).map((line) => line.split(sep).map((c) => c.replace(/^"|"$/g, '').trim()))
}

export default function RestaurantAdmin() {
  const { data, update } = useData()
  const rest = data.restaurant
  const [preview, setPreview] = useState(null)
  const [form, setForm] = useState({ name: '', price: '', category: '' })
  const [msg, setMsg] = useState('')

  const setRest = (patch) => update((d) => ({ ...d, restaurant: { ...d.restaurant, ...patch } }))

  const onFile = async (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    try {
      const rows = /\.csv$/i.test(f.name) ? parseCSV(await f.text()) : await readXlsxFile(f)
      const items = rowsToItems(rows)
      if (!items.length) return setMsg('No se encontraron productos. Revisa que tenga columnas Producto y Precio.')
      setPreview(items); setMsg('')
    } catch (err) {
      setMsg('No se pudo leer el archivo. Usa formato .xlsx o .csv. (' + err.message + ')')
    }
  }

  const apply = (mode) => {
    setRest({ items: mode === 'replace' ? preview : [...(rest.items || []), ...preview] })
    setMsg(`✅ ${preview.length} productos cargados`)
    setPreview(null)
  }

  const addOne = (e) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setRest({ items: [...(rest.items || []), { id: uid(), name: form.name.trim(), price: parsePrice(form.price), category: form.category.trim() }] })
    setForm({ name: '', price: '', category: form.category })
  }
  const setItem = (id, patch) => setRest({ items: rest.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) })
  const delItem = (id) => setRest({ items: rest.items.filter((i) => i.id !== id) })

  const template = () => downloadFile('carta-plantilla.csv', '﻿Producto;Precio;Categoría\nDesayuno típico;18000;Desayunos\nPescado frito;45000;Platos fuertes\nLimonada de coco;12000;Bebidas\n', 'text/csv;charset=utf-8')

  return (
    <>
      <div className="admin__head">
        <div>
          <h1>Restaurante</h1>
          <p className="muted small">{rest.enabled ? 'Visible en la web para los clientes' : 'Oculto en la web · puedes prepararlo aquí y activarlo cuando quieras'}</p>
        </div>
        <label className="switch big">
          <input type="checkbox" checked={!!rest.enabled} onChange={() => setRest({ enabled: !rest.enabled })} />
          <span />
          <b>{rest.enabled ? 'Visible en la web' : 'Oculto en la web'}</b>
        </label>
      </div>

      <div className="card">
        <label className="field"><span>Nombre del restaurante</span><input value={rest.title || ''} onChange={(e) => setRest({ title: e.target.value })} /></label>
        <label className="field"><span>Descripción corta</span><textarea rows={2} value={rest.description || ''} onChange={(e) => setRest({ description: e.target.value })} placeholder="Ej: Comida típica isleña a 2 cuadras del hotel. Descuento para huéspedes." /></label>
      </div>

      <PlaceInfo rest={rest} setRest={setRest} />

      <div className="card">
        <div className="row-between">
          <h3 className="section-label">Subir carta en Excel</h3>
          <button className="link-btn" onClick={template}><Icon name="download" size={16} /> Descargar plantilla</button>
        </div>
        <p className="muted small">Columnas: <b>Producto</b>, <b>Precio</b> y (opcional) <b>Categoría</b>. Formatos .xlsx o .csv.</p>
        <label className="dropzone">
          <input type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={onFile} hidden />
          <Icon name="upload" size={28} />
          <strong>Toca para subir el archivo de la carta</strong>
        </label>
        {msg && <p className="small">{msg}</p>}
        {preview && (
          <div className="preview">
            <p><b>{preview.length}</b> productos encontrados:</p>
            <ul className="menu-list small">
              {preview.slice(0, 8).map((i) => <li key={i.id}><span>{i.name}{i.category && <em className="muted"> · {i.category}</em>}</span><i /><strong>{money(i.price)}</strong></li>)}
              {preview.length > 8 && <li className="muted">…y {preview.length - 8} más</li>}
            </ul>
            <div className="row-gap wrap">
              <button className="btn btn--primary" onClick={() => apply('replace')}>Reemplazar carta</button>
              <button className="btn btn--soft" onClick={() => apply('append')}>Agregar a la carta</button>
              <button className="btn btn--ghost" onClick={() => setPreview(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <h3 className="section-label">Productos ({rest.items?.length || 0})</h3>
        <form className="row-gap wrap" onSubmit={addOne}>
          <input className="grow" placeholder="Producto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input style={{ width: 120 }} inputMode="numeric" placeholder="Precio" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input style={{ width: 150 }} placeholder="Categoría" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <button className="btn btn--primary"><Icon name="plus" size={18} /></button>
        </form>
        <div className="table">
          {(rest.items || []).map((i) => (
            <div key={i.id} className="table-row">
              <input className="inline-input grow" value={i.name} onChange={(e) => setItem(i.id, { name: e.target.value })} />
              <input className="inline-input" style={{ width: 110 }} value={i.price} inputMode="numeric" onChange={(e) => setItem(i.id, { price: parsePrice(e.target.value) })} />
              <input className="inline-input" style={{ width: 140 }} value={i.category || ''} placeholder="Categoría" onChange={(e) => setItem(i.id, { category: e.target.value })} />
              <button className="icon-btn sm danger" onClick={() => delItem(i.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
            </div>
          ))}
        </div>
        {rest.items?.length > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => confirm('¿Vaciar toda la carta?') && setRest({ items: [] })}>Vaciar carta</button>
        )}
      </div>
    </>
  )
}

/* ---------- Datos del lugar (queda fuera del hotel) ---------- */
function PlaceInfo({ rest, setRest }) {
  const { update } = useData()
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const phones = rest.phones || []
  const images = rest.images || []

  const addPhone = (e) => {
    e.preventDefault()
    if (!phone.trim()) return
    setRest({ phones: [...phones, phone.trim()] })
    setPhone('')
  }
  const addImages = async (e) => {
    const files = [...e.target.files]
    e.target.value = ''
    setBusy(true)
    try {
      for (const f of files) {
        const url = await uploadImage(await compressImage(f), 'restaurant')
        update((d) => ({ ...d, restaurant: { ...d.restaurant, images: [...(d.restaurant.images || []), url] } }))
      }
    } catch (err) { alert('No se pudo subir una imagen: ' + err.message) }
    setBusy(false)
  }
  const moveImg = (i, dir) => {
    const j = i + dir
    if (j < 0 || j >= images.length) return
    const next = [...images]
    ;[next[i], next[j]] = [next[j], next[i]]
    setRest({ images: next })
  }

  return (
    <>
      <div className="card">
        <h3 className="section-label">Ubicación y contacto</h3>
        <p className="muted small">El restaurante queda fuera del hotel: estos datos ayudan al huésped a llegar y a pedir.</p>
        <label className="field"><span><Icon name="pin" size={16} /> Dirección</span><input value={rest.address || ''} onChange={(e) => setRest({ address: e.target.value })} placeholder="Ej: Av. Colombia #3-45, a 2 cuadras del hotel" /></label>
        <label className="field"><span>Enlace de Google Maps (opcional)</span><input value={rest.mapsUrl || ''} onChange={(e) => setRest({ mapsUrl: e.target.value })} placeholder="https://maps.app.goo.gl/…" /></label>
        <div className="grid-2">
          <label className="field"><span><Icon name="clock" size={16} /> Horario</span><input value={rest.hours || ''} onChange={(e) => setRest({ hours: e.target.value })} placeholder="Lun a Dom · 7 a. m. – 10 p. m." /></label>
          <label className="field"><span>WhatsApp para pedidos (con indicativo)</span><input value={rest.whatsapp || ''} onChange={(e) => setRest({ whatsapp: e.target.value })} placeholder="Vacío = WhatsApp del hotel" /></label>
        </div>
        <div className="field">
          <span><Icon name="phone" size={16} /> Teléfonos ({phones.length})</span>
          <form className="row-gap" onSubmit={addPhone}>
            <input className="grow" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Ej: 315 000 0000" />
            <button className="btn btn--soft"><Icon name="plus" size={18} /> Agregar</button>
          </form>
          {phones.length > 0 && (
            <div className="table">
              {phones.map((ph, i) => (
                <div key={i} className="table-row">
                  <input className="inline-input grow" value={ph} onChange={(e) => setRest({ phones: phones.map((x, j) => (j === i ? e.target.value : x)) })} />
                  <button className="icon-btn sm danger" onClick={() => setRest({ phones: phones.filter((_, j) => j !== i) })} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 className="section-label">Fotos del restaurante ({images.length})</h3>
        <label className="dropzone">
          <input type="file" accept="image/*" multiple onChange={addImages} hidden />
          <Icon name="upload" size={24} /><strong>{busy ? 'Subiendo…' : 'Agregar fotos (fachada, platos, ambiente)'}</strong>
        </label>
        {images.length > 0 && (
          <div className="img-grid">
            {images.map((src, i) => (
              <div key={src + i} className="img-tile">
                <img src={src} alt="" />
                {i === 0 && <span className="badge badge--cover">Portada</span>}
                <div className="img-tile__ops">
                  {i > 0 && <button onClick={() => moveImg(i, -1)} aria-label="Mover antes"><Icon name="back" size={14} /></button>}
                  <button className="danger" onClick={() => setRest({ images: images.filter((_, j) => j !== i) })} aria-label="Eliminar"><Icon name="trash" size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
