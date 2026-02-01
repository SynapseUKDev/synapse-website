import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { LuCircleCheck, LuCheck, LuMinus } from 'react-icons/lu'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { authHeaders } from '../../auth/token'

const STATUS_LABELS = {
  not_read: 'Not read',
  in_progress: 'In progress',
  completed: 'Completed',
}

const CONFIDENCE_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}

function TopicCard({ topic, progress, onStatusChange, onConfidenceChange, onTopicClick }) {
  const hasPage = !!topic.has_page || !!(topic.textbook_pages && topic.textbook_pages[0]) || !!topic.page
  const readingStatus = progress?.reading_status || 'not_read'
  const confidence = progress?.confidence || 'low'
  const lastReviewedAt = progress?.last_reviewed_at

  const formatRelativeTime = (isoDate) => {
    if (!isoDate) return null
    const d = new Date(isoDate)
    if (Number.isNaN(d.getTime())) return null
    const now = new Date()
    const diffMs = now - d
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const cycleStatus = (e) => {
    e.stopPropagation()
    const order = ['not_read', 'in_progress', 'completed']
    const currentIdx = order.indexOf(readingStatus)
    const nextStatus = order[(currentIdx + 1) % 3]
    onStatusChange(topic.id, nextStatus)
  }

  const handleConfidenceClick = (e, level) => {
    e.stopPropagation()
    onConfidenceChange(topic.id, level)
  }

  const handleCardClick = () => {
    if (hasPage) {
      onTopicClick(topic)
    }
  }

  const checkboxClass = `tb-topic-card__check ${readingStatus === 'completed' ? 'tb-topic-card__check--completed' : readingStatus === 'in_progress' ? 'tb-topic-card__check--in-progress' : ''}`

  return (
    <div
      className={`tb-topic-card ${hasPage ? 'tb-topic-card--clickable' : 'tb-topic-card--disabled'}`}
      onClick={handleCardClick}
      role={hasPage ? 'button' : undefined}
      tabIndex={hasPage ? 0 : undefined}
      onKeyDown={hasPage ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick() } : undefined}
    >
      {/* Left checkbox */}
      <button className={checkboxClass} onClick={cycleStatus} aria-label="Toggle reading status">
        {readingStatus === 'completed' && <LuCheck className="tb-topic-card__check-icon" />}
        {readingStatus === 'in_progress' && <LuMinus className="tb-topic-card__check-icon" />}
      </button>

      {/* Topic info */}
      <div className="tb-topic-card__info">
        <span className="tb-topic-card__name">
          {topic.name}
        </span>
        <span className="tb-topic-card__meta">
          {lastReviewedAt ? `Last reviewed: ${formatRelativeTime(lastReviewedAt)}` : ''}
        </span>
      </div>

      {/* Reading status badge */}
      <div className="tb-topic-card__status">
        <button
          className={`tb-status-badge tb-status-badge--${readingStatus}`}
          onClick={cycleStatus}
        >
          {readingStatus === 'completed' && <LuCheck className="tb-status-badge__check" />}
          {STATUS_LABELS[readingStatus]}
        </button>
      </div>

      {/* Confidence toggle */}
      <div className="tb-topic-card__confidence">
        <div className="tb-confidence-toggle">
          {['low', 'moderate', 'high'].map((level) => (
            <button
              key={level}
              className={`tb-confidence-option tb-confidence-option--${level} ${confidence === level ? 'tb-confidence-option--active' : ''}`}
              onClick={(e) => handleConfidenceClick(e, level)}
            >
              <span className="tb-confidence-option__dot" />
              {CONFIDENCE_LABELS[level]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function ProgressHeader({ summary, sortBy, filterBy, onSortChange, onFilterChange }) {
  const completedPercent = summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

  return (
    <div className="tb-progress-header">
      {/* Reading Progress */}
      <div className="tb-progress-section">
        <div className="tb-progress-section__title">Reading Progress</div>
        <div className="tb-progress-bar">
          <div className="tb-progress-bar__fill" style={{ width: `${completedPercent}%` }} />
        </div>
        <div className="tb-progress-bar__text">{summary.completed} / {summary.total} completed</div>
      </div>

      {/* Confidence Levels */}
      <div className="tb-progress-section">
        <div className="tb-progress-section__title">Confidence Levels</div>
        <div className="tb-confidence-legend">
          <div className="tb-confidence-legend__item">
            <span className="tb-confidence-legend__dot tb-confidence-legend__dot--low" />
            {summary.low} Low
          </div>
          <div className="tb-confidence-legend__item">
            <span className="tb-confidence-legend__dot tb-confidence-legend__dot--moderate" />
            {summary.moderate} Moderate
          </div>
          <div className="tb-confidence-legend__item">
            <span className="tb-confidence-legend__dot tb-confidence-legend__dot--high" />
            {summary.high} High
          </div>
        </div>
      </div>

      {/* Sort & Filter */}
      <div className="tb-controls">
        <div className="tb-control-group">
          <label className="tb-control-label">Sort by:</label>
          <select className="tb-select" value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="default">Default</option>
            <option value="confidence">Lowest confidence</option>
            <option value="in_progress">In progress</option>
            <option value="last_reviewed">Last reviewed</option>
          </select>
        </div>
        <div className="tb-control-group">
          <label className="tb-control-label">Filters:</label>
          <select className="tb-select" value={filterBy} onChange={(e) => onFilterChange(e.target.value)}>
            <option value="all">Show all</option>
            <option value="low">Low confidence</option>
            <option value="not_read">Not read</option>
            <option value="in_progress">In progress</option>
          </select>
        </div>
      </div>
    </div>
  )
}

function ChapterCard({ specialty, onClick, priority = false, topicsRead = 0 }) {
  const bgStyle = {
    background: `linear-gradient(135deg, ${specialty.icon_bg_start || '#2E2CC4'} 0%, ${specialty.icon_bg_end || '#3C92C1'} 100%)`
  }
  const img = specialty.thumbnail_url
  const topicCount = Array.isArray(specialty.topics) ? specialty.topics.length : 0
  const isCompleted = topicCount > 0 && topicsRead >= 0 && topicsRead === topicCount
  const metaText = topicCount > 0
    ? (isCompleted ? 'Completed' : topicsRead >= 0 ? `${topicCount} topics / ${topicsRead} read` : `${topicCount} topics`)
    : null
  return (
    <button className="tb-card" onClick={onClick} aria-label={`Open ${specialty.specialty_name || specialty.name}`}>
      <div className="tb-card__cover" style={bgStyle}>
        {img && (
          <img
            className="tb-card__img"
            src={`${img}?width=640&height=360&quality=65&format=webp&resize=cover`}
            srcSet={`${img}?width=320&height=180&quality=60&format=webp&resize=cover 320w, ${img}?width=640&height=360&quality=65&format=webp&resize=cover 640w, ${img}?width=960&height=540&quality=65&format=webp&resize=cover 960w`}
            sizes="(max-width: 640px) 90vw, (max-width: 900px) 45vw, 220px"
            alt=""
            loading={priority ? 'eager' : 'lazy'}
            fetchpriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        )}
      </div>
      <div className="tb-card__label">
        <div className="tb-card__title">{specialty.specialty_name || specialty.name}</div>
        {metaText && (
          <div className={`tb-card__meta ${isCompleted ? 'tb-card__meta--completed' : ''}`}>
            {isCompleted && <LuCircleCheck className="tb-card__meta-icon" aria-hidden />}
            {metaText}
          </div>
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

function Chevron() {
  return (
    <svg className="tb-chevron" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
            <Chevron />
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
        <Chevron />
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
  const [searchQ, setSearchQ] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchErr, setSearchErr] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const MAX_INLINE_RESULTS = 12
  const [hasSearched, setHasSearched] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [historyError, setHistoryError] = useState(null)
  const [topicsReadCount, setTopicsReadCount] = useState(0)
  const [topicsReadBySpecialty, setTopicsReadBySpecialty] = useState({})

  // Progress tracking state (for specialty view)
  const [progressData, setProgressData] = useState({})
  const [progressSummary, setProgressSummary] = useState({ total: 0, not_read: 0, in_progress: 0, completed: 0, low: 0, moderate: 0, high: 0 })
  const [progressLoading, setProgressLoading] = useState(false)
  const [sortBy, setSortBy] = useState('default')
  const [filterBy, setFilterBy] = useState('all')

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  // Fetch topic history only on main dashboard (no slug)
  useEffect(() => {
    if (slug) return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    fetch(`${API_BASE}/textbook/topic-history`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    })
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 401 ? 'Not authenticated' : `Failed to load: ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!cancelled) {
          setHistoryItems(Array.isArray(data?.items) ? data.items : [])
          setTopicsReadCount(typeof data?.topics_read_count === 'number' ? data.topics_read_count : 0)
          setTopicsReadBySpecialty(data?.topics_read_by_specialty && typeof data.topics_read_by_specialty === 'object' ? data.topics_read_by_specialty : {})
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setHistoryError(err?.message || 'Failed to load history')
          setHistoryItems([])
          setTopicsReadCount(0)
          setTopicsReadBySpecialty({})
        }
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, API_BASE]);

  // Toggle expand/collapse for topics/subtopics by slug
  const toggleExpanded = (slugValue) => {
    setExpandedSet((prev) => {
      const next = new Set(prev)
      if (next.has(slugValue)) next.delete(slugValue); else next.add(slugValue)
      return next
    })
  }

  async function runSearch(e) {
    if (e && e.preventDefault) e.preventDefault()
    const q = (searchQ || '').trim()
    if (q.length < 2) {
      setSearchResults([])
      setSearchErr(null)
      setHasSearched(false)
      return
    }
    try {
      setHasSearched(true)
      setSearching(true)
      setSearchErr(null)
      const specialtyId = data?.specialty?.id || data?.specialty_id || null
      const params = new URLSearchParams({ q, limit: String(MAX_INLINE_RESULTS) })
      if (slug && specialtyId) params.set('specialty_id', String(specialtyId))
      const res = await fetch(`${API_BASE}/textbook/search?${params.toString()}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (!res.ok) throw new Error(`Search failed: ${res.status}`)
      const json = await res.json()
      setSearchResults(Array.isArray(json?.results) ? json.results : [])
    } catch (err) {
      setSearchErr(err?.message || 'Search failed')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  function clearSearch() {
    setSearchQ('')
    setSearchErr(null)
    setSearchResults([])
    setHasSearched(false)
  }

  function viewAll() {
    const q = (searchQ || '').trim()
    if (!q) return
    const specialtyId = data?.specialty?.id || data?.specialty_id || null
    const sp = new URLSearchParams({ q })
    if (slug && specialtyId) sp.set('specialty_id', String(specialtyId))
    navigate(`/dashboard/textbook/search?${sp.toString()}`)
  }

  function openResult(r) {
    if (!r) return
    const slug = r.target_slug
    const anchor = r.section_anchor
    if (slug) {
      navigate(`/dashboard/textbook/topic/${slug}#sec-${anchor}`)
    }
  }

  function formatLastViewed(isoOrTimestamp) {
    if (!isoOrTimestamp) return ''
    const d = new Date(isoOrTimestamp)
    if (Number.isNaN(d.getTime())) return ''
    const now = new Date()
    const diffMs = now - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined })
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

  // Fetch progress data when viewing a specialty
  useEffect(() => {
    if (!slug) return
    let cancelled = false
    setProgressLoading(true)
    fetch(`${API_BASE}/textbook/specialty/${slug}/progress`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    })
      .then((res) => res.ok ? res.json() : Promise.reject(new Error('Failed to load progress')))
      .then((json) => {
        if (!cancelled) {
          setProgressData(json.progress || {})
          setProgressSummary(json.summary || { total: 0, not_read: 0, in_progress: 0, completed: 0, low: 0, moderate: 0, high: 0 })
        }
      })
      .catch((err) => {
        console.error('Error loading progress:', err)
        if (!cancelled) {
          setProgressData({})
          setProgressSummary({ total: 0, not_read: 0, in_progress: 0, completed: 0, low: 0, moderate: 0, high: 0 })
        }
      })
      .finally(() => {
        if (!cancelled) setProgressLoading(false)
      })
    return () => { cancelled = true }
  }, [slug, API_BASE])

  // Update progress handlers with optimistic UI
  const handleStatusChange = useCallback(async (topicId, newStatus) => {
    const oldProgress = progressData[topicId] || { reading_status: 'not_read', confidence: 'low' }
    // Optimistic update
    setProgressData((prev) => ({
      ...prev,
      [topicId]: { ...oldProgress, reading_status: newStatus, last_reviewed_at: new Date().toISOString() },
    }))
    // Recalculate summary
    setProgressSummary((prev) => {
      const s = { ...prev }
      if (oldProgress.reading_status === 'not_read') s.not_read = Math.max(0, s.not_read - 1)
      else if (oldProgress.reading_status === 'in_progress') s.in_progress = Math.max(0, s.in_progress - 1)
      else if (oldProgress.reading_status === 'completed') s.completed = Math.max(0, s.completed - 1)
      if (newStatus === 'not_read') s.not_read++
      else if (newStatus === 'in_progress') s.in_progress++
      else if (newStatus === 'completed') s.completed++
      return s
    })
    try {
      await fetch(`${API_BASE}/textbook/topic/${topicId}/progress`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ reading_status: newStatus }),
      })
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }, [progressData, API_BASE])

  const handleConfidenceChange = useCallback(async (topicId, newConfidence) => {
    const oldProgress = progressData[topicId] || { reading_status: 'not_read', confidence: 'low' }
    // Optimistic update
    setProgressData((prev) => ({
      ...prev,
      [topicId]: { ...oldProgress, confidence: newConfidence },
    }))
    // Recalculate summary
    setProgressSummary((prev) => {
      const s = { ...prev }
      if (oldProgress.confidence === 'low') s.low = Math.max(0, s.low - 1)
      else if (oldProgress.confidence === 'moderate') s.moderate = Math.max(0, s.moderate - 1)
      else if (oldProgress.confidence === 'high') s.high = Math.max(0, s.high - 1)
      if (newConfidence === 'low') s.low++
      else if (newConfidence === 'moderate') s.moderate++
      else if (newConfidence === 'high') s.high++
      return s
    })
    try {
      await fetch(`${API_BASE}/textbook/topic/${topicId}/progress`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ confidence: newConfidence }),
      })
    } catch (err) {
      console.error('Failed to update confidence:', err)
    }
  }, [progressData, API_BASE])

  // Filter and sort topics for specialty view
  const filteredAndSortedTopics = useMemo(() => {
    if (!data?.topics) return []
    let topics = [...data.topics]

    // Filter
    if (filterBy !== 'all') {
      topics = topics.filter((t) => {
        const p = progressData[t.id]
        if (filterBy === 'low') return !p || p.confidence === 'low'
        if (filterBy === 'not_read') return !p || p.reading_status === 'not_read'
        if (filterBy === 'in_progress') return p?.reading_status === 'in_progress'
        return true
      })
    }

    // Sort
    if (sortBy !== 'default') {
      topics.sort((a, b) => {
        const pA = progressData[a.id] || { reading_status: 'not_read', confidence: 'low' }
        const pB = progressData[b.id] || { reading_status: 'not_read', confidence: 'low' }
        if (sortBy === 'confidence') {
          const order = { low: 0, moderate: 1, high: 2 }
          return order[pA.confidence] - order[pB.confidence]
        }
        if (sortBy === 'in_progress') {
          if (pA.reading_status === 'in_progress' && pB.reading_status !== 'in_progress') return -1
          if (pB.reading_status === 'in_progress' && pA.reading_status !== 'in_progress') return 1
          return 0
        }
        if (sortBy === 'last_reviewed') {
          const dateA = pA.last_reviewed_at ? new Date(pA.last_reviewed_at).getTime() : 0
          const dateB = pB.last_reviewed_at ? new Date(pB.last_reviewed_at).getTime() : 0
          return dateB - dateA
        }
        return 0
      })
    }

    return topics
  }, [data?.topics, progressData, sortBy, filterBy])

  const chapterList = useMemo(() => {
    if (!data) return []
    if (data.specialties) return data.specialties
    if (data.specialty) return [data.specialty]
    return []
  }, [data])

  // Keep topics collapsed by default; users can expand specific topics.

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
        return () => { try { document.head.removeChild(link) } catch { } }
      }
    } catch { }
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

  // Specialty topics view - Learning Dashboard
  if (slug && data?.topics) {
    const handleTopicClick = (topic) => {
      const hasPage = !!topic.has_page || !!(topic.textbook_pages && topic.textbook_pages[0]) || !!topic.page
      if (hasPage) {
        navigate(`/dashboard/textbook/topic/${topic.slug}`)
      }
    }

    return (
      <div className="tb-page">
        <header className="tb-header">
          <div className="tb-breadcrumbs">
            <button className="tb-link" onClick={() => navigate('/dashboard/textbook')}>UKMLA Textbook</button>
            <span className="tb-sep">›</span>
            <span className="tb-current">{data.specialty?.name}</span>
          </div>
          <h1 className="tb-title">{data.specialty?.name}</h1>
          <p className="tb-sub">Track your progress and confidence in key {data.specialty?.name?.toLowerCase()} topics.</p>
          <form className="tb-search" onSubmit={runSearch} role="search" aria-label="Search textbook">
            <input
              className="tb-search__input"
              type="search"
              placeholder="Search textbook content…"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              aria-label="Search query"
            />
            <button className="tb-search__btn" type="submit" disabled={searching}>Search</button>
            {!!searchQ && <button type="button" className="tb-search__btn tb-search__btn--secondary" onClick={clearSearch}>Clear</button>}
          </form>
          {hasSearched && (
            <div className="tb-search-results" aria-live="polite">
              {searching && <div className="tb-search__status">Searching…</div>}
              {searchErr && <div className="tb-error">{searchErr}</div>}
              {!searching && searchResults.length === 0 && !searchErr && (
                <div className="tb-search__status">No results found</div>
              )}
              {searchResults.map((r, idx) => (
                <button key={idx} className="tb-search-item" onClick={() => openResult(r)}>
                  <div className="tb-search-item__titles">
                    <div className="tb-search-item__page">{r.page_title}</div>
                    {r.section_title && <div className="tb-search-item__section">{r.section_title}</div>}
                  </div>
                  <div className="tb-search-item__snippet" dangerouslySetInnerHTML={{ __html: r.snippet_html }} />
                </button>
              ))}
              {searchResults.length === MAX_INLINE_RESULTS && (
                <button className="tb-search__viewall" onClick={viewAll}>View all results</button>
              )}
            </div>
          )}
        </header>

        {/* Progress Header */}
        {!progressLoading && (
          <ProgressHeader
            summary={progressSummary}
            sortBy={sortBy}
            filterBy={filterBy}
            onSortChange={setSortBy}
            onFilterChange={setFilterBy}
          />
        )}
        {progressLoading && <div className="tb-progress-header" style={{ opacity: 0.5 }}>Loading progress...</div>}

        {/* Topic Cards */}
        <div className="tb-topic-list--dashboard">
          {filteredAndSortedTopics.map((t) => {
            // Skip subtopics view for now - show flat topic list
            if (t.has_subtopics && Array.isArray(t.subtopics) && t.subtopics.length > 0) {
              // For topics with subtopics, show as parent topic card
              return (
                <TopicCard
                  key={t.id}
                  topic={t}
                  progress={progressData[t.id]}
                  onStatusChange={handleStatusChange}
                  onConfidenceChange={handleConfidenceChange}
                  onTopicClick={handleTopicClick}
                />
              )
            }
            return (
              <TopicCard
                key={t.id}
                topic={t}
                progress={progressData[t.id]}
                onStatusChange={handleStatusChange}
                onConfidenceChange={handleConfidenceChange}
                onTopicClick={handleTopicClick}
              />
            )
          })}
          {filteredAndSortedTopics.length === 0 && (
            <div className="tb-continue-empty">
              <p className="tb-continue-empty__main">No topics match your filters</p>
              <p className="tb-continue-empty__sub">Try adjusting your filters to see more topics.</p>
            </div>
          )}
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
        {!historyLoading && (
          <p className="tb-topics-read" aria-live="polite">
            {topicsReadCount === 0 ? 'No topics read yet' : `${topicsReadCount} topic${topicsReadCount !== 1 ? 's' : ''} read`}
          </p>
        )}
        <form className="tb-search" onSubmit={runSearch} role="search" aria-label="Search textbook">
          <input
            className="tb-search__input"
            type="search"
            placeholder="Search textbook content…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            aria-label="Search query"
          />
          <button className="tb-search__btn" type="submit" disabled={searching}>Search</button>
          {!!searchQ && <button type="button" className="tb-search__btn tb-search__btn--secondary" onClick={clearSearch}>Clear</button>}
        </form>
        {hasSearched && (
          <div className="tb-search-results" aria-live="polite">
            {searching && <div className="tb-search__status">Searching…</div>}
            {searchErr && <div className="tb-error">{searchErr}</div>}
            {!searching && searchResults.length === 0 && !searchErr && (
              <div className="tb-search__status">No results found</div>
            )}
            {searchResults.map((r, idx) => (
              <button key={idx} className="tb-search-item" onClick={() => openResult(r)}>
                <div className="tb-search-item__titles">
                  <div className="tb-search-item__page">{r.page_title}</div>
                  {r.section_title && <div className="tb-search-item__section">{r.section_title}</div>}
                </div>
                <div className="tb-search-item__snippet" dangerouslySetInnerHTML={{ __html: r.snippet_html }} />
              </button>
            ))}
            {searchResults.length === MAX_INLINE_RESULTS && (
              <button className="tb-search__viewall" onClick={viewAll}>View all results</button>
            )}
          </div>
        )}
      </header>
      <section className="tb-continue" aria-label="Continue reading">
        <h2 className="tb-continue__title">Continue reading</h2>
        {historyLoading && (
          <div className="tb-continue__status">Loading…</div>
        )}
        {!historyLoading && historyError && (
          <div className="tb-continue__status tb-continue__status--muted">{historyError}</div>
        )}
        {!historyLoading && !historyError && (!historyItems || historyItems.length === 0) && (
          <div className="tb-continue-empty">
            <p className="tb-continue-empty__main">No history</p>
            <p className="tb-continue-empty__sub">Start reading to get history</p>
          </div>
        )}
        {!historyLoading && !historyError && historyItems.length > 0 && (
          <div className="tb-continue-cards">
            {historyItems.slice(0, 2).map((item, idx) => (
              <div key={item.topic_slug + String(idx)} className="tb-continue-card">
                <div className="tb-continue__specialty">{item.specialty_name || 'Specialty'}</div>
                <div className="tb-continue__topic">{item.topic_name || 'Topic'}</div>
                <div className="tb-continue__date">
                  {item.last_read_date ? `Last viewed ${formatLastViewed(item.last_read_date)}` : ''}
                </div>
                <button
                  type="button"
                  className="tb-continue__btn"
                  onClick={() => navigate(`/dashboard/textbook/topic/${item.topic_slug}`)}
                >
                  Continue
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
      <div className="tb-grid">
        {chapterList.map((spec, idx) => (
          <ChapterCard
            key={spec.specialty_id || spec.id}
            specialty={spec}
            priority={idx < 6}
            topicsRead={topicsReadBySpecialty[spec.specialty_id] ?? 0}
            onClick={() => navigate(`/dashboard/textbook/specialty/${spec.specialty_slug || spec.slug}`)}
          />
        ))}
      </div>
    </div>
  )
}


