import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { authHeaders } from '../../auth/token'

export default function TextbookSearch() {
  const navigate = useNavigate()
  const location = useLocation()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([])
  const [offset, setOffset] = useState(0)
  const PAGE_SIZE = 30

  const currentQ = useMemo(() => {
    const sp = new URLSearchParams(location.search || '')
    return (sp.get('q') || '').trim()
  }, [location.search])

  const currentSpecialtyId = useMemo(() => {
    const sp = new URLSearchParams(location.search || '')
    return (sp.get('specialty_id') || '').trim()
  }, [location.search])

  useEffect(() => {
    setQ(currentQ)
  }, [currentQ])

  async function load(pageOffset = 0) {
    const query = (currentQ || '').trim()
    if (!query) {
      setResults([])
      setError(null)
      return
    }
    try {
      setLoading(true)
      setError(null)
      {
        const params = new URLSearchParams({ q: query, limit: String(PAGE_SIZE), offset: String(pageOffset) })
        if (currentSpecialtyId) params.set('specialty_id', currentSpecialtyId)
        const res = await fetch(`${API_BASE}/textbook/search?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        })
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const json = await res.json()
      setResults(Array.isArray(json?.results) ? json.results : [])
      setOffset(pageOffset)
      }
    } catch (e) {
      setError(e?.message || 'Search failed')
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(0)
  }, [currentQ])

  function openResult(r) {
    if (!r) return
    navigate(`/dashboard/textbook/topic/${r.target_slug}#sec-${r.section_anchor}`)
  }

  function submit(e) {
    if (e && e.preventDefault) e.preventDefault()
    const query = (q || '').trim()
    const sp = new URLSearchParams({ q: query })
    if (currentSpecialtyId) sp.set('specialty_id', currentSpecialtyId)
    navigate(`/dashboard/textbook/search?${sp.toString()}`)
  }

  return (
    <div className="tb-page">
      <header className="tb-header">
        <div className="tb-breadcrumbs">
          <button className="tb-link" onClick={() => navigate('/dashboard/textbook')}>UKMLA Textbook</button>
          <span className="tb-sep">›</span>
          <span className="tb-current">Search</span>
        </div>
        <h1 className="tb-title">Search results</h1>
        <form className="tb-search" onSubmit={submit} role="search" aria-label="Search textbook">
          <input
            className="tb-search__input"
            type="search"
            placeholder="Search textbook content…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search query"
          />
          <button className="tb-search__btn" type="submit">Search</button>
        </form>
      </header>

      {loading && (
        <LoadingScreen message="Searching…" inline />
      )}
      {error && <div className="tb-error" style={{ marginTop: 8 }}>{error}</div>}
      {!loading && !error && results.length === 0 && currentQ && (
        <div className="tb-search__status">No results found</div>
      )}

      <div className="tb-search-results" style={{ marginTop: 12 }}>
        {results.map((r, idx) => (
          <button key={`${offset}-${idx}`} className="tb-search-item" onClick={() => openResult(r)}>
            <div className="tb-search-item__titles">
              <div className="tb-search-item__page">{r.page_title}</div>
              {r.section_title && <div className="tb-search-item__section">{r.section_title}</div>}
            </div>
            <div className="tb-search-item__snippet" dangerouslySetInnerHTML={{ __html: r.snippet_html }} />
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          className="tb-search__viewall"
          onClick={() => load(Math.max(0, offset - PAGE_SIZE))}
          disabled={offset === 0 || loading}
        >Previous</button>
        <button
          className="tb-search__viewall"
          onClick={() => load(offset + PAGE_SIZE)}
          disabled={loading || results.length < PAGE_SIZE}
        >Next</button>
      </div>
    </div>
  )
}


