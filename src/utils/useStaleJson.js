import { useCallback, useEffect, useRef, useState } from 'react'

const memoryCache = new Map()
const STORAGE_PREFIX = 'stalejson:'

function now() { return Date.now() }

function readStorage(kind, key) {
  try {
    const raw = kind === 'local' ? localStorage.getItem(key) : sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}
function writeStorage(kind, key, value) {
  try {
    const raw = JSON.stringify(value)
    if (kind === 'local') localStorage.setItem(key, raw)
    else sessionStorage.setItem(key, raw)
  } catch { /* ignore */ }
}

function matches(key, match) {
  if (match == null) return true
  if (typeof match === 'function') return match(key)
  if (Array.isArray(match)) return match.some((item) => matches(key, item))
  if (typeof match === 'string') return key === match || key.startsWith(match)
  return false
}

function emitInvalidate(match) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('stalejson:invalidate', { detail: { match } }))
}

function sweepStorage(kind, match) {
  try {
    const storage = kind === 'local' ? localStorage : sessionStorage
    const remove = []
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i)
      if (!k || !k.startsWith(STORAGE_PREFIX)) continue
      if (matches(k.slice(STORAGE_PREFIX.length), match)) remove.push(k)
    }
    remove.forEach((k) => storage.removeItem(k))
  } catch { /* ignore */ }
}

/** Current in-memory value, if any. */
export function readStaleJson(cacheKey) {
  return memoryCache.get(cacheKey)?.value
}

/**
 * Write a value into the cache. ttlMs 0 means "show this now, but refetch".
 */
export function writeStaleJson(cacheKey, value, { persist = 'session', ttlMs = 0 } = {}) {
  const entry = { value, ts: ttlMs ? now() : now() - 1 }
  memoryCache.set(cacheKey, entry)
  if (persist) writeStorage(persist, `${STORAGE_PREFIX}${cacheKey}`, entry)
  emitInvalidate(cacheKey)
}

/** Drop matching keys from memory and session/local storage, then notify hooks. */
export function invalidateStaleJson(match) {
  for (const key of [...memoryCache.keys()]) {
    if (matches(key, match)) memoryCache.delete(key)
  }
  sweepStorage('session', match)
  sweepStorage('local', match)
  emitInvalidate(match)
}

export default function useStaleJson(url, options = {}) {
  const {
    headers,
    staleMs = 60000,
    persist = 'session',
    key: customKey,
    transform,
  } = options

  const cacheKey = customKey || url
  const storageKey = `${STORAGE_PREFIX}${cacheKey}`
  const optsRef = useRef({ url, headers, staleMs, persist, cacheKey, storageKey, transform })
  optsRef.current = { url, headers, staleMs, persist, cacheKey, storageKey, transform }

  const [data, setData] = useState(() => {
    const mem = memoryCache.get(cacheKey)
    if (mem && (now() - mem.ts) < staleMs * 4) return mem.value
    if (persist) {
      const stored = readStorage(persist, storageKey)
      if (stored) {
        memoryCache.set(cacheKey, { value: stored.value, ts: stored.ts })
        return stored.value
      }
    }
    return undefined
  })
  const [loading, setLoading] = useState(() => data === undefined)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const mounted = useRef(true)
  const dataRef = useRef(data)
  dataRef.current = data

  const revalidate = useCallback(async (showLoading) => {
    const o = optsRef.current
    if (showLoading && dataRef.current === undefined) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(o.url, { credentials: 'include', headers: o.headers, cache: 'no-store' })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      let json = await res.json()
      if (o.transform) json = o.transform(json)
      const entry = { value: json, ts: now() }
      memoryCache.set(o.cacheKey, entry)
      if (o.persist) writeStorage(o.persist, o.storageKey, entry)
      if (mounted.current) setData(json)
    } catch (e) {
      if (mounted.current) setError(e)
    } finally {
      if (mounted.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  const revalidateRef = useRef(revalidate)
  revalidateRef.current = revalidate

  useEffect(() => {
    mounted.current = true
    const mem = memoryCache.get(cacheKey)
    const isFresh = mem ? (now() - mem.ts) < staleMs : false

    if (!isFresh) revalidateRef.current(true)
    else revalidateRef.current(false)

    return () => { mounted.current = false }
  }, [url, cacheKey, staleMs])

  useEffect(() => {
    const onInvalidate = (event) => {
      const match = event?.detail?.match
      if (!matches(cacheKey, match)) return
      const mem = memoryCache.get(cacheKey)
      if (mem) setData(mem.value)
      else setData(undefined)
      revalidateRef.current(false)
    }
    window.addEventListener('stalejson:invalidate', onInvalidate)
    return () => window.removeEventListener('stalejson:invalidate', onInvalidate)
  }, [cacheKey])

  return { data, loading, refreshing, error, refetch: () => revalidate(true) }
}
