import React, { useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders } from '../../auth/token'
import { useLocation, useNavigate } from 'react-router-dom'
import './Practice.css'
import { LuSave, LuFlag, LuChevronLeft, LuArrowRight, LuPause, LuPlay, LuBookOpen, LuShare2, LuPlus, LuCircleCheck, LuCircleAlert, LuLightbulb } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import DiscussionPanel from './DiscussionPanel'

function useCountdown(initialSec = 1800) {
  const [seconds, setSeconds] = useState(initialSec)
  const [running, setRunning] = useState(true)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!running) return
    timerRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timerRef.current)
  }, [running])
  const toggle = () => setRunning((r) => !r)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return { seconds, display: `${mm}:${ss}`, running, toggle, setSeconds }
}

export default function Practice() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const specialtyId = params.get('specialty_id')
  const topicIds = params.get('topic_ids')
  const numQuestions = parseInt(params.get('num_questions') || '25')
  const timerMinutes = parseInt(params.get('timer_minutes') || '25')
  
  // Session state
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([]) // All questions loaded at start
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({}) // Store user answers by question ID
  const [submittedAnswers, setSubmittedAnswers] = useState(new Set()) // Track submitted questions
  const [flagged, setFlagged] = useState(new Set())
  
  // Current question state
  const [selected, setSelected] = useState(null)
  const [saqText, setSaqText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // UI state
  const [tab, setTab] = useState('quick')
  
  // Session stats
  const [sessionAnswered, setSessionAnswered] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotalMs, setSessionTotalMs] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  
  const { display, running, toggle } = useCountdown(timerMinutes * 60)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Load all questions for the session
  useEffect(() => {
    if (!specialtyId) {
      navigate('/dashboard/question-bank')
      return
    }
    loadSession()
  }, [specialtyId])

  const loadSession = async () => {
    try {
      setLoading(true)
      let url = `${API_BASE}/qbank/practice/session?specialty_id=${specialtyId}&num_questions=${numQuestions}`
      if (topicIds) {
        url += `&topic_ids=${topicIds}`
      }
      
      const res = await fetch(url, { credentials: 'include', headers: authHeaders() })
      if (!res.ok) throw new Error('Failed to load session')
      
      const data = await res.json()
      console.log('Loaded session with', data.questions?.length, 'questions')
      
      if (!data.questions || data.questions.length === 0) {
        alert('No questions available for the selected criteria')
        navigate('/dashboard/question-bank')
        return
      }
      
      setQuestions(data.questions)
      setCurrentIndex(0)
      loadCurrentQuestion(0, data.questions)
      setQuestionStartTime(Date.now())
    } catch (error) {
      console.error('Error loading session:', error)
      alert('Failed to load practice session')
      navigate('/dashboard/question-bank')
    } finally {
      setLoading(false)
    }
  }

  // Load the current question and restore user's previous answer if any
  const loadCurrentQuestion = (index, questionList = questions) => {
    if (!questionList || index < 0 || index >= questionList.length) return
    
    const question = questionList[index]
    const questionId = question.id
    const userAnswer = userAnswers[questionId]
    
    // Restore user's previous answer
    if (userAnswer) {
      setSelected(userAnswer.selected)
      setSaqText(userAnswer.saqText || '')
    } else {
      setSelected(null)
      setSaqText('')
    }
    
    setTab('quick')
    setQuestionStartTime(Date.now())
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      loadCurrentQuestion(newIndex)
    }
  }

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      loadCurrentQuestion(newIndex)
    } else {
      const totalQuestions = questions.length
      const correct = sessionCorrect
      const skipped = Math.max(totalQuestions - sessionAnswered, 0)
      const totalMs = sessionTotalMs
      const perQuestionMs = sessionAnswered ? sessionTotalMs / sessionAnswered : 0
      navigate('/dashboard/question-bank/results', {
        state: { totalQuestions, correct, skipped, totalMs, perQuestionMs }
      })
    }
  }

  const submit = async () => {
    if (!questions[currentIndex] || submitting) return
    
    const currentQuestion = questions[currentIndex]
    const questionId = currentQuestion.id
    
    // Don't submit if already submitted
    if (submittedAnswers.has(questionId)) return
    
    setSubmitting(true)
    
    try {
      console.log('=== FRONTEND SUBMIT ===')
      console.log('Selected:', selected, 'Question type:', currentQuestion.type)
      
      // Calculate if answer is correct on frontend
      let isCorrect = false
      if (currentQuestion.type === 'MCQ') {
        isCorrect = selected === currentQuestion.correct_answer
      } else {
        // For SAQ, we'd need to implement the checking logic here
        // For now, assume it's handled elsewhere or simplified
        isCorrect = false // Placeholder
      }
      
      const timeTaken = Date.now() - questionStartTime
      
      // Save user's answer locally
      setUserAnswers(prev => ({
        ...prev,
        [questionId]: {
          selected,
          saqText,
          isCorrect,
          timeTaken,
          submitted: true
        }
      }))
      
      // Mark as submitted
      setSubmittedAnswers(prev => new Set([...prev, questionId]))
      
      // Update session stats
      const newAnswered = sessionAnswered + 1
      setSessionAnswered(newAnswered)
      setSessionCorrect(prev => prev + (isCorrect ? 1 : 0))
      setSessionTotalMs(prev => prev + timeTaken)
      
      // Submit to backend for tracking
      const payload = {
        question_id: questionId,
        selected_option_id: currentQuestion.type === 'MCQ' ? selected : undefined,
        text_answer: currentQuestion.type === 'SAQ' ? saqText : undefined,
        time_taken_ms: timeTaken,
        is_correct: isCorrect
      }
      
      // Don't await this - let it happen in background
      fetch(`${API_BASE}/qbank/practice/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error('Error submitting to backend:', error)
      })
      
      console.log('Answer submitted successfully')
      
    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div className="pr">
      <LoadingScreen message="Loading practice session..." inline />
    </div>
  )

  if (!questions.length) {
    return <div>No questions available</div>
  }

  const currentQuestion = questions[currentIndex]
  const questionId = currentQuestion?.id
  const userAnswer = userAnswers[questionId]
  const isSubmitted = submittedAnswers.has(questionId)
  
  // Get result data for explanation display
  const result = isSubmitted ? {
    is_correct: userAnswer?.isCorrect || false,
    correct_option: currentQuestion.type === 'MCQ' ? {
      id: currentQuestion.correct_answer,
      label: String.fromCharCode(65 + currentQuestion.correct_answer),
      body: currentQuestion.options[currentQuestion.correct_answer]?.body
    } : null,
    explanations: currentQuestion.explanations
  } : null

  // Build list of all five per-option quick points (always show all)
  const pointsByOption = currentQuestion?.explanations?.points_by_option || null
  const allQuickPoints = pointsByOption
    ? [0,1,2,3,4].map((idx)=>({
        label: String.fromCharCode(65 + idx),
        text: (pointsByOption[String(idx)]?.[0]) || null,
        isCorrect: currentQuestion?.correct_answer === idx,
      }))
      .filter((p)=>p.text)
    : []

  return (
    <div className="pr">
      <div className="pr__top">
        <div>
          <h2 style={{ margin: 0 }}>Question Bank</h2>
          <div style={{ color: '#64748b' }}>Question {currentIndex + 1} of {questions.length}</div>
        </div>
        {timerMinutes > 0 && (
          <div className="pr__timer">
            <div className="pr__time">{display}</div>
            <button onClick={toggle} className="btn btn--ghost btn--icon">{running ? <LuPause /> : <LuPlay />}{running ? 'Pause' : 'Resume'}</button>
          </div>
        )}
      </div>

      {currentQuestion && (
        <div className="pr__grid">
          <div className="card question-card">
            <div className="card__header">{currentQuestion.topic_name}</div>
            <div className="card__body">
              <div className="question-content">
                <div style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{currentQuestion.stem}</div>
                {currentQuestion.options?.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {currentQuestion.options.map((o) => {
                      const isCorrect = result?.correct_option?.label === o.label;
                      const isSelectedIncorrect = selected === o.id && result && !result.is_correct;
                      const className = `option ${selected === o.id ? 'option--selected' : ''} ${result ? (isCorrect ? 'option--correct' : isSelectedIncorrect ? 'option--incorrect' : '') : ''}`;
                      
                      return (
                        <label key={o.id} className={className}>
                          <input type="radio" name="opt" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} disabled={isSubmitted} />
                          <div className="option__label">{o.label}.</div>
                          <div>{o.body}</div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea className="saq-input" placeholder="Type your answer here..." value={saqText} onChange={(e)=>setSaqText(e.target.value)} disabled={isSubmitted} />
                )}
              </div>
              <div className="controls">
                <div className="controls__left">
                  <button className="btn btn--ghost btn--icon"><LuSave />Save</button>
                  <button className={`btn btn--ghost btn--icon ${flagged.has(questionId) ? 'is-flagged' : ''}`} onClick={()=>{
                    setFlagged(prev => {
                      const next = new Set(prev)
                      if (next.has(questionId)) next.delete(questionId); else next.add(questionId)
                      return next
                    })
                  }}><LuFlag />{flagged.has(questionId) ? 'Flagged' : 'Flag'}</button>
                </div>
                <div className="controls__right">
                  <button onClick={goToPrevious} disabled={currentIndex <= 0} className="btn btn--ghost btn--icon"><LuChevronLeft />Previous</button>
                  {!isSubmitted ? (
                    <>
                      <button onClick={submit} disabled={submitting || (currentQuestion.options?.length > 0 ? selected === null || selected === undefined : saqText.trim() === '')} className="btn btn--primary">
                        {submitting ? 'Submitting...' : 'Submit'}
                      </button>
                      <button onClick={goToNext} disabled={submitting} className="btn btn--ghost">
                        {currentIndex === questions.length - 1 ? 'Finish' : 'Skip'}
                      </button>
                    </>
                  ) : (
                    <button onClick={goToNext} className="btn btn--primary btn--icon">
                      {currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'} <LuArrowRight />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className="card explanation-card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={`ex-card__status ${result.is_correct ? 'ex-card__status--correct' : 'ex-card__status--incorrect'}`}>
                  {result.is_correct ? <LuCircleCheck /> : <LuCircleAlert />}
                  {result.is_correct ? 'Correct' : 'Incorrect'}
                </div>
                <div className="tabs">
                  <div className={`tab ${tab==='quick' ? 'tab--active' : ''}`} onClick={()=>setTab('quick')}>Quick</div>
                  <div className={`tab ${tab==='detailed' ? 'tab--active' : ''}`} onClick={()=>setTab('detailed')}>Detailed</div>
                  <div className={`tab ${tab==='eli5' ? 'tab--active' : ''}`} onClick={()=>setTab('eli5')}>ELI5</div>
                </div>
              </div>
              <div className="card__body explain">
                {!result.is_correct && result.correct_option && (
                  <div className="correct-answer-banner">
                    <LuCircleCheck className="correct-answer-icon" />
                    <div>
                      <div className="correct-answer-title">Correct Answer</div>
                      <div className="correct-answer-text">{result.correct_option.label}. {result.correct_option.body}</div>
                    </div>
                  </div>
                )}
                {tab==='quick' && (
                  <div>
                    {allQuickPoints && allQuickPoints.length > 0 ? (
                      <div className="explain__section">
                        <div className="explain__label">Explanations:</div>
                        <ul className="key-points">
                          {allQuickPoints.map((p, idx) => (
                            <li key={idx} className={`key-point ${p.isCorrect ? 'key-point--correct' : ''}`}>
                              <div className={`key-point-badge ${p.isCorrect ? 'is-correct' : 'is-wrong'}`}>{p.label}</div>
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
                {tab==='detailed' && (
                  <div>
                    <div className="explain__section">
                      <div className="explain__label">Detailed Explanation:</div>
                      <div>{result?.explanations?.detailed || 'No detailed explanation available'}</div>
                    </div>
                  </div>
                )}
                {tab==='eli5' && (
                  <div>
                    <div className="eli5-section">
                      <div className="eli5-header">
                        <LuLightbulb className="eli5-icon" />
                        <span className="eli5-title">Explain Like I'm 5</span>
                      </div>
                      <div className="eli5-content">{result?.explanations?.eli5 || 'No ELI5 explanation available'}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Discussion below explanation */}
          <div style={{ gridColumn: '1', gridRow: '3' }}>
            <DiscussionPanel questionId={currentQuestion.id} API_BASE={API_BASE} />
          </div>

          <div className="pr__aside">
            <div className="card">
              <div className="card__header">Session Progress</div>
              <div className="card__body progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1f2937' }}>
                  <div>Questions Completed</div>
                  <div>{sessionAnswered}/{questions.length}</div>
                </div>
                <div className="progress__bar"><div className="progress__fill" style={{ width: `${Math.round((sessionAnswered / questions.length) * 100)}%` }} /></div>
                <div className="progress__stats" style={{ justifyContent: 'space-around' }}>
                  <div>
                    <div className="stat--green">{sessionAnswered ? Math.round((sessionCorrect/sessionAnswered)*100) : 0}%</div>
                    <div className="stat-label">Accuracy</div>
                  </div>
                  <div>
                    <div className="stat--blue">{sessionAnswered ? Math.round((sessionTotalMs/sessionAnswered)/1000) : 0}s</div>
                    <div className="stat-label">Avg Time</div>
                  </div>
                </div>
                <div style={{ height: 8, borderTop: '1px solid #eef2f7', marginTop: 10 }} />
                <div style={{ color: '#1f2937', fontWeight: 700 }}>Weak Areas Detected</div>
                <div style={{ height: 8 }} />
              </div>
            </div>

            {/* Track Questions Navigator */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header">Track Questions</div>
              <div className="card__body flagged-nav">
                <div className="flagged-grid">
                  {questions.map((q, idx) => {
                    const num = idx + 1
                    const isCurrent = idx === currentIndex
                    const isFlagged = flagged.has(q.id)
                    const ua = userAnswers[q.id]
                    const statusClass = ua?.submitted ? (ua.isCorrect ? 'correct' : 'wrong') : ''
                    return (
                      <button key={q.id} className={`flagged-pill ${statusClass} ${isFlagged ? 'flagged' : ''} ${isCurrent ? 'current' : ''}`} onClick={()=>{
                        setCurrentIndex(idx); loadCurrentQuestion(idx)
                        setTimeout(()=>{ window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                      }}>{num}</button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header">Quick Actions</div>
              <div className="card__body quick-actions">
                <button className="qa-btn"><LuBookOpen /> View in Textbook</button>
                <button className="qa-btn"><LuShare2 /> Share Question</button>
                <button className="qa-btn"><LuPlus /> Add to Review Deck</button>
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}


