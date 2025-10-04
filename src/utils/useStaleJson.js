import { useEffect, useRef, useState } from 'react'

const memoryCache = new Map()

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

export default function useStaleJson(url, options = {}) {
  const {
    headers,
    staleMs = 60000,
    persist = 'session',
    key: customKey,
    transform,
  } = options

  const cacheKey = customKey || url
  const storageKey = `stalejson:${cacheKey}`

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

  useEffect(() => {
    mounted.current = true
    const mem = memoryCache.get(cacheKey)
    const isFresh = mem ? (now() - mem.ts) < staleMs : false

    if (!isFresh) revalidate(true)
    else revalidate(false) 

    return () => { mounted.current = false }
  }, [url, cacheKey])

  async function revalidate(showLoading) {
    if (showLoading && data === undefined) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await fetch(url, { credentials: 'include', headers })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      let json = await res.json()
      if (transform) json = transform(json)
      const entry = { value: json, ts: now() }
      memoryCache.set(cacheKey, entry)
      if (persist) writeStorage(persist, storageKey, entry)
      if (mounted.current) setData(json)
    } catch (e) {
      if (mounted.current) setError(e)
    } finally {
      if (!mounted.current) return
      setLoading(false)
      setRefreshing(false)
    }
  }

  return { data, loading, refreshing, error, refetch: () => revalidate(true) }
}


