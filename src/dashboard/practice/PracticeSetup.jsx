import React, { useEffect, useState } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuPlay } from 'react-icons/lu'
import './PracticeSetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

export default function PracticeSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const specialtyId = searchParams.get('specialty_id')
  const specialtyName = searchParams.get('specialty_name') || 'Unknown Specialty'
  const studySetId = searchParams.get('study_set_id')
  const studySetName = searchParams.get('study_set_name') || 'Unknown Set'
  
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [numQuestions, setNumQuestions] = useState(25)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [includeAttempted, setIncludeAttempted] = useState(false)
  const [studySetData, setStudySetData] = useState(null)
  const [specialtyAttemptedCount, setSpecialtyAttemptedCount] = useState(null)
  const [specialtyTotalQuestions, setSpecialtyTotalQuestions] = useState(null)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    if (studySetId) {
      loadStudySet()
    } else if (specialtyId) {
      loadTopics()
    } else {
      navigate('/dashboard/question-bank')
    }
  }, [specialtyId, studySetId])

  const loadStudySet = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${studySetId}`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load study set')
      const data = await res.json()
      setStudySetData(data.set)
      
      const totalAvailable = data.set.total_questions || 0
      if (totalAvailable > 0) {
        setNumQuestions(Math.min(totalAvailable, 25))
      } else {
        setNumQuestions(0)
      }
    } catch (error) {
      console.error('Error loading study set:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTopics = async () => {
    try {
      const res = await fetch(`${API_BASE}/qbank/specialty/${specialtyId}/topics`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load topics')
      const data = await res.json()
      setTopics(data.topics || [])
      setSpecialtyAttemptedCount(typeof data.specialty_attempted_count === 'number' ? data.specialty_attempted_count : null)
      setSpecialtyTotalQuestions(typeof data.specialty_total_questions === 'number' ? data.specialty_total_questions : null)
      
      // Select all topics by default
      const allTopicIds = new Set(data.topics?.map(t => t.id) || [])
      setSelectedTopics(allTopicIds)
      
      const totalAvailable = (data.topics || []).reduce((sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
      if (totalAvailable > 0) {
        setNumQuestions(Math.min(totalAvailable, 25))
      } else {
        setNumQuestions(0)
      }
    } catch (error) {
      console.error('Error loading topics:', error)
      setTopics([])
    } finally {
      setLoading(false)
    }
  }

  const toggleTopic = (topicId) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId)
    } else {
      newSelected.add(topicId)
    }
    setSelectedTopics(newSelected)
    
    // Update question count when topics change
    const newTotalAvailable = topics
      .filter(t => newSelected.has(t.id))
      .reduce((sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
    
    if (newTotalAvailable === 0) {
      setNumQuestions(0)
    } else if (numQuestions === 0 || numQuestions > newTotalAvailable) {
      setNumQuestions(newTotalAvailable)
    }
  }

  const updateSliderProgress = (value, min, max) => {
    const progress = ((value - min) / (max - min)) * 100
    return progress
  }

  const selectAllTopics = () => {
    const allTopicIds = new Set(topics.map(t => t.id))
    setSelectedTopics(allTopicIds)
  }

  const clearAllTopics = () => {
    setSelectedTopics(new Set())
    setNumQuestions(0)
  }

  const getTotalQuestions = () => {
    if (studySetId) {
      // For study set, we use the total from DB. 
      // TODO: Ideally fetch "remaining" vs "total" for set if includeAttempted logic is needed.
      // Currently `total_questions` is static total.
      // Let's assume for now we just use total available.
      return studySetData?.total_questions || 0
    }
    return topics
      .filter(t => selectedTopics.has(t.id))
      .reduce((sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
  }

  const getStepperMin = () => {
    const total = getTotalQuestions()
    return total > 0 ? 1 : 0
  }

  const startSession = () => {
    if (!studySetId && selectedTopics.size === 0) {
      alert('Please select at least one topic')
      return
    }

    const params = new URLSearchParams({
      num_questions: numQuestions.toString(),
      timer_minutes: timerEnabled ? timerMinutes.toString() : '0',
      include_attempted: includeAttempted ? '1' : '0'
    })

    if (studySetId) {
      params.append('study_set_id', studySetId)
      params.append('study_set_name', studySetName)
    } else {
      params.append('specialty_id', specialtyId)
      params.append('specialty_name', specialtyName)
      params.append('topic_ids', Array.from(selectedTopics).join(','))
    }
    
    navigate(`/dashboard/question-bank/practice?${params.toString()}`)
  }

  if (loading) {
    return <LoadingScreen message="Loading practice setup..." />
  }

  const totalAvailable = getTotalQuestions()
  const maxQuestions = totalAvailable
  const stepperMin = getStepperMin()
  const isDisabled = totalAvailable === 0

  return (
    <div className="setup">
      <div className="setup__header">
        <button 
          className="setup__back"
          onClick={() => navigate('/dashboard/question-bank')}
        >
          <LuChevronLeft />
          Back to Question Bank
        </button>
        <div className="setup__title-section">
          <div>
            <h1 className="setup__title">{studySetId ? studySetName : specialtyName} Practice Setup</h1>
            <p className="setup__subtitle">
              {!studySetId && specialtyAttemptedCount !== null && specialtyTotalQuestions !== null
                ? `${specialtyAttemptedCount}/${specialtyTotalQuestions} attempted in this specialty • Configure your session`
                : 'Configure your study session'}
            </p>
          </div>
        </div>
      </div>

      <div className="setup__content">
        <div className="setup__main">
          {!studySetId && (
            <div className="setup__section">
              <div className="setup__section-header">
                <div>
                  <h2 className="setup__section-title">Select Topics</h2>
                  <p className="setup__section-subtitle">Choose specific areas to focus on</p>
                </div>
                <div className="setup__topic-actions">
                  <button className="setup__topic-action" onClick={selectAllTopics}>
                    Select All
                  </button>
                  <button className="setup__topic-action" onClick={clearAllTopics}>
                    Clear All
                  </button>
                </div>
              </div>

              <div className="setup__topics">
                {topics.map((topic) => (
                  <label key={topic.id} className="setup__topic">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(topic.id)}
                      onChange={() => toggleTopic(topic.id)}
                      className="setup__topic-checkbox"
                    />
                    <span className="setup__checkbox" aria-hidden="true" />
                    <div className="setup__topic-content">
                      <div className="setup__topic-name">{topic.name}</div>
                      <div className="setup__topic-count">
                        {typeof topic.attempted_count === 'number' ? (
                          <>
                            {topic.attempted_count}/{topic.question_count} done{topic.remaining_count !== undefined ? ` • ${topic.remaining_count} left` : ''}
                          </>
                        ) : (
                          <>{topic.question_count} questions available</>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="setup__section">
            <h2 className="setup__section-title">Question Settings</h2>
            <p className="setup__section-subtitle">Customize your question experience</p>

            <div className="qs-grid">
              <div className="qs-col">
                <div className="setup__setting">
                  <label className="setup__setting-label">
                    Number of Questions
                  </label>
                  <div className="setup__qty">
                    <div className="qty__control">
                      <button className="qty__btn" disabled={isDisabled || numQuestions <= stepperMin} onClick={()=> setNumQuestions(Math.max(stepperMin, numQuestions - 1))}>−</button>
                      <input
                        type="number"
                        className="qty__input"
                        value={numQuestions}
                        min={stepperMin}
                        max={maxQuestions}
                        disabled={isDisabled}
                        onChange={(e)=>{
                          const v = parseInt(e.target.value || '0', 10)
                          if (Number.isNaN(v)) return
                          setNumQuestions(Math.max(stepperMin, Math.min(maxQuestions, v)))
                        }}
                      />
                      <button className="qty__btn" disabled={isDisabled || numQuestions >= maxQuestions} onClick={()=> setNumQuestions(Math.min(maxQuestions, numQuestions + 1))}>+</button>
                    </div>
                    <div className="qty__chips">
                      {[10,25,50,100,200].filter(n => n <= maxQuestions).map(n => (
                        <button key={n} className={`chip ${numQuestions===n ? 'is-active' : ''}`} disabled={isDisabled} onClick={()=> setNumQuestions(n)}>{n}</button>
                      ))}
                      <button className={`chip ${numQuestions===maxQuestions ? 'is-active' : ''}`} disabled={isDisabled} onClick={()=> setNumQuestions(maxQuestions)}>Max</button>
                    </div>
                  </div>
                  <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                    <label htmlFor="include-toggle" className="setup__toggle-label">Include previously answered</label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="include-toggle"
                        checked={includeAttempted}
                        onChange={(e) => {
                          const next = e.target.checked
                          setIncludeAttempted(next)
                          if (!studySetId) {
                            const total = topics
                              .filter(t => selectedTopics.has(t.id))
                              .reduce((sum, t) => sum + (next ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
                            if (total === 0) {
                              setNumQuestions(0)
                            } else if (numQuestions === 0 || numQuestions > total) {
                              setNumQuestions(total)
                            }
                          }
                        }}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="include-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeAttempted ? 'Include' : 'New only'}</span>
                  </div>
                 
                </div>
              </div>
              <div className="qs-col">
                <div className="setup__setting">
                  <div className="setup__toggle-row">
                    <label htmlFor="timer-toggle" className="setup__toggle-label">
                      Enable Timer
                    </label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="timer-toggle"
                        checked={timerEnabled}
                        onChange={(e) => setTimerEnabled(e.target.checked)}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="timer-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className={`setup__timer-inline ${!timerEnabled ? 'is-off' : ''}`}>
                      {timerEnabled ? `${timerMinutes} minutes` : 'Off'}
                    </span>
                  </div>
                  <div className={`setup__timer-setting ${!timerEnabled ? 'is-dim' : ''}`}>
                    <div className="setup__slider-wrapper">
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                        className={`setup__slider ${!timerEnabled ? 'setup__slider--disabled' : ''}`}
                        style={{'--progress': `${updateSliderProgress(timerMinutes, 10, 120)}%`}}
                        disabled={!timerEnabled}
                      />
                      <div className="setup__slider-labels-new">
                        <span className="setup__slider-label-left">10 mins</span>
                        <span className="setup__slider-label-right">120 mins</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="setup__sidebar">
          <div className="setup__summary">
            <h3 className="setup__summary-title">Session Summary</h3>
            
            <div className="setup__summary-item">
              <div className="setup__summary-label">Type:</div>
              <div className="setup__summary-value">{studySetId ? 'Study Set' : 'Specialty Practice'}</div>
            </div>
            
            {!studySetId && (
              <div className="setup__summary-item">
                <div className="setup__summary-label">Topics:</div>
                <div className="setup__summary-value">
                  {selectedTopics.size > 0 ? selectedTopics.size : 0}
                </div>
              </div>
            )}
            
            <div className="setup__summary-item">
              <div className="setup__summary-label">Questions:</div>
              <div className="setup__summary-value">{numQuestions}</div>
            </div>
            
            <div className="setup__summary-item">
              <div className="setup__summary-label">Time:</div>
              <div className="setup__summary-value">
                {timerEnabled ? `${timerMinutes} min` : 'No limit'}
              </div>
            </div>

            <div className="setup__summary-divider"></div>

            <button 
              className="setup__start-btn"
              onClick={startSession}
              disabled={isDisabled}
            >
              <LuPlay />
              Start Session
            </button>
           

          </div>
        </div>
       
      </div>
    </div>
  )
}
