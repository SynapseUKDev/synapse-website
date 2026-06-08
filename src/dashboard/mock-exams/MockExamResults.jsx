import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuArrowRight, LuEye } from 'react-icons/lu'
import { authHeaders } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import '../practice/PracticeResults.css'
import '../practice/PracticeSetup.css'
import './MockExams.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function MockExamResults() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const attemptIdQuery = searchParams.get('attempt_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const state = location.state || {}
    const fromState =
      (Array.isArray(state.questions) && state.questions.length > 0) || Number(state.total) > 0

    if (attemptIdQuery) {
      let cancelled = false
      ;(async () => {
        setLoading(true)
        setError(null)
        try {
          const res = await fetch(
            `${API_BASE}/mock-papers/attempts/${encodeURIComponent(attemptIdQuery)}/review`,
            { credentials: 'include', headers: authHeaders() },
          )
          const json = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(json.error || res.statusText)
          if (!cancelled) setData(json)
        } catch (e) {
          if (!cancelled) setError(e.message || 'Failed to load results')
        } finally {
          if (!cancelled) setLoading(false)
        }
      })()
      return () => {
        cancelled = true
      }
    }

    if (fromState) {
      setData({
        attempt_id: state.attempt_id,
        correct: state.correct ?? 0,
        total: state.total ?? 0,
        skipped: state.skipped ?? 0,
        paper_title: state.paper_title,
        questions: Array.isArray(state.questions) ? state.questions : [],
      })
      setLoading(false)
      setError(null)
      return undefined
    }

    setLoading(false)
    return undefined
  }, [attemptIdQuery, location.key])

  const enterReviewMode = () => {
    const attemptId = data?.attempt_id || attemptIdQuery
    const path = attemptId
      ? `/dashboard/mock-exams/review?attempt_id=${encodeURIComponent(attemptId)}`
      : '/dashboard/mock-exams/review'
    navigate(path, { state: data })
  }

  if (loading) {
    return (
      <div className="prr">
        <LoadingScreen message="Loading results…" inline />
      </div>
    )
  }

  if (error) {
    return (
      <div className="me-begin">
        <div className="me-begin__card">
          <p className="me-begin__text">{error}</p>
          <button type="button" className="me-btn" onClick={() => navigate('/dashboard/mock-exams')}>
            Mock exams
          </button>
        </div>
      </div>
    )
  }

  const correct = data?.correct ?? 0
  const total = data?.total ?? 0
  const skipped = data?.skipped ?? 0
  const questions = data?.questions ?? []
  const paperTitle = data?.paper_title

  if (!total && questions.length === 0) {
    return (
      <div className="me-begin">
        <div className="me-begin__card">
          <p className="me-begin__text">No results to show. Start a mock exam from the list.</p>
          <button type="button" className="me-btn" onClick={() => navigate('/dashboard/mock-exams')}>
            Mock exams
          </button>
        </div>
      </div>
    )
  }

  const incorrect = Math.max(total - correct - skipped, 0)
  const attempted = total - skipped
  const accuracyPct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0
  const scoreTheme = accuracyPct >= 80 ? 'good' : accuracyPct >= 60 ? 'ok' : 'poor'

  return (
    <div className="prr">
      <div className="prr__top">
        <button type="button" className="setup__back" onClick={() => navigate('/dashboard/mock-exams')}>
          <LuChevronLeft /> Back to Mock Exams
        </button>
      </div>

      <div className="prr-hero card">
        <div className="prr-hero__left">
          <div
            className={`score-ring score-ring--${scoreTheme}`}
            style={{ ['--pct']: `${accuracyPct}%` }}
            aria-label={`Accuracy ${accuracyPct}%`}
          >
            <div className="score-ring__inner">
              <div className="score-ring__value">{accuracyPct}%</div>
              <div className="score-ring__label">Accuracy</div>
            </div>
          </div>
          <div className="prr-hero__meta">
            <h1 className="prr__title">Exam Complete</h1>
            <div className="prr__subtitle">{paperTitle ? `${paperTitle} • Mock exam` : 'Mock exam'}</div>
          </div>
        </div>
        <div className="prr-hero__right">
          <div className="kpi">
            <div className="kpi__value kpi__value--green">{correct}</div>
            <div className="kpi__label">Correct</div>
          </div>
          <div className="kpi">
            <div className="kpi__value kpi__value--red">{incorrect}</div>
            <div className="kpi__label">Incorrect</div>
          </div>
          <div className="kpi">
            <div className="kpi__value kpi__value--muted">{skipped}</div>
            <div className="kpi__label">Skipped</div>
          </div>
          <div className="kpi">
            <div className="kpi__value">{total}</div>
            <div className="kpi__label">Total</div>
          </div>
        </div>
      </div>

      <div className="prr__grid prr__grid--top">
        <div className="card prr-card">
          <div className="card__header">Performance Highlights</div>
          <div className="card__body prr-card__body">
            <ul className="highlights">
              <li>
                <span className="dot dot--green" /> You answered {correct} correctly
              </li>
              <li>
                <span className="dot dot--blue" /> Accuracy at {accuracyPct}%
              </li>
              <li>
                <span className="dot dot--amber" /> {skipped} skipped questions
              </li>
            </ul>
            <div className="prr-bar">
              <div className="prr-fill" style={{ width: `${accuracyPct}%` }} />
            </div>
            {questions.length > 0 ? (
              <button type="button" className="btn btn--primary btn--icon" onClick={enterReviewMode}>
                <LuEye size={16} /> Review Your Answers
              </button>
            ) : null}
          </div>
        </div>

        <div className="card prr-card">
          <div className="card__header">Score Summary</div>
          <div className="card__body prr-card__body">
            <div className="time-grid">
              <div>
                <div className="time__value">{correct}</div>
                <div className="time__label">Correct out of {total}</div>
              </div>
              <div>
                <div className="time__value">{accuracyPct}%</div>
                <div className="time__label">Attempted accuracy</div>
              </div>
            </div>
            <div className={`prr-badge ${accuracyPct >= 70 ? 'prr-badge--green' : 'prr-badge--amber'}`}>
              {accuracyPct >= 70 ? 'Solid performance' : 'Review incorrect and skipped questions'}
            </div>
          </div>
        </div>
      </div>

      <div className="prr__grid">
        <div className="card">
          <div className="card__header">Next Actions</div>
          <div className="card__body next-steps">
            <button type="button" className="btn btn--primary btn--icon" onClick={() => navigate('/dashboard/mock-exams')}>
              Take another mock <LuArrowRight />
            </button>
            {questions.length > 0 ? (
              <button type="button" className="btn btn--ghost btn--icon" onClick={enterReviewMode}>
                <LuEye size={16} /> Review answers
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
