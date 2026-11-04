import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { SEED } from './seed.js'
import { adminCheck, adminSave, fetchRemote } from './supabase.js'

/* ---------- Caché local en IndexedDB (para abrir la PWA sin internet) ---------- */
const DB_NAME = 'caribe-diez'
const STORE = 'kv'
const KEY = 'cache'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbGet(key) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get(key)
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}
async function idbSet(key, val) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(val, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

function normalize(d) {
  return {
    hotel: { ...SEED.hotel, ...(d.hotel || {}) },
    restaurant: { ...SEED.restaurant, ...(d.restaurant || {}) },
    rooms: d.rooms || SEED.rooms,
    payments: d.payments || SEED.payments
  }
}
const seed = () => normalize(structuredClone(SEED))

/**
 * Orden de carga:
 * 1. Supabase (fuente principal, lo que ven todos)
 * 2. Caché local (sin internet)
 * 3. Datos semilla (base de datos vacía)
 */
async function loadData() {
  try {
    const remote = await fetchRemote()
    const data = remote ? normalize(remote) : seed()
    idbSet(KEY, data).catch(() => {})
    return { data, source: remote ? 'supabase' : 'seed' }
  } catch (e) {
    console.warn('Supabase no disponible:', e.message)
    try {
      const cached = await idbGet(KEY)
      if (cached) return { data: normalize(cached), source: 'cache' }
    } catch { /* sin IndexedDB */ }
    return { data: seed(), source: 'seed' }
  }
}

const PIN_KEY = 'admin-pin'
const readPin = () => { try { return sessionStorage.getItem(PIN_KEY) || '' } catch { return '' } }

const Ctx = createContext(null)

export function DataProvider({ children }) {
  const [data, setData] = useState(null)
  const [source, setSource] = useState('')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState('')
  const [pin, setPin] = useState(readPin)
  const timer = useRef(null)
  const latest = useRef(null)

  useEffect(() => { loadData().then(({ data, source }) => { setData(data); setSource(source) }) }, [])

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    const p = readPin()
    if (!p || !latest.current) return
    setSaveState('saving')
    try {
      await adminSave(p, latest.current)
      idbSet(KEY, latest.current).catch(() => {})
      setSaveState('saved'); setSaveError(''); setSource('supabase')
    } catch (e) {
      setSaveState('error'); setSaveError(e.message)
    }
  }, [])

  // Cada cambio del admin se guarda en Supabase (agrupando cambios seguidos)
  const update = useCallback((fn) => {
    setData((prev) => {
      const next = typeof fn === 'function' ? fn(prev) : fn
      latest.current = next
      return next
    })
    setSaveState('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 700)
  }, [flush])

  const reset = useCallback(() => update(seed()), [update])

  const login = useCallback(async (p) => {
    const ok = await adminCheck(p)
    if (ok) { try { sessionStorage.setItem(PIN_KEY, p) } catch { /* */ } setPin(p) }
    return ok
  }, [])
  const logout = useCallback(() => { try { sessionStorage.removeItem(PIN_KEY) } catch { /* */ } setPin('') }, [])

  // Avisar si se intenta cerrar con cambios sin guardar
  useEffect(() => {
    const h = (e) => { if (saveState === 'saving') { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [saveState])

  if (!data) return <div className="splash"><div className="spinner" /></div>
  return (
    <Ctx.Provider value={{ data, update, reset, normalize, source, saveState, saveError, retrySave: flush, pin, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export const useData = () => useContext(Ctx)

/* ---------- Favoritos (por visitante) ---------- */
export function useFavorites() {
  const read = () => { try { return JSON.parse(localStorage.getItem('favs') || '[]') } catch { return [] } }
  const [favs, setFavs] = useState(read)
  const toggle = (id) => {
    const next = favs.includes(id) ? favs.filter((f) => f !== id) : [...favs, id]
    setFavs(next)
    try { localStorage.setItem('favs', JSON.stringify(next)) } catch { /* ignore */ }
  }
  return [favs, toggle]
}
