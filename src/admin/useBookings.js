import { useCallback, useEffect, useRef, useState } from 'react'
import { adminBookingDelete, adminBookingSave, adminBookings, isMissingFn } from '../supabase.js'

const POLL_MS = 30000

/**
 * Reservas del panel admin. Se recargan solas cada 30 s (mientras la pestaña esté visible)
 * para que las solicitudes que llegan desde la web aparezcan sin recargar.
 */
export function useBookings(pin) {
  const [list, setList] = useState([])
  const [state, setState] = useState('loading') // loading | ok | error | missing
  const [error, setError] = useState('')
  const [fresh, setFresh] = useState([]) // ids que llegaron mientras el panel estaba abierto
  const known = useRef(null)

  const load = useCallback(async () => {
    if (!pin) return
    try {
      const rows = await adminBookings(pin)
      if (known.current) {
        const nuevos = rows.filter((r) => !known.current.has(r.id)).map((r) => r.id)
        if (nuevos.length) setFresh((f) => [...new Set([...f, ...nuevos])])
      }
      known.current = new Set(rows.map((r) => r.id))
      setList(rows); setState('ok'); setError('')
    } catch (e) {
      setError(e.message)
      setState(isMissingFn(e) ? 'missing' : 'error')
    }
  }, [pin])

  useEffect(() => {
    load()
    const t = setInterval(() => { if (!document.hidden) load() }, POLL_MS)
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [load])

  const save = useCallback(async (b) => {
    const row = await adminBookingSave(pin, b)
    known.current?.add(row.id)
    setList((l) => (l.some((x) => x.id === row.id) ? l.map((x) => (x.id === row.id ? row : x)) : [row, ...l]))
    return row
  }, [pin])

  const remove = useCallback(async (id) => {
    await adminBookingDelete(pin, id)
    setList((l) => l.filter((x) => x.id !== id))
  }, [pin])

  const seen = useCallback((id) => setFresh((f) => f.filter((x) => x !== id)), [])

  return { list, state, error, fresh, reload: load, save, remove, seen }
}
