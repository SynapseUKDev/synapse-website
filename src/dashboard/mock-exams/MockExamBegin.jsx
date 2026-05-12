import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { authHeaders } from '../../auth/token'
import './MockExams.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const TIMER_PRESETS = [60, 90, 120, 150, 180]

function formatLastAttempted(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
  } catch {
    return null
  }
}

function formatMinutesLeft(remainingSeconds) {
  const r = remainingSeconds != null ? Math.max(0, Number(remainingSeconds)) : 0
  if (r <= 0) return '0 min'
  const m = Math.ceil(r / 60)
  return `${m} min`
}

export default function MockExamBegin() {
  const { examId: slug } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paper, setPaper] = useState(null)
  const [timerMinutes, setTimerMinutes] = useState(120)
  const [starting, setStarting] = useState(false)
  const [resumeOpen, setResumeOpen] = useState(false)
  const [resumeInfo, setResumeInfo] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [slug])

  useEffect(() => {
    if (!slug) {
      setLoading(false)
      setError('Missing paper')
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`${API_BASE}/mock-papers`, { credentials: 'include', headers: authHeaders() })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || res.statusText)
        const found = (data.papers || []).find((p) => String(p.slug) === String(slug))
        if (!found) throw new Error('Mock paper not found')
        if (!cancelled) {
          setPaper(found)
          setTimerMinutes(Math.min(300, Math.max(5, Number(found.duration_minutes) || 120)))
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const continueAttempt = () => {
    if (paper?.in_progress_attempt_id) {
      navigate(`/dashboard/mock-exams/practice?attempt_id=${encodeURIComponent(paper.in_progress_attempt_id)}`)
    }
  }

  const openResumeChoice = (info) => {
    setResumeInfo(info)
    setResumeOpen(true)
  }

  const closeResumeChoice = () => {
    setResumeOpen(false)
    setResumeInfo(null)
  }

  const postAttempt = async (discardExisting) => {
    if (!slug) return
    setStarting(true)
    try {
      const res = await fetch(`${API_BASE}/mock-papers/${encodeURIComponent(slug)}/attempts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ timer_minutes: timerMinutes, discard_existing: discardExisting }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.status === 409 && data.error === 'in_progress' && data.attempt) {
        openResumeChoice(data.attempt)
        return
      }
      if (!res.ok) throw new Error(data.error || data.message || res.statusText)
      const id = data.attempt?.id
      if (!id) throw new Error('No attempt id returned')
      closeResumeChoice()
      navigate(`/dashboard/mock-exams/practice?attempt_id=${encodeURIComponent(id)}`)
    } catch (e) {
      alert(e.message || 'Could not start')
    } finally {
      setStarting(false)
    }
  }

  const onStartNewAttempt = () => {
    if (!paper?.in_progress_attempt_id) {
      postAttempt(false)
      return
    }
    openResumeChoice({
      id: paper.in_progress_attempt_id,
      timer_remaining_seconds: paper.in_progress_timer_remaining_seconds,
      timer_duration_seconds: paper.in_progress_timer_duration_seconds,
    })
  }

  const onResumeFromModal = () => {
    const id = resumeInfo?.id
    if (id) {
      closeResumeChoice()
      navigate(`/dashboard/mock-exams/practice?attempt_id=${encodeURIComponent(id)}`)
    }
  }

  const onAbandonFromModal = () => {
    closeResumeChoice()
    postAttempt(true)
  }

  if (loading) {
    return (
      <div className="me-begin">
        <LoadingScreen message="Loading…" inline />
      </div>
    )
  }

  if (error || !paper) {
    return (
      <div className="me-begin">
        <div className="me-begin__card">
          <p className="me-begin__text">{error || 'This mock exam was not found.'}</p>
          <div className="me-begin__actions">
            <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
              Back to mock exams
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="me-begin">
      <div className="me-begin__card me-begin__card--wide">
        <div className="me-begin__label">{paper.label || paper.slug}</div>
        <h1 className="me-begin__title">{paper.title}</h1>
        {paper.summary ? <p className="me-begin__text me-begin__lede">{paper.summary}</p> : null}
        {paper.attempt_count > 0 ? (
          <p className="me-begin__meta">
            Your attempts: <strong>{paper.attempt_count}</strong>
            {paper.completed_attempt_count > 0 ? (
              <>
                {' '}
                (<strong>{paper.completed_attempt_count}</strong> completed)
              </>
            ) : null}
            {formatLastAttempted(paper.last_attempted_at)
              ? ` · Last activity ${formatLastAttempted(paper.last_attempted_at)}`
              : ''}
          </p>
        ) : null}
        <p className="me-begin__text">
          {paper.question_count} single-best-answer questions. Pick a timer for this run. While you are on the exam, the countdown runs; if you exit or close the tab, time is saved and the clock pauses until you open the exam again. You will only see correct answers and scores after you finish;
          your choices are saved question by question so you can review everything at the end.
        </p>

        <div className="me-timer-block">
          <div className="me-timer-block__label">Timer length (minutes)</div>
          <div className="me-timer-presets">
            {TIMER_PRESETS.map((m) => (
              <button
                key={m}
                type="button"
                className={`me-chip ${timerMinutes === m ? 'is-active' : ''}`}
                onClick={() => setTimerMinutes(m)}
              >
                {m} min
              </button>
            ))}
          </div>
          <label className="me-timer-custom">
            Custom
            <input
              type="number"
              min={5}
              max={300}
              value={timerMinutes}
              onChange={(e) => setTimerMinutes(Math.min(300, Math.max(5, parseInt(e.target.value, 10) || 5)))}
            />
          </label>
        </div>

        <div className="me-begin__actions">
          <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
            Back
          </button>
          {paper.status === 'attempted' && paper.in_progress_attempt_id ? (
            <button type="button" className="me-btn" onClick={continueAttempt}>
              Continue attempt
            </button>
          ) : null}
          <button type="button" className="me-btn" onClick={onStartNewAttempt} disabled={starting}>
            {starting ? 'Starting…' : paper.in_progress_attempt_id ? 'Start new attempt' : 'Begin timed exam'}
          </button>
        </div>
      </div>
      {resumeOpen && resumeInfo ? (
        <div className="me-modal-root" role="dialog" aria-modal="true" aria-labelledby="me-resume-title">
          <button type="button" className="me-modal-backdrop" aria-label="Close" onClick={closeResumeChoice} />
          <div className="me-modal-panel">
            <h2 id="me-resume-title" className="me-modal__title">
              Continue your attempt?
            </h2>
            <p className="me-begin__text">
              You already have an in-progress run for this paper with about{' '}
              <strong>{formatMinutesLeft(resumeInfo.timer_remaining_seconds)}</strong> left on the timer (saved when you
              leave). You can pick up where you left off, or discard it and start a brand-new timed run with the settings
              above.
            </p>
            <div className="me-modal-actions">
              <button type="button" className="me-btn" onClick={onResumeFromModal}>
                Continue previous attempt
              </button>
              <button type="button" className="me-btn me-btn--ghost" onClick={onAbandonFromModal} disabled={starting}>
                {starting ? 'Starting…' : 'Discard and start fresh'}
              </button>
              <button type="button" className="me-btn me-btn--ghost" onClick={closeResumeChoice} disabled={starting}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
