import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { authHeaders } from '../../auth/token'

function ChapterCard({ specialty, onClick, priority = false }) {
  const bgStyle = {
    background: `linear-gradient(135deg, ${specialty.icon_bg_start || '#2E2CC4'} 0%, ${specialty.icon_bg_end || '#3C92C1'} 100%)`
  }
  const img = specialty.thumbnail_url
  return (
    <button className="tb-card" onClick={onClick} aria-label={`Open ${specialty.specialty_name || specialty.name}`}>
      <div className="tb-card__cover" style={bgStyle}>
        {img && (
          <img
            className="tb-card__img"
            src={`${img}?width=640&height=360&quality=65&format=webp&resize=cover`}
            srcSet={`${img}?width=320&height=180&quality=60&format=webp&resize=cover 320w, ${img}?width=640&height=360&quality=65&format=webp&resize=cover 640w, ${img}?width=960&height=540&quality=65&format=webp&resize=cover 960w`}
            sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 320px"
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchpriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        )}
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
    <button
      className={`tb-topic ${hasPage ? 'tb-topic--has-page' : 'tb-topic--no-page'}`}
      onClick={hasPage ? onClick : undefined}
      disabled={!hasPage}
      aria-disabled={!hasPage}
    >
      <div className="tb-topic__name">
        {topic.topic_name || topic.name}
      </div>
    </button>
  )
}

function Chevron({ open }) {
  return (
    <span className={`tb-chevron ${open ? 'tb-chevron--open' : ''}`} aria-hidden="true">⌄</span>
  )
}

function SubtopicNode({ node, depth, onSubtopicClick, expandedSet, toggleExpanded }) {
  const children = Array.isArray(node.children) ? node.children : []
  const hasChildren = children.length > 0
  const hasPage = !!node.has_page || !!(node.textbook_pages && node.textbook_pages[0])
  const isOpen = expandedSet.has(node.slug)
  return (
    <div className="tb-subtopic-row" style={{ ['--depth']: depth }}>
      <div className="tb-subtopic-row__head">
        {hasChildren ? (
          <button
            type="button"
            className="tb-topic tb-topic--parent tb-topic--toggle"
            onClick={() => toggleExpanded(node.slug)}
            aria-expanded={isOpen ? 'true' : 'false'}
            aria-controls={`subs-${node.slug}`}
          >
            <div className="tb-topic__name">{node.name}</div>
            <Chevron open={isOpen} />
          </button>
        ) : (
          <button
            type="button"
            className={`tb-topic ${hasPage ? 'tb-topic--has-page' : 'tb-topic--no-page'}`}
            onClick={hasPage ? () => onSubtopicClick(node) : undefined}
            disabled={!hasPage}
            aria-disabled={!hasPage}
          >
            <div className="tb-topic__name">{node.name}</div>
          </button>
        )}
      </div>
      {hasChildren && isOpen && (
        <div id={`subs-${node.slug}`} className="tb-subtopics">
          {children.map((child) => (
            <SubtopicNode
              key={child.id}
              node={child}
              depth={(depth || 0) + 1}
              onSubtopicClick={onSubtopicClick}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TopicWithSubtopics({ topic, expandedSet, toggleExpanded, onSubtopicClick }) {
  const subtopics = Array.isArray(topic.subtopics) ? topic.subtopics : []
  const isOpen = expandedSet.has(topic.slug)
  return (
    <div className="tb-topic-group">
      <button
        className="tb-topic tb-topic--parent"
        onClick={() => toggleExpanded(topic.slug)}
        aria-expanded={isOpen ? 'true' : 'false'}
        aria-controls={`subs-${topic.slug}`}
      >
        <div className="tb-topic__name">
          {topic.name}
        </div>
        <Chevron open={isOpen} />
      </button>
      {isOpen && (
        <div id={`subs-${topic.slug}`} className="tb-subtopics">
          {subtopics.map((st) => (
            <SubtopicNode
              key={st.id}
              node={st}
              depth={1}
              onSubtopicClick={onSubtopicClick}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Textbook() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [expandedSet, setExpandedSet] = useState(new Set())

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Toggle expand/collapse for topics/subtopics by slug
  const toggleExpanded = (slugValue) => {
    setExpandedSet((prev) => {
      const next = new Set(prev)
      if (next.has(slugValue)) next.delete(slugValue); else next.add(slugValue)
      return next
    })
  }

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

  // Default-expand all topics and subtopics once when the specialty topic list is available
  useEffect(() => {
    if (!slug || !data?.topics) return
    const next = new Set()
    const addAllWithChildren = (nodes) => {
      for (const n of nodes || []) {
        if (n.slug) next.add(n.slug)
        if (Array.isArray(n.subtopics) && n.subtopics.length > 0) addAllWithChildren(n.subtopics)
        if (Array.isArray(n.children) && n.children.length > 0) addAllWithChildren(n.children)
      }
    }
    addAllWithChildren(data.topics)
    setExpandedSet(next)
  }, [slug, data?.topics])

  useEffect(() => {
    if (!chapterList || chapterList.length === 0) return
    const url = chapterList[0]?.thumbnail_url
    try {
      if (url) {
        const origin = new URL(url).origin
        const link = document.createElement('link')
        link.rel = 'preconnect'
        link.href = origin
        link.crossOrigin = 'anonymous'
        document.head.appendChild(link)
        // remove on cleanup
        return () => { try { document.head.removeChild(link) } catch {} }
      }
    } catch {}
  }, [chapterList])

  useEffect(() => {
    if (!chapterList || chapterList.length === 0) return
    const controllers = []
    chapterList.forEach((spec) => {
      if (!spec?.thumbnail_url) return
      const img = new Image()
      img.decoding = 'async'
      img.loading = 'eager'
      img.src = `${spec.thumbnail_url}?width=320&height=180&quality=60&format=webp&resize=cover`
      controllers.push(img)
    })
    return () => { controllers.length = 0 }
  }, [chapterList])

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
          {data.topics.map((t) => {
            if (t.has_subtopics && Array.isArray(t.subtopics) && t.subtopics.length > 0) {
              return (
                <TopicWithSubtopics
                  key={t.id}
                  topic={t}
                  expandedSet={expandedSet}
                  toggleExpanded={toggleExpanded}
                  onSubtopicClick={(st) => navigate(`/dashboard/textbook/topic/${st.slug}`)}
                />
              )
            }
            const hasPage = !!t.has_page || !!(t.textbook_pages && t.textbook_pages[0]) || !!t.page
            return (
              <TopicRow key={t.id} topic={t} onClick={hasPage ? () => navigate(`/dashboard/textbook/topic/${t.slug}`) : undefined} />
            )
          })}
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
        {chapterList.map((spec, idx) => (
          <ChapterCard
            key={spec.specialty_id || spec.id}
            specialty={spec}
            priority={idx < 6}
            onClick={() => navigate(`/dashboard/textbook/specialty/${spec.specialty_slug || spec.slug}`)}
          />
        ))}
      </div>
    </div>
  )
}


