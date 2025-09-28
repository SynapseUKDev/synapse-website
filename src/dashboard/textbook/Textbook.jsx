import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { authHeaders } from '../../auth/token'

function ChapterCard({ specialty, onClick }) {
  const bgStyle = {
    background: `linear-gradient(135deg, ${specialty.icon_bg_start || '#2E2CC4'} 0%, ${specialty.icon_bg_end || '#3C92C1'} 100%)`
  }
  return (
    <button className="tb-card" onClick={onClick} aria-label={`Open ${specialty.specialty_name || specialty.name}`}>
      <div className="tb-card__cover" style={bgStyle}>
        <div className="tb-card__spine" />
      </div>
      <div className="tb-card__label">
        <div className="tb-card__title">{specialty.specialty_name || specialty.name}</div>
        {Array.isArray(specialty.topics) && (
          <div className="tb-card__meta">{specialty.topics.length} topics</div>
        )}
      </div>
    </button>
  )
}

function TopicRow({ topic, onClick }) {
  const hasPage = !!topic.has_page || !!(topic.textbook_pages && topic.textbook_pages[0]) || !!topic.page
  return (
    <div className={`tb-topic ${hasPage ? 'tb-topic--has-page' : 'tb-topic--no-page'}`}>
      <div className="tb-topic__name" onClick={onClick} role="button" tabIndex={0}>
        {topic.topic_name || topic.name}
      </div>
      <div className="tb-topic__status">{hasPage ? 'Published' : 'Coming soon'}</div>
    </div>
  )
}

export default function Textbook() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        if (!slug) {
          const res = await fetch(`${API_BASE}/textbook/outline`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
          if (!res.ok) throw new Error(`Failed to load outline: ${res.status}`)
          const json = await res.json()
          if (!cancelled) setData(json)
        } else {
          const res = await fetch(`${API_BASE}/textbook/specialty/${slug}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
          if (!res.ok) throw new Error(`Failed to load specialty: ${res.status}`)
          const json = await res.json()
          if (!cancelled) setData(json)
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load textbook')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, API_BASE])

  const chapterList = useMemo(() => {
    if (!data) return []
    if (data.specialties) return data.specialties
    if (data.specialty) return [data.specialty]
    return []
  }, [data])

  if (loading) {
    return (
      <div className="tb-page">
        <LoadingScreen message={slug ? 'Loading specialty…' : 'Loading textbook…'} inline />
      </div>
    )
  }
  if (error) return <div className="tb-error">{error}</div>

  // Specialty topics view
  if (slug && data?.topics) {
    return (
      <div className="tb-page">
        <header className="tb-header">
          <div className="tb-breadcrumbs">
            <button className="tb-link" onClick={() => navigate('/dashboard/textbook')}>UKMLA Textbook</button>
            <span className="tb-sep">›</span>
            <span className="tb-current">{data.specialty?.name}</span>
          </div>
          <h1 className="tb-title">{data.specialty?.name}</h1>
          <p className="tb-sub">Select a topic to open the chapter.</p>
        </header>
        <div className="tb-topic-list">
          {data.topics.map((t) => (
            <TopicRow key={t.id} topic={t} onClick={() => navigate(`/dashboard/textbook/topic/${t.slug}`)} />
          ))}
        </div>
      </div>
    )
  }

  // Textbook dashboard view
  return (
    <div className="tb-page">
      <header className="tb-header">
        <div className="tb-breadcrumbs">
          <span className="tb-current">UKMLA Textbook</span>
        </div>
        <h1 className="tb-title">Chapters</h1>
        <p className="tb-sub">Browse specialties as chapters. Click a chapter to view its topics.</p>
      </header>
      <div className="tb-grid">
        {chapterList.map((spec) => (
          <ChapterCard
            key={spec.specialty_id || spec.id}
            specialty={spec}
            onClick={() => navigate(`/dashboard/textbook/specialty/${spec.specialty_slug || spec.slug}`)}
          />
        ))}
      </div>
    </div>
  )
}


