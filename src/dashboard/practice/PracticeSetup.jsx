import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuPlay } from 'react-icons/lu'
import './PracticeSetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'

export default function PracticeSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const specialtyId = searchParams.get('specialty_id')
  const specialtyName = searchParams.get('specialty_name') || 'Unknown Specialty'
  
  const [loading, setLoading] = useState(true)
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [numQuestions, setNumQuestions] = useState(25)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [timerEnabled, setTimerEnabled] = useState(false)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    if (!specialtyId) {
      navigate('/dashboard/question-bank')
      return
    }
    loadTopics()
  }, [specialtyId])

  const loadTopics = async () => {
    try {
      const res = await fetch(`${API_BASE}/qbank/specialty/${specialtyId}/topics`, {
        credentials: 'include'
      })
      if (!res.ok) throw new Error('Failed to load topics')
      const data = await res.json()
      setTopics(data.topics || [])
      
      // Select all topics by default
      const allTopicIds = new Set(data.topics?.map(t => t.id) || [])
      setSelectedTopics(allTopicIds)
      
      // Set default question count to max available
      const totalAvailable = (data.topics || []).reduce((sum, t) => sum + t.question_count, 0)
      if (totalAvailable > 0) {
        setNumQuestions(Math.min(totalAvailable, 290))
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
      .reduce((sum, t) => sum + t.question_count, 0)
    
    if (newTotalAvailable === 0) {
      setNumQuestions(0)
    } else if (numQuestions === 0 || numQuestions > newTotalAvailable) {
      setNumQuestions(Math.min(newTotalAvailable, 290))
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
    return topics
      .filter(t => selectedTopics.has(t.id))
      .reduce((sum, t) => sum + t.question_count, 0)
  }

  const getSliderMin = () => {
    const total = getTotalQuestions()
    return total > 0 ? 1 : 0
  }

  const getSelectedTopicNames = () => {
    return topics
      .filter(t => selectedTopics.has(t.id))
      .map(t => t.name)
      .join(', ')
  }

  const startSession = () => {
    if (selectedTopics.size === 0) {
      alert('Please select at least one topic')
      return
    }

    const params = new URLSearchParams({
      specialty_id: specialtyId,
      topic_ids: Array.from(selectedTopics).join(','),
      num_questions: numQuestions.toString(),
      timer_minutes: timerEnabled ? timerMinutes.toString() : '0'
    })
    
    navigate(`/dashboard/question-bank/practice?${params.toString()}`)
  }

  if (loading) {
    return <LoadingScreen message="Loading practice setup..." />
  }

  const totalAvailable = getTotalQuestions()
  const maxQuestions = Math.min(totalAvailable, 290)
  const sliderMin = getSliderMin()
  const isSliderDisabled = totalAvailable === 0

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
            <h1 className="setup__title">{specialtyName} Practice Setup</h1>
            <p className="setup__subtitle">Configure your study session</p>
          </div>
        </div>
      </div>

      <div className="setup__content">
        <div className="setup__main">
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
                  <div className="setup__topic-content">
                    <div className="setup__topic-name">{topic.name}</div>
                    <div className="setup__topic-count">{topic.question_count} questions available</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="setup__section">
            <h2 className="setup__section-title">Question Settings</h2>
            <p className="setup__section-subtitle">Customize your question experience</p>

            <div className="setup__setting">
              <label className="setup__setting-label">
                Number of Questions
                <span className="setup__setting-info">{numQuestions} of {totalAvailable} available</span>
              </label>
              <div className="setup__slider-wrapper">
                <input
                  type="range"
                  min={sliderMin}
                  max={Math.max(sliderMin, maxQuestions)}
                  value={numQuestions}
                  onChange={(e) => setNumQuestions(parseInt(e.target.value))}
                  className={`setup__slider ${isSliderDisabled ? 'setup__slider--disabled' : ''}`}
                  style={{'--progress': `${updateSliderProgress(numQuestions, sliderMin, Math.max(sliderMin, maxQuestions))}%`}}
                  disabled={isSliderDisabled}
                />
                <div className="setup__slider-labels-new">
                  <span className="setup__slider-label-left">{sliderMin}</span>
                  <span className="setup__slider-label-right">{maxQuestions}</span>
                </div>
              </div>
            </div>

            <div className="setup__setting">
              <div className="setup__toggle-row">
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
                <label htmlFor="timer-toggle" className="setup__toggle-label">
                  Enable Timer
                </label>
              </div>
              
              {timerEnabled && (
                <div className="setup__timer-setting">
                  <label className="setup__setting-label">
                    Session Timer
                    <span className="setup__setting-info">{timerMinutes} minutes</span>
                  </label>
                  <div className="setup__slider-wrapper">
                    <input
                      type="range"
                      min="10"
                      max="120"
                      step="5"
                      value={timerMinutes}
                      onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                      className="setup__slider"
                      style={{'--progress': `${updateSliderProgress(timerMinutes, 10, 120)}%`}}
                    />
                    <div className="setup__slider-labels-new">
                      <span className="setup__slider-label-left">10 mins</span>
                      <span className="setup__slider-label-right">120 mins</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="setup__sidebar">
          <div className="setup__summary">
            <h3 className="setup__summary-title">Session Summary</h3>
            
            <div className="setup__summary-item">
              <div className="setup__summary-label">Specialty:</div>
              <div className="setup__summary-value">{specialtyName}</div>
            </div>
            
            <div className="setup__summary-item">
              <div className="setup__summary-label">Topics:</div>
              <div className="setup__summary-value">
                {selectedTopics.size > 0 ? selectedTopics.size : 0}
              </div>
            </div>
            
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
              disabled={selectedTopics.size === 0}
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
