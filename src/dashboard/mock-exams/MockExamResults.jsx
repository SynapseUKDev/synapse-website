import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuCircleAlert, LuCircleCheck } from 'react-icons/lu'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { authHeaders } from '../../auth/token'
import './MockExams.css'
import '../practice/Practice.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

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
          if (!cancelled) {
            setData({
              correct: json.correct ?? 0,
              total: json.total ?? 0,
              skipped: json.skipped ?? 0,
              questions: Array.isArray(json.questions) ? json.questions : [],
            })
          }
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
        correct: state.correct ?? 0,
        total: state.total ?? 0,
        skipped: state.skipped ?? 0,
        questions: Array.isArray(state.questions) ? state.questions : [],
      })
      setLoading(false)
      setError(null)
      return undefined
    }

    setLoading(false)
    return undefined
  }, [attemptIdQuery, location.key])

  if (loading) {
    return (
      <div className="me">
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

  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

  return (
    <div className="me me-results">
      <header className="me__header">
        <button type="button" className="me-btn me-btn--ghost me-results__back" onClick={() => navigate('/dashboard/mock-exams')}>
          <LuChevronLeft size={18} /> Back to mock exams
        </button>
        <h1 className="me__title">Exam results</h1>
        <p className="me__subtitle">
          {correct} / {total} correct ({pct}%) · {skipped} skipped
        </p>
      </header>

      <div className="me-results__list">
        {questions.map((q, i) => (
          <article key={q.id || i} className={`me-results__q ${q.skipped ? 'me-results__q--skipped' : q.is_correct ? 'me-results__q--ok' : 'me-results__q--bad'}`}>
            <div className="me-results__q-head">
              <span className="me-results__q-num">Q{q.ordinal ?? i + 1}</span>
              {q.skipped ? (
                <span className="me-results__badge me-results__badge--skip">Skipped</span>
              ) : q.is_correct ? (
                <span className="me-results__badge me-results__badge--ok">
                  <LuCircleCheck size={16} /> Correct
                </span>
              ) : (
                <span className="me-results__badge me-results__badge--bad">
                  <LuCircleAlert size={16} /> Incorrect
                </span>
              )}
            </div>
            <div className="question-stem me-results__stem">
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {q.stem}
              </ReactMarkdown>
            </div>
            {!q.skipped && q.selected_option_index != null && q.correct_option_index != null && (
              <p className="me-results__letters">
                Your answer: <strong>{String.fromCharCode(65 + q.selected_option_index)}</strong>
                {' · '}
                Correct: <strong>{String.fromCharCode(65 + q.correct_option_index)}</strong>
              </p>
            )}
            {q.skipped && q.correct_option_index != null && (
              <p className="me-results__letters">
                Correct answer: <strong>{String.fromCharCode(65 + q.correct_option_index)}</strong>
              </p>
            )}
            {(q.explanations?.detailed || q.explanations?.eli5) && (
              <div className="me-results__explain">
                {q.explanations?.eli5 && (
                  <div>
                    <div className="me-results__explain-label">Summary</div>
                    <div>{q.explanations.eli5}</div>
                  </div>
                )}
                {q.explanations?.detailed && (
                  <div style={{ marginTop: 10 }}>
                    <div className="me-results__explain-label">Explanation</div>
                    <div>{q.explanations.detailed}</div>
                  </div>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  )
}
