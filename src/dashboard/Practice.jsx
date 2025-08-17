import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Practice.css'
import { LuSave, LuFlag, LuChevronLeft, LuArrowRight, LuPause, LuPlay, LuBookOpen, LuShare2, LuPlus, LuCircleCheck, LuCircleAlert, LuLightbulb } from 'react-icons/lu'
import LoadingScreen from '../components/loading/LoadingScreen'

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
  const [loading, setLoading] = useState(true)
  const [question, setQuestion] = useState(null)
  const [options, setOptions] = useState([])
  const [progress, setProgress] = useState({ completed: 0, total: 0 })
  const [result, setResult] = useState(null)
  const [selected, setSelected] = useState(null)
  const [saqText, setSaqText] = useState('')
  const [sessionAnswered, setSessionAnswered] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotalMs, setSessionTotalMs] = useState(0)
  const [questionStart, setQuestionStart] = useState(Date.now())
  const [tab, setTab] = useState('quick')
  const [questionHistory, setQuestionHistory] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [sessionQuestionIds, setSessionQuestionIds] = useState(new Set())
  const [eli5Enabled, setEli5Enabled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [questionQueue, setQuestionQueue] = useState([])
  const [usedQuestionIds, setUsedQuestionIds] = useState(new Set())
  const { display, running, toggle } = useCountdown(25 * 60)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const preloadedRef = useRef([])
  const queueSize = 3

  const fetchNextBatch = async () => {
    const res = await fetch(`${API_BASE}/qbank/practice/next?specialty_id=${specialtyId}`, { credentials: 'include', cache: 'no-store' })
    const data = await res.json()
    preloadedRef.current.push(data)
  }

  const ensureQueue = async () => {
    while (preloadedRef.current.length < queueSize) {
      await fetchNextBatch()
    }
  }

  const popNext = () => {
    const data = preloadedRef.current.shift()
    if (data?.question && !usedQuestionIds.has(data.question.id)) {
      setQuestion(data.question)
      setOptions(data.options || [])
      setProgress(data.progress || { completed: 0, total: 0 })
      setQuestionStart(Date.now())
      setUsedQuestionIds(prev => new Set([...prev, data.question.id]))
    } else {
      // If question is already used or null, try to get another one
      if (preloadedRef.current.length > 0) {
        popNext()
      }
    }
  }

  const loadNext = async () => {
    setLoading(true)
    setResult(null)
    setSelected(null)
    setSaqText('')
    setTab('quick')
    if (preloadedRef.current.length === 0) {
      await ensureQueue()
    }
    const nextData = preloadedRef.current[0]
    
    if (!nextData?.question) {
      navigate('/dashboard/question-bank')
      return
    }
    
    popNext()
    ensureQueue()
    setCurrentIndex(prev => prev + 1)
    setLoading(false)
  }

  const goToPrevious = () => {
    if (currentIndex > 0 && questionHistory[currentIndex - 1]) {
      const prevQuestion = questionHistory[currentIndex - 1]
      if (prevQuestion && prevQuestion.question) {
        setQuestion(prevQuestion.question)
        setOptions(prevQuestion.options)
        setResult(prevQuestion.result)
        setSelected(prevQuestion.selected)
        setSaqText(prevQuestion.saqText || '')
        setCurrentIndex(prev => prev - 1)
        setTab('quick')
      }
    }
  }

  useEffect(() => { if (specialtyId) loadNext() }, [specialtyId])

  const submit = async () => {
    if (!question || submitting) return
    setSubmitting(true)
    
    try {
      const payload = {
        question_id: question.id,
        selected_option_id: selected,
        text_answer: options.length === 0 ? saqText : undefined,
        time_taken_ms: Date.now() - questionStart,
      }
      const res = await fetch(`${API_BASE}/qbank/practice/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      })
      const data = await res.json()
      setResult(data)
    
    // Only count if this question hasn't been answered in this session
    if (!sessionQuestionIds.has(question.id)) {
      setSessionAnswered((n) => n + 1)
      setSessionCorrect((n) => n + (data?.is_correct ? 1 : 0))
      setSessionTotalMs((ms) => ms + (payload.time_taken_ms || 0))
      setSessionQuestionIds(prev => new Set([...prev, question.id]))
    }
    
    // Save to history
    const questionData = {
      question,
      options,
      result: data,
      selected,
      saqText,
      progress
    }
      setQuestionHistory(prev => {
        const newHistory = [...prev]
        newHistory[currentIndex] = questionData
        return newHistory
      })
    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading practice session..." />

  return (
    <div className="pr">
      <div className="pr__top">
        <div>
          <h2 style={{ margin: 0 }}>Question Bank</h2>
          <div style={{ color: '#64748b' }}>Questions Completed {progress.completed}/{progress.total}</div>
        </div>
        <div className="pr__timer">
          <div className="pr__time">{display}</div>
          <button onClick={toggle} className="btn btn--ghost btn--icon">{running ? <LuPause /> : <LuPlay />}{running ? 'Pause' : 'Resume'}</button>
        </div>
      </div>

      {question ? (
        <div className="pr__grid">
          <div className="card question-card">
            <div className="card__header">Clinical Scenario</div>
            <div className="card__body">
              <div className="question-content">
                <div style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{question.stem}</div>
                {options.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {options.map((o) => {
                      const isCorrect = result?.correct_option?.label === o.label;
                      const isSelectedIncorrect = selected === o.id && result && !result.is_correct;
                      const className = `option ${selected === o.id ? 'option--selected' : ''} ${result ? (isCorrect ? 'option--correct' : isSelectedIncorrect ? 'option--incorrect' : '') : ''}`;
                      
                      return (
                        <label key={o.id} className={className}>
                          <input type="radio" name="opt" value={o.id} checked={selected === o.id} onChange={() => setSelected(o.id)} disabled={!!result} />
                          <div className="option__label">{o.label}.</div>
                          <div>{o.body}</div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <textarea className="saq-input" placeholder="Type your answer here..." value={saqText} onChange={(e)=>setSaqText(e.target.value)} disabled={!!result} />
                )}
              </div>
              <div className="controls">
                <div className="controls__left">
                  <button className="btn btn--ghost btn--icon"><LuSave />Save</button>
                  <button className="btn btn--ghost btn--icon"><LuFlag />Flag</button>
                </div>
                <div className="controls__right">
                  <button onClick={goToPrevious} disabled={currentIndex <= 0} className="btn btn--ghost btn--icon"><LuChevronLeft />Previous</button>
                  {!result ? (
                    <>
                      <button onClick={submit} disabled={submitting || (options.length>0 ? !selected : saqText.trim()==='') } className="btn btn--primary">
                        {submitting ? 'Submitting...' : 'Submit'}
                      </button>
                      <button onClick={loadNext} disabled={submitting} className="btn btn--ghost">Skip</button>
                    </>
                  ) : (
                    <button onClick={loadNext} className="btn btn--primary btn--icon">Next Question <LuArrowRight /></button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div className="eli5-toggle">
                    <label className="toggle-switch">
                      <input type="checkbox" checked={eli5Enabled} onChange={(e) => setEli5Enabled(e.target.checked)} />
                      <span className="toggle-slider"></span>
                    </label>
                    <span className="toggle-label">ELI5</span>
                  </div>
                  <div className="tabs">
                    <div className={`tab ${tab==='quick' ? 'tab--active' : ''}`} onClick={()=>setTab('quick')}>Quick</div>
                    <div className={`tab ${tab==='detailed' ? 'tab--active' : ''}`} onClick={()=>setTab('detailed')}>Detailed</div>
                    <div className={`tab ${tab==='visual' ? 'tab--active' : ''}`} onClick={()=>setTab('visual')}>Visual</div>
                  </div>
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
                    {eli5Enabled && result?.explanations?.eli5 ? (
                      <div className="eli5-section">
                        <div className="eli5-header">
                          <LuLightbulb className="eli5-icon" />
                          <span className="eli5-title">Explain Like I'm 5</span>
                        </div>
                        <div className="eli5-content">{result.explanations.eli5}</div>
                      </div>
                    ) : (
                      <>
                        {result?.explanations?.quick_points && result.explanations.quick_points.length > 0 ? (
                          <div className="explain__section">
                            <div className="explain__label">Key Points:</div>
                            <ul className="key-points">
                              {result.explanations.quick_points.map((point, idx) => (
                                <li key={idx} className="key-point">
                                  <div className="key-point-icon">✓</div>
                                  <div>{point}</div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="explain__section">
                            <div className="explain__label">Key Points:</div>
                            <div>{result?.explanations?.quick || '—'}</div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
                {tab==='detailed' && (
                  <div>
                    {result?.explanations?.detailed_context && (
                      <div className="explain__section">
                        <div className="explain__label">{question?.topic_name || 'Clinical Context'}:</div>
                        <div>{result.explanations.detailed_context}</div>
                      </div>
                    )}
                    {result?.explanations?.detailed_pathophysiology && (
                      <div className="explain__section">
                        <div className="explain__label">Pathophysiology:</div>
                        <div>{result.explanations.detailed_pathophysiology}</div>
                      </div>
                    )}
                    {!result?.explanations?.detailed_context && !result?.explanations?.detailed_pathophysiology && (
                      <div className="explain__section">
                        <div className="explain__label">Detailed</div>
                        <div>{result?.explanations?.detailed || '—'}</div>
                      </div>
                    )}
                  </div>
                )}
                {tab==='visual' && (
                  <div className="explain__section">
                    <div className="explain__label">Visual</div>
                    <div>—</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pr__aside">
            <div className="card">
              <div className="card__header">Session Progress</div>
              <div className="card__body progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1f2937' }}>
                  <div>Questions Completed</div>
                  <div>{sessionAnswered}/{progress.total || sessionAnswered}</div>
                </div>
                <div className="progress__bar"><div className="progress__fill" style={{ width: `${progress.total ? Math.round((sessionAnswered / progress.total) * 100) : sessionAnswered > 0 ? 100 : 0}%` }} /></div>
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
      ) : (
        <div>No questions available.</div>
      )}
    </div>
  )
}


