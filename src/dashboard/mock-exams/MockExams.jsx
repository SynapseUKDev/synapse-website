import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuClock, LuClipboardList, LuGraduationCap, LuStar } from 'react-icons/lu'
import { authHeaders } from '../../auth/token'
import './MockExams.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'attempted', label: 'Attempted' },
  { id: 'completed', label: 'Completed' },
]

function MockExamRow({ exam, listTab }) {
  const navigate = useNavigate()
  const tint = exam.thumb_tint || 'violet'

  const goBegin = () => navigate(`/dashboard/mock-exams/${encodeURIComponent(exam.slug)}`)
  const goPractice = () => {
    if (exam.in_progress_attempt_id) {
      navigate(`/dashboard/mock-exams/practice?attempt_id=${encodeURIComponent(exam.in_progress_attempt_id)}`)
    }
  }
  const goResults = () => {
    if (exam.last_submitted_attempt_id) {
      navigate(
        `/dashboard/mock-exams/results?attempt_id=${encodeURIComponent(exam.last_submitted_attempt_id)}`,
      )
    }
  }

  const hasProgress = !!exam.in_progress_attempt_id
  const hasSubmitted = !!exam.last_submitted_attempt_id

  const renderActions = () => {
    if (listTab === 'available') {
      return (
        <div className="me-row__actions">
          <button type="button" className="me-row__cta" onClick={goBegin}>
            Start new attempt
          </button>
        </div>
      )
    }

    if (listTab === 'all') {
      return (
        <div className="me-row__actions">
          {hasProgress ? (
            <button type="button" className="me-row__cta" onClick={goPractice}>
              Continue attempt
            </button>
          ) : null}
          {hasSubmitted ? (
            <button type="button" className={`me-row__cta ${hasProgress ? 'me-row__cta--ghost' : ''}`} onClick={goResults}>
              View results
            </button>
          ) : null}
          <button
            type="button"
            className={`me-row__cta ${hasProgress || hasSubmitted ? 'me-row__cta--ghost' : ''}`}
            onClick={goBegin}
          >
            Start new attempt
          </button>
        </div>
      )
    }

    if (listTab === 'attempted') {
      return (
        <div className="me-row__actions">
          {hasProgress ? (
            <button type="button" className="me-row__cta" onClick={goPractice}>
              Continue attempt
            </button>
          ) : null}
          <button type="button" className="me-row__cta me-row__cta--ghost" onClick={goBegin}>
            Start new attempt
          </button>
        </div>
      )
    }

    if (listTab === 'completed') {
      return (
        <div className="me-row__actions">
          {hasSubmitted ? (
            <button type="button" className="me-row__cta" onClick={goResults}>
              View results
            </button>
          ) : null}
          <button type="button" className="me-row__cta me-row__cta--ghost" onClick={goBegin}>
            Start new attempt
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <article className="me-row">
      <div className={`me-row__thumb me-row__thumb--${tint}`} aria-hidden>
        <LuGraduationCap size={40} strokeWidth={1.5} />
      </div>
      <div className="me-row__main">
        <div className="me-row__head">
          <div className="me-row__titles">
            <span className="me-row__pill">{exam.label}</span>
            <h2 className="me-row__title">{exam.title}</h2>
          </div>
          <div className="me-row__rating" title={exam.last_score_pct != null ? 'Last submitted score' : 'Not submitted yet'}>
            <LuStar size={16} strokeWidth={2.5} className="me-row__star" aria-hidden />
            {exam.last_score_pct != null ? (
              <span className="me-row__score">{exam.last_score_pct}%</span>
            ) : (
              <span className="me-row__score me-row__score--muted">—</span>
            )}
          </div>
        </div>
        <p className="me-row__summary">{exam.summary || 'Timed mock paper from the question bank team.'}</p>
        {listTab === 'all' && (hasProgress || hasSubmitted) ? (
          <p className="me-row__status-hint">
            {hasProgress ? <span className="me-row__status-pill me-row__status-pill--progress">In progress</span> : null}
            {hasProgress && hasSubmitted ? ' · ' : null}
            {hasSubmitted ? (
              <span className="me-row__status-pill me-row__status-pill--done">Submitted attempt on file</span>
            ) : null}
          </p>
        ) : null}
        <div className="me-row__tags">
          {(exam.tags || []).map((tag) => (
            <span key={tag} className="me-row__tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="me-row__footer">
          <div className="me-row__info">
            <span className="me-row__info-line">
              <LuClipboardList size={16} aria-hidden />
              {exam.question_count} questions
            </span>
            <span className="me-row__info-dot" aria-hidden>
              ·
            </span>
            <span className="me-row__info-line">
              <LuClock size={16} aria-hidden />
              {exam.duration_minutes} min suggested
            </span>
            {exam.attempt_count > 0 && (
              <>
                <span className="me-row__info-dot" aria-hidden>
                  ·
                </span>
                <span className="me-row__info-line" title={`${exam.completed_attempt_count ?? 0} submitted`}>
                  {exam.attempt_count} attempt{exam.attempt_count === 1 ? '' : 's'}
                  {formatLastAttempted(exam.last_attempted_at)
                    ? ` · Last ${formatLastAttempted(exam.last_attempted_at)}`
                    : ''}
                </span>
              </>
            )}
          </div>
          {renderActions()}
        </div>
      </div>
    </article>
  )
}

const TINTS = ['violet', 'cyan', 'amber']

function formatLastAttempted(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  } catch {
    return null
  }
}

export default function MockExams() {
  const [tab, setTab] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [exams, setExams] = useState([])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/mock-papers`, { credentials: 'include', headers: authHeaders() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || res.statusText)
        const papers = Array.isArray(data.papers) ? data.papers : []
        const mapped = papers.map((p, i) => ({
          ...p,
          label: p.slug?.replace(/-/g, ' ')?.replace(/\b\w/g, (c) => c.toUpperCase()) || 'Paper',
          tags: p.question_count ? [`${p.question_count} Q`, 'SBA'] : ['SBA'],
          thumb_tint: TINTS[i % TINTS.length],
        }))
        if (!cancelled) setExams(mapped)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load mock exams')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'all' || tab === 'available') return exams
    if (tab === 'attempted') {
      return exams.filter((e) => !!e.in_progress_attempt_id)
    }
    if (tab === 'completed') {
      return exams.filter((e) => (e.completed_attempt_count ?? 0) > 0)
    }
    return exams
  }, [tab, exams])

  if (loading) {
    return (
      <div className="me">
        <LoadingScreen message="Loading mock exams…" inline />
      </div>
    )
  }

  if (error) {
    return (
      <div className="me">
        <header className="me__header">
          <h1 className="me__title">Mock exams</h1>
          <p className="me__subtitle">{error}</p>
          <p className="me__dev-note">If you have not applied SQL migration `047_user_mock_attempts.sql`, run it in Supabase first.</p>
        </header>
      </div>
    )
  }

  return (
    <div className="me">
      <header className="me__header">
        <h1 className="me__title">Mock exams</h1>
        <p className="me__subtitle">
          <strong>All</strong> shows every paper with separate actions: continue an in-progress run, open your latest submitted
          results, or start a new timed attempt. <strong>Available</strong> lists the same papers for starting a fresh run;
          use <strong>Attempted</strong> or <strong>Completed</strong> to focus on active or submitted work.
        </p>
      </header>

      <div className="me__tabs" role="tablist" aria-label="Filter mock exams">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`me__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="me__list">
        {filtered.length === 0 ? (
          <div className="me__empty">No mock exams match this filter yet.</div>
        ) : (
          filtered.map((exam) => <MockExamRow key={exam.slug} exam={exam} listTab={tab} />)
        )}
      </div>
    </div>
  )
}
