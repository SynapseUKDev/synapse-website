import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import {
  LuChevronLeft,
  LuArrowRight,
  LuCircleAlert,
  LuCircleCheck,
  LuLightbulb,
  LuEraser,
} from 'react-icons/lu'
import { authHeaders } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import useQuestionStemHighlight from '../practice/useQuestionStemHighlight.jsx'
import { buildMockReviewSession } from './mockExamReviewUtils.js'
import '../practice/Practice.css'
import '../practice/PracticeSetup.css'
import './MockExams.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const QUESTIONS_PER_PAGE = 30

export default function MockExamReview() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const attemptIdQuery = searchParams.get('attempt_id')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [questions, setQuestions] = useState([])
  const [userAnswers, setUserAnswers] = useState({})
  const [sessionStats, setSessionStats] = useState(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewFilter, setReviewFilter] = useState('All')
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0)
  const [tab, setTab] = useState('quick')

  const {
    stemRef,
    renderHighlightedText,
    renderPopover,
    clearHighlights,
    hasHighlights,
    setActiveQuestion,
  } = useQuestionStemHighlight()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    const state = location.state || {}
    const fromState =
      (Array.isArray(state.questions) && state.questions.length > 0) || Number(state.total) > 0

    if (fromState) {
      const session = buildMockReviewSession(state)
      setQuestions(session.questions)
      setUserAnswers(session.userAnswers)
      setSessionStats(session.sessionStats)
      setLoading(false)
      setError(null)
      return undefined
    }

    const attemptId = attemptIdQuery
    if (!attemptId) {
      setLoading(false)
      setError('Missing attempt')
      return undefined
    }

    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `${API_BASE}/mock-papers/attempts/${encodeURIComponent(attemptId)}/review`,
          { credentials: 'include', headers: authHeaders() },
        )
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || res.statusText)
        if (cancelled) return
        const session = buildMockReviewSession(json)
        setQuestions(session.questions)
        setUserAnswers(session.userAnswers)
        setSessionStats(session.sessionStats)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load review')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [attemptIdQuery, location.key])

  const currentQuestion = questions[currentIndex]
  const currentQuestionId = currentQuestion?.id

  useEffect(() => {
    setActiveQuestion(currentQuestion || null)
  }, [currentQuestion, setActiveQuestion])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [currentIndex])

  const reviewStats = useMemo(() => {
    const totalQuestions = sessionStats?.totalQuestions || questions.length
    const correct = sessionStats?.correct || 0
    const skipped = sessionStats?.skipped || 0
    const attempted = totalQuestions - skipped
    return {
      correct,
      totalQuestions,
      skipped,
      accuracy: attempted > 0 ? Math.round((correct / attempted) * 100) : 0,
    }
  }, [sessionStats, questions.length])

  const filteredIndices = useMemo(() => {
    return questions
      .map((q, idx) => {
        const answer = userAnswers[q.id]
        if (reviewFilter === 'All') return idx
        if (reviewFilter === 'Correct' && answer?.submitted && answer?.isCorrect) return idx
        if (reviewFilter === 'Incorrect' && answer?.submitted && !answer?.isCorrect) return idx
        if (reviewFilter === 'Skipped' && !answer?.submitted) return idx
        return -1
      })
      .filter((idx) => idx !== -1)
  }, [questions, userAnswers, reviewFilter])

  const currentFilteredPosition = filteredIndices.indexOf(currentIndex)

  const userAnswer = currentQuestionId ? userAnswers[currentQuestionId] : null
  const result = currentQuestion
    ? {
        is_correct: !!userAnswer?.isCorrect,
        correct_option:
          currentQuestion.type === 'MCQ' && currentQuestion.correct_answer != null
            ? {
                id: currentQuestion.correct_answer,
                label: String.fromCharCode(65 + currentQuestion.correct_answer),
                body: currentQuestion.options[currentQuestion.correct_answer]?.body,
              }
            : null,
        explanations: currentQuestion.explanations,
      }
    : null

  const pointsByOption = currentQuestion?.explanations?.points_by_option || null
  const allQuickPoints = pointsByOption
    ? [0, 1, 2, 3, 4]
        .map((idx) => ({
          label: String.fromCharCode(65 + idx),
          text: pointsByOption[String(idx)]?.[0] || null,
          isCorrect: currentQuestion?.correct_answer === idx,
        }))
        .filter((p) => p.text)
    : []

  const goToQuestion = (idx) => {
    setCurrentIndex(idx)
    setSelectedRangeIdx(Math.floor(idx / QUESTIONS_PER_PAGE))
  }

  const resultsPath = sessionStats?.attemptId
    ? `/dashboard/mock-exams/results?attempt_id=${encodeURIComponent(sessionStats.attemptId)}`
    : '/dashboard/mock-exams/results'

  if (loading) {
    return (
      <div className="pr">
        <LoadingScreen message="Loading review…" inline />
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

  if (!questions.length) {
    return (
      <div className="me-begin">
        <div className="me-begin__card">
          <p className="me-begin__text">No questions to review.</p>
          <button type="button" className="me-btn" onClick={() => navigate('/dashboard/mock-exams')}>
            Mock exams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pr pr--review-mode">
      <div className="pr__top">
        <div>
          <h2 style={{ margin: 0 }}>Review Session</h2>
          <div className="pr__top-caption">
            Question {currentIndex + 1} of {questions.length}
            {reviewFilter !== 'All' &&
              ` (${currentFilteredPosition + 1} of ${filteredIndices.length} ${reviewFilter.toLowerCase()})`}
          </div>
        </div>
        <div className="pr__top-right">
          <button
            type="button"
            onClick={() => navigate(resultsPath)}
            className="btn btn--ghost btn--icon"
            title="Back to results"
          >
            <LuChevronLeft />
            Back to Results
          </button>
        </div>
      </div>

      {currentQuestion && (
        <div className="pr__grid">
          <div className="card question-card">
            <div className="card__body">
              <div className="question-content">
                <div className="question-stem-wrapper">
                  <div ref={stemRef} className="question-stem mock-exam-stem">
                    {renderHighlightedText(currentQuestion.stem, currentQuestion.id)}
                  </div>
                  {renderPopover()}
                </div>
                {currentQuestion.options?.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {currentQuestion.options.map((o) => {
                      const isCorrectOption = currentQuestion.correct_answer === o.id
                      const userSelected = userAnswer?.selected === o.id
                      const isSelectedIncorrect = userSelected && !isCorrectOption
                      let className = 'option'
                      if (userSelected) className += ' option--selected'
                      if (isCorrectOption) className += ' option--correct'
                      else if (isSelectedIncorrect) className += ' option--incorrect'
                      return (
                        <label key={o.id} className={className}>
                          <input type="radio" name="opt" value={o.id} checked={userSelected} readOnly disabled />
                          <div className="option__label">{o.label}.</div>
                          <div className="option__body">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                              {o.body || ''}
                            </ReactMarkdown>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                ) : null}
              </div>
              <div className="controls">
                <div className="controls__left">
                  <div className="review-status-badge">
                    {userAnswer?.submitted ? (
                      userAnswer.isCorrect ? (
                        <span className="review-status review-status--correct">
                          <LuCircleCheck size={16} /> Correct
                        </span>
                      ) : (
                        <span className="review-status review-status--incorrect">
                          <LuCircleAlert size={16} /> Incorrect
                        </span>
                      )
                    ) : (
                      <span className="review-status review-status--skipped">Skipped</span>
                    )}
                  </div>
                  {hasHighlights(currentQuestion.id) ? (
                    <button
                      type="button"
                      className="btn btn--ghost btn--icon"
                      onClick={() => clearHighlights(currentQuestion.id)}
                      title="Clear all highlights"
                      aria-label="Clear all highlights"
                    >
                      <LuEraser aria-hidden />
                      Clear Highlights
                    </button>
                  ) : null}
                </div>
                <div className="controls__right">
                  <button
                    type="button"
                    onClick={() => {
                      const prevIdx = filteredIndices[currentFilteredPosition - 1]
                      if (prevIdx !== undefined) goToQuestion(prevIdx)
                    }}
                    disabled={currentFilteredPosition <= 0}
                    className="btn btn--ghost btn--icon"
                  >
                    <LuChevronLeft />
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx = filteredIndices[currentFilteredPosition + 1]
                      if (nextIdx !== undefined) goToQuestion(nextIdx)
                    }}
                    disabled={currentFilteredPosition >= filteredIndices.length - 1}
                    className="btn btn--primary btn--icon"
                  >
                    Next <LuArrowRight />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card explanation-card">
            <div
              className="card__header"
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <div
                className={`ex-card__status ${result.is_correct ? 'ex-card__status--correct' : 'ex-card__status--incorrect'}`}
              >
                {result.is_correct ? <LuCircleCheck /> : <LuCircleAlert />}
                {result.is_correct ? 'Correct' : 'Incorrect'}
              </div>
              <div className="tabs">
                <div className={`tab ${tab === 'quick' ? 'tab--active' : ''}`} onClick={() => setTab('quick')}>
                  Quick
                </div>
                <div className={`tab ${tab === 'detailed' ? 'tab--active' : ''}`} onClick={() => setTab('detailed')}>
                  Detailed
                </div>
                <div className={`tab ${tab === 'eli5' ? 'tab--active' : ''}`} onClick={() => setTab('eli5')}>
                  ELI5
                </div>
              </div>
            </div>
            <div className="card__body explain">
              {!result.is_correct && result.correct_option && (
                <div className="correct-answer-banner">
                  <LuCircleCheck className="correct-answer-icon" />
                  <div>
                    <div className="correct-answer-title">Correct Answer</div>
                    <div className="correct-answer-text">
                      {result.correct_option.label}. {result.correct_option.body}
                    </div>
                  </div>
                </div>
              )}
              {tab === 'quick' && (
                <div>
                  {allQuickPoints.length > 0 ? (
                    <div className="explain__section">
                      <div className="explain__label">Explanations:</div>
                      <ul className="key-points">
                        {allQuickPoints.map((p, idx) => (
                          <li key={idx} className={`key-point ${p.isCorrect ? 'key-point--correct' : ''}`}>
                            <div className={`key-point-badge ${p.isCorrect ? 'is-correct' : 'is-wrong'}`}>
                              {p.label}
                            </div>
                            <div>{p.text}</div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="explain__section">
                      <div className="explain__label">Explanations:</div>
                      <div>No quick points available</div>
                    </div>
                  )}
                </div>
              )}
              {tab === 'detailed' && (
                <div className="explain__section">
                  <div className="explain__label">Detailed Explanation:</div>
                  <div>{result?.explanations?.detailed || 'No detailed explanation available'}</div>
                </div>
              )}
              {tab === 'eli5' && (
                <div className="eli5-section">
                  <div className="eli5-header">
                    <LuLightbulb className="eli5-icon" />
                    <span className="eli5-title">Explain Like I&apos;m 5</span>
                  </div>
                  <div className="eli5-content">{result?.explanations?.eli5 || 'No ELI5 explanation available'}</div>
                </div>
              )}
            </div>
          </div>

          <div className="pr__aside">
            <div className="card progress-tracker-card">
              <div className="card__body">
                <div className="progress-tracker-header">
                  <div className="progress-stats-row review-stats-row">
                    <div className="progress-stat">
                      <div className="progress-stat__value stat--green">{reviewStats.correct}</div>
                      <div className="progress-stat__label">Correct</div>
                    </div>
                    <div className="progress-stat">
                      <div className="progress-stat__value stat--red">
                        {reviewStats.totalQuestions - reviewStats.correct - reviewStats.skipped}
                      </div>
                      <div className="progress-stat__label">Incorrect</div>
                    </div>
                    <div className="progress-stat">
                      <div className="progress-stat__value">{reviewStats.skipped}</div>
                      <div className="progress-stat__label">Skipped</div>
                    </div>
                    <div className="progress-stat">
                      <div className="progress-stat__value stat--blue">{reviewStats.accuracy}%</div>
                      <div className="progress-stat__label">Accuracy</div>
                    </div>
                  </div>
                </div>

                <div className="track-section">
                  <div className="trk-top-row">
                    {(() => {
                      const totalRanges = Math.ceil(questions.length / QUESTIONS_PER_PAGE) || 1
                      return (
                        <select
                          className="trk-range-select"
                          value={selectedRangeIdx}
                          onChange={(e) => setSelectedRangeIdx(Number(e.target.value))}
                          aria-label="Question range"
                        >
                          {Array.from({ length: totalRanges }, (_, i) => {
                            const start = i * QUESTIONS_PER_PAGE + 1
                            const end = Math.min((i + 1) * QUESTIONS_PER_PAGE, questions.length)
                            return (
                              <option key={i} value={i}>
                                Q {start}–{end}
                              </option>
                            )
                          })}
                        </select>
                      )
                    })()}
                  </div>

                  <div className="trk-filters">
                    {['All', 'Correct', 'Incorrect', 'Skipped'].map((f) => (
                      <button
                        key={f}
                        type="button"
                        className={`chip ${reviewFilter === f ? 'is-active' : ''}`}
                        onClick={() => {
                          setReviewFilter(f)
                          const firstMatch = questions.findIndex((q) => {
                            const answer = userAnswers[q.id]
                            if (f === 'All') return true
                            if (f === 'Correct') return answer?.submitted && answer?.isCorrect
                            if (f === 'Incorrect') return answer?.submitted && !answer?.isCorrect
                            if (f === 'Skipped') return !answer?.submitted
                            return true
                          })
                          if (firstMatch !== -1) goToQuestion(firstMatch)
                        }}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div className="trk-grid-container">
                    {(() => {
                      const start = selectedRangeIdx * QUESTIONS_PER_PAGE
                      const end = Math.min(start + QUESTIONS_PER_PAGE, questions.length)
                      const rangeQuestions = questions.slice(start, end)
                      return (
                        <div className="trk-grid">
                          {rangeQuestions.map((q, localIdx) => {
                            const idx = start + localIdx
                            const ua = userAnswers[q.id]
                            const isCurrent = idx === currentIndex
                            let status = 'Unanswered'
                            if (ua?.submitted) status = ua.isCorrect ? 'Correct' : 'Wrong'
                            const reviewStatus = ua?.submitted
                              ? ua.isCorrect
                                ? 'Correct'
                                : 'Incorrect'
                              : 'Skipped'
                            const matchesFilter = reviewFilter === 'All' || reviewFilter === reviewStatus
                            const statusClass = status.toLowerCase()
                            const classes = `seg seg--${statusClass}${isCurrent ? ' seg--current' : ''}${matchesFilter ? '' : ' seg--dim'}`
                            return (
                              <button
                                key={q.id}
                                type="button"
                                className={classes}
                                aria-label={`Go to question ${idx + 1}. Status: ${status}.`}
                                title={`Q${idx + 1} • ${status}`}
                                onClick={() => goToQuestion(idx)}
                              />
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  <div className="trk-legend">
                    <span className="legend-item">
                      <span className="legend-swatch swatch--correct" /> Correct
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch swatch--wrong" /> Incorrect
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch swatch--unanswered" /> Skipped
                    </span>
                    <span className="legend-item">
                      <span className="legend-swatch swatch--current" /> Current
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
