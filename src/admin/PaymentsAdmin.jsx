import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import { useData } from '../store.jsx'
import { uid } from '../utils.js'

export default function PaymentsAdmin() {
  const { data, update } = useData()
  const [name, setName] = useState('')
  const [details, setDetails] = useState('')

  const setP = (id, patch) => update((d) => ({ ...d, payments: d.payments.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const add = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    update((d) => ({ ...d, payments: [...d.payments, { id: uid(), name: name.trim(), details: details.trim(), enabled: true }] }))
    setName(''); setDetails('')
  }
  const remove = (id) => confirm('¿Eliminar este medio de pago?') && update((d) => ({ ...d, payments: d.payments.filter((p) => p.id !== id) }))

  return (
    <>
      <div className="admin__head"><div><h1>Medios de pago</h1><p className="muted small">Se muestran en cada habitación y al reservar</p></div></div>
      <form className="card row-gap wrap" onSubmit={add}>
        <input className="grow" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre (ej: Daviplata)" />
        <input className="grow" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Detalle (ej: número de cuenta)" />
        <button className="btn btn--primary"><Icon name="plus" size={18} /> Agregar</button>
      </form>
      <div className="admin-list">
        {data.payments.map((p) => (
          <div className="admin-item" key={p.id}>
            <div className="admin-item__img icon"><Icon name="card" /></div>
            <div className="admin-item__info grow">
              <input className="inline-input strong" value={p.name} onChange={(e) => setP(p.id, { name: e.target.value })} />
              <input className="inline-input" value={p.details || ''} placeholder="Detalle" onChange={(e) => setP(p.id, { details: e.target.value })} />
            </div>
            <label className="switch" title="Activo">
              <input type="checkbox" checked={!!p.enabled} onChange={() => setP(p.id, { enabled: !p.enabled })} />
              <span />
            </label>
            <button className="icon-btn sm danger" onClick={() => remove(p.id)} aria-label="Eliminar"><Icon name="trash" size={16} /></button>
          </div>
        ))}
      </div>
    </>
  )
}
