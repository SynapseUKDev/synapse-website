import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authHeaders } from '../../auth/token'
import { LuChevronLeft, LuClock, LuPause, LuPlay, LuFlag } from 'react-icons/lu'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import '../practice/Practice.css'
import './MockExams.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const QUESTIONS_PER_PAGE = 30

function useExamCountdown(initialSec) {
  const [seconds, setSeconds] = useState(initialSec)
  const [userPaused, setUserPaused] = useState(false)
  const [tabVisible, setTabVisible] = useState(
    typeof document !== 'undefined' ? document.visibilityState === 'visible' : true,
  )

  useEffect(() => {
    setSeconds(initialSec)
  }, [initialSec])

  useEffect(() => {
    const onVis = () => setTabVisible(document.visibilityState === 'visible')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const running = tabVisible && !userPaused

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [running])

  const toggle = () => setUserPaused((p) => !p)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return { seconds, display: `${mm}:${ss}`, running, toggle }
}

export default function MockExamPractice() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const attemptId = searchParams.get('attempt_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [paper, setPaper] = useState(null)
  const [questions, setQuestions] = useState([])
  const [saved, setSaved] = useState({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0)
  const [loadTick, setLoadTick] = useState(0)
  const [flagged, setFlagged] = useState(() => new Set())
  const timeUpRef = useRef(false)
  const prevSecondsRef = useRef(-1)
  const secondsRef = useRef(0)

  const timerBudget = paper?.timer_duration_seconds ?? 0
  const initialRemaining = paper?.timer_remaining_seconds ?? timerBudget
  const { seconds, display, running, toggle } = useExamCountdown(initialRemaining)

  secondsRef.current = seconds

  useEffect(() => {
    prevSecondsRef.current = -1
    timeUpRef.current = false
  }, [attemptId, loadTick])

  const load = useCallback(async () => {
    if (!attemptId) {
      setError('Missing attempt')
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/mock-papers/attempts/${attemptId}`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      if (data.reveal) {
        navigate(`/dashboard/mock-exams/results?attempt_id=${encodeURIComponent(attemptId)}`, { replace: true })
        return
      }
      const dur = data.attempt.timer_duration_seconds ?? 7200
      const rem =
        data.attempt.timer_remaining_seconds != null
          ? Math.max(0, Math.round(Number(data.attempt.timer_remaining_seconds)))
          : dur
      setPaper({
        ...data.paper,
        timer_duration_seconds: dur,
        timer_remaining_seconds: rem,
      })
      setQuestions(Array.isArray(data.questions) ? data.questions : [])
      const map = {}
      const ans = data.answers || {}
      for (const q of data.questions || []) {
        if (Object.prototype.hasOwnProperty.call(ans, q.id)) {
          map[q.id] = ans[q.id]
        }
      }
      setSaved(map)
      setFlagged(new Set())
      setLoadTick((t) => t + 1)
    } catch (e) {
      setError(e.message || 'Failed to load exam')
    } finally {
      setLoading(false)
    }
  }, [attemptId, navigate])

  useEffect(() => {
    load()
  }, [load])

  const syncRemaining = useCallback(
    async (value, opts = {}) => {
      const force = Boolean(opts.force)
      if (!attemptId || (!force && finishing)) return
      if (!force && timeUpRef.current) return
      const v = Math.max(0, Math.round(Number(value)))
      try {
        await fetch(`${API_BASE}/mock-papers/attempts/${encodeURIComponent(attemptId)}/timer-sync`, {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ remaining_seconds: v }),
        })
      } catch {
        /* ignore */
      }
    },
    [attemptId, finishing],
  )

  useEffect(() => {
    if (loading || !paper || finishing) return
    const id = setInterval(() => syncRemaining(secondsRef.current), 25000)
    return () => clearInterval(id)
  }, [loading, paper, finishing, syncRemaining])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const onVis = () => {
      if (document.visibilityState === 'hidden') syncRemaining(secondsRef.current)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [syncRemaining])

  useEffect(() => {
    if (!attemptId) return
    return () => {
      const v = Math.max(0, Math.round(secondsRef.current))
      fetch(`${API_BASE}/mock-papers/attempts/${encodeURIComponent(attemptId)}/timer-sync`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ remaining_seconds: v }),
        keepalive: true,
      }).catch(() => {})
    }
  }, [attemptId])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentIndex])

  const currentQ = questions[currentIndex]
  const hasRecorded =
    !!currentQ && Object.prototype.hasOwnProperty.call(saved, currentQ.id)
  const recordedVal = hasRecorded ? saved[currentQ.id] : undefined

  const valuesEqual = (a, b) => {
    if (a === b) return true
    if (a === null || a === undefined) return b === null || b === undefined
    return false
  }

  const needsSaveAnswer =
    !!currentQ &&
    selected !== null &&
    selected !== undefined &&
    (!hasRecorded || !valuesEqual(selected, recordedVal))

  const readyToAdvance = !!currentQ && hasRecorded && valuesEqual(selected, recordedVal)

  const showSkipClear =
    !!currentQ &&
    !needsSaveAnswer &&
    hasRecorded &&
    typeof recordedVal === 'number' &&
    valuesEqual(selected, recordedVal)

  const showSkipUnanswered =
    !!currentQ && !needsSaveAnswer && !hasRecorded && (selected === null || selected === undefined)

  useEffect(() => {
    if (!currentQ) return
    if (!Object.prototype.hasOwnProperty.call(saved, currentQ.id)) {
      setSelected(null)
      return
    }
    const v = saved[currentQ.id]
    setSelected(v === null || v === undefined ? null : v)
  }, [currentQ, saved])

  useEffect(() => {
    if (loading || !paper || finishing || timeUpRef.current) return
    if (timerBudget <= 0 || !questions.length) return

    const prev = prevSecondsRef.current
    if (prev === -1) {
      prevSecondsRef.current = seconds
      return
    }
    if (seconds > 0) {
      prevSecondsRef.current = seconds
      return
    }
    // seconds === 0: only treat as time-up if we actually counted down from a positive value
    if (prev > 0) {
      timeUpRef.current = true
      const run = async () => {
        if (
          !window.confirm("Time's up. Finish the exam and view results? Unanswered questions count as skipped.")
        ) {
          timeUpRef.current = false
          prevSecondsRef.current = seconds
          return
        }
        setFinishing(true)
        try {
          await syncRemaining(0, { force: true })
          const res = await fetch(`${API_BASE}/mock-papers/attempts/${encodeURIComponent(attemptId)}/complete`, {
            method: 'POST',
            credentials: 'include',
            headers: { ...authHeaders() },
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) throw new Error(data.error || res.statusText)
          navigate('/dashboard/mock-exams/results', { state: data })
        } catch (e) {
          alert(e.message || 'Could not finish')
          timeUpRef.current = false
        } finally {
          setFinishing(false)
        }
      }
      run()
    }
    prevSecondsRef.current = seconds
  }, [seconds, loading, paper, timerBudget, questions.length, attemptId, navigate, finishing, syncRemaining])

  const persistAnswer = async (qid, index) => {
    const res = await fetch(`${API_BASE}/mock-papers/attempts/${attemptId}/answers`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ mock_paper_question_id: qid, selected_option_index: index }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || res.statusText)
  }

  const onSubmit = async () => {
    if (!currentQ || submitting || !needsSaveAnswer) return
    if (selected === null || selected === undefined) return
    setSubmitting(true)
    try {
      await persistAnswer(currentQ.id, selected)
      setSaved((prev) => ({ ...prev, [currentQ.id]: selected }))
    } catch (e) {
      alert(e.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const onSkip = async () => {
    if (!currentQ || submitting) return
    if (!showSkipUnanswered && !showSkipClear) return
    setSubmitting(true)
    try {
      await persistAnswer(currentQ.id, null)
      setSaved((prev) => ({ ...prev, [currentQ.id]: null }))
      setSelected(null)
    } catch (e) {
      alert(e.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const goNext = () => {
    if (currentIndex < questions.length - 1) {
      const n = currentIndex + 1
      setCurrentIndex(n)
      setSelectedRangeIdx(Math.floor(n / QUESTIONS_PER_PAGE))
    }
  }

  const goPrev = () => {
    if (currentIndex > 0) {
      const n = currentIndex - 1
      setCurrentIndex(n)
      setSelectedRangeIdx(Math.floor(n / QUESTIONS_PER_PAGE))
    }
  }

  const finishExam = async () => {
    if (!window.confirm('Finish the exam and see your score? You can review each question afterwards.')) {
      return
    }
    await syncRemaining(secondsRef.current)
    setFinishing(true)
    try {
      const res = await fetch(`${API_BASE}/mock-papers/attempts/${attemptId}/complete`, {
        method: 'POST',
        credentials: 'include',
        headers: authHeaders(),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText)
      navigate('/dashboard/mock-exams/results', { state: data })
    } catch (e) {
      alert(e.message || 'Could not finish')
    } finally {
      setFinishing(false)
    }
  }

  const gridStatus = (q) => {
    if (!Object.prototype.hasOwnProperty.call(saved, q.id)) return 'unanswered'
    return saved[q.id] === null ? 'skipped' : 'answered'
  }

  if (!attemptId) {
    return (
      <div className="me-begin">
        <p className="me-begin__text">Invalid session.</p>
        <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
          Back
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="pr">
        <LoadingScreen message="Loading mock exam…" inline />
      </div>
    )
  }

  if (error) {
    return (
      <div className="me-begin">
        <p className="me-begin__text">{error}</p>
        <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
          Back
        </button>
      </div>
    )
  }

  if (!currentQ) {
    return (
      <div className="me-inner">
        <p className="me-begin__text">No questions.</p>
      </div>
    )
  }

  return (
    <div className="pr">
      <div className="pr__top">
        <div>
          <h2 style={{ margin: 0 }}>{paper?.title || 'Mock exam'}</h2>
          <div style={{ color: '#64748b' }}>
            Question {currentIndex + 1} of {questions.length}
          </div>
        </div>
        <div className="pr__top-right">
          <div className="pr__timer">
            <LuClock size={18} aria-hidden style={{ marginRight: 6, opacity: 0.85 }} />
            <div className={`pr__time ${display === '00:00' ? 'pr__time--warn' : ''}`}>{display}</div>
            <button type="button" onClick={toggle} className="btn btn--ghost btn--icon">
              {running ? <LuPause /> : <LuPlay />}
              {running ? 'Pause' : 'Resume'}
            </button>
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--icon"
            onClick={async () => {
              await syncRemaining(secondsRef.current)
              navigate('/dashboard/mock-exams')
            }}
          >
            <LuChevronLeft />
            Exit
          </button>
        </div>
      </div>

      <div className="pr__grid">
        <div className="card question-card">
          <div className="card__body">
            <div className="question-content">
              <div className="question-stem-wrapper">
                <div className="question-stem mock-exam-stem">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                    {currentQ.stem}
                  </ReactMarkdown>
                </div>
              </div>
              <div className="mock-exam-options" style={{ display: 'grid', gap: 8 }}>
                {(currentQ.options || []).map((o) => {
                  const userSelected = selected === o.id
                  let className = 'option'
                  if (userSelected) className += ' option--selected'
                  return (
                    <label key={o.id} className={className}>
                      <input
                        type="radio"
                        name="opt"
                        value={o.id}
                        checked={userSelected}
                        onChange={() => setSelected(o.id)}
                      />
                      <div className="option__label">{o.label}.</div>
                      <div className="option__body">{o.body}</div>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="controls">
              <div className="controls__left">
                {currentQ ? (
                  <button
                    type="button"
                    className={`btn btn--ghost btn--icon ${flagged.has(String(currentQ.id)) ? 'is-flagged' : ''}`}
                    onClick={() => {
                      const id = String(currentQ.id)
                      setFlagged((prev) => {
                        const next = new Set(prev)
                        if (next.has(id)) next.delete(id)
                        else next.add(id)
                        return next
                      })
                    }}
                  >
                    <LuFlag />
                    {flagged.has(String(currentQ.id)) ? 'Flagged' : 'Flag'}
                  </button>
                ) : null}
              </div>
              <div className="controls__right">
                <button type="button" onClick={goPrev} disabled={currentIndex <= 0} className="btn btn--ghost btn--icon">
                  <LuChevronLeft />
                  Previous
                </button>
                {needsSaveAnswer ? (
                  <button
                    type="button"
                    onClick={onSubmit}
                    disabled={submitting}
                    className="btn btn--primary"
                  >
                    {submitting
                      ? 'Saving…'
                      : hasRecorded && typeof recordedVal === 'number'
                        ? 'Update answer'
                        : 'Save answer'}
                  </button>
                ) : null}
                {readyToAdvance && !needsSaveAnswer ? (
                  <>
                    {currentIndex < questions.length - 1 ? (
                      <button type="button" onClick={goNext} className="btn btn--primary btn--icon">
                        Next
                      </button>
                    ) : (
                      <button type="button" onClick={finishExam} disabled={finishing} className="btn btn--primary">
                        {finishing ? 'Finishing…' : 'Finish exam'}
                      </button>
                    )}
                  </>
                ) : null}
                {showSkipUnanswered || showSkipClear ? (
                  <button
                    type="button"
                    onClick={onSkip}
                    disabled={submitting || needsSaveAnswer}
                    className="btn btn--ghost"
                  >
                    {showSkipClear ? 'Clear answer (skip)' : 'Skip'}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="pr__aside">
          <div className="card progress-tracker-card">
            <div className="card__body">
              <div className="track-section">
                <p className="mock-exam-tracker-hint">
                  Navigate questions. You can change your saved choice anytime before you finish the exam. Correct answers
                  are shown only after you finish. Use <strong>Flag</strong> below the question to mark items to revisit—the
                  sidebar highlights them and lists them under Flagged.
                </p>
                <div className="trk-top-row">
                  {(() => {
                    const totalRanges = Math.ceil(questions.length / QUESTIONS_PER_PAGE) || 1
                    const ranges = Array.from({ length: totalRanges }, (_, i) => {
                      const start = i * QUESTIONS_PER_PAGE + 1
                      const end = Math.min((i + 1) * QUESTIONS_PER_PAGE, questions.length)
                      return { idx: i, label: `${start}-${end}` }
                    })
                    return (
                      <select
                        className="trk-range-select"
                        value={selectedRangeIdx}
                        onChange={(e) => setSelectedRangeIdx(parseInt(e.target.value, 10))}
                      >
                        {ranges.map((r) => (
                          <option key={r.idx} value={r.idx}>
                            Q {r.label}
                          </option>
                        ))}
                      </select>
                    )
                  })()}
                </div>
                <div className="trk-grid-container">
                  <div className="trk-grid">
                    {questions
                      .slice(selectedRangeIdx * QUESTIONS_PER_PAGE, (selectedRangeIdx + 1) * QUESTIONS_PER_PAGE)
                      .map((q, localIdx) => {
                        const idx = selectedRangeIdx * QUESTIONS_PER_PAGE + localIdx
                        const st = gridStatus(q)
                        const isCurrent = idx === currentIndex
                        const isFlag = flagged.has(String(q.id))
                        const classes = `seg seg--${st} ${isCurrent ? 'seg--current' : ''} ${isFlag ? 'seg--flagged' : ''}`
                        return (
                          <button
                            key={q.id}
                            type="button"
                            className={classes}
                            aria-label={`Question ${idx + 1}${isFlag ? ', flagged' : ''}`}
                            title={`Q${idx + 1}${isFlag ? ' • flagged' : ''}`}
                            onClick={() => {
                              setCurrentIndex(idx)
                              setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
                            }}
                          />
                        )
                      })}
                  </div>
                </div>
                {flagged.size > 0 ? (
                  <div className="trk-flagged-rail">
                    <div className="trk-rail__label">Flagged</div>
                    <div className="trk-rail__list">
                      {questions.map((q, idx) =>
                        flagged.has(String(q.id)) ? (
                          <button
                            key={q.id}
                            type="button"
                            className="pill"
                            onClick={() => {
                              setCurrentIndex(idx)
                              setSelectedRangeIdx(Math.floor(idx / QUESTIONS_PER_PAGE))
                              setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 0)
                            }}
                          >
                            {idx + 1}
                          </button>
                        ) : null,
                      )}
                    </div>
                  </div>
                ) : null}
                <div className="trk-legend">
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--answered" /> Answered
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch legend-swatch--skipped" /> Skipped
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch swatch--unanswered" /> Not yet
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch swatch--current" /> Current
                  </span>
                  <span className="legend-item">
                    <span className="legend-swatch swatch--flagged" /> Flagged
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--primary mock-exam-finish-sidebar"
                  onClick={finishExam}
                  disabled={finishing}
                >
                  {finishing ? 'Finishing…' : 'Finish exam early'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
