import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LuChevronLeft, LuTrophy, LuMedal, LuAward, LuUsers, LuArrowLeft, LuArrowRight, LuBookOpen, LuCircleCheck, LuCircleAlert } from 'react-icons/lu'
import './PracticeResults.css'
import './GroupLeaderboard.css'
import './Practice.css'
import { useOutletContext } from 'react-router-dom'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'
import LoadingScreen from '../../components/loading/LoadingScreen'

function useLeaderboardData() {
  const location = useLocation()
  const state = location.state || {}
  return state
}

export default function GroupLeaderboard() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const { 
    room_code,
    session_id,
    total_questions = 0,
    scores = []
  } = useLeaderboardData()

  // Review mode state
  const [reviewMode, setReviewMode] = useState(false)
  const [reviewQuestions, setReviewQuestions] = useState([])
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [loadingReview, setLoadingReview] = useState(false)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Sort scores by accuracy (descending), then by correct count
  const rankedScores = [...(scores || [])].sort((a, b) => {
    if (b.accuracy !== a.accuracy) {
      return b.accuracy - a.accuracy
    }
    return b.correct - a.correct
  })

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const loadReviewData = async () => {
    if (!session_id) {
      alert('Session ID not available')
      return
    }

    setLoadingReview(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/group-session/${session_id}/review`, {
        credentials: 'include',
        headers: authHeaders()
      })

      if (!res.ok) {
        throw new Error('Failed to load review data')
      }

      const data = await res.json()
      setReviewQuestions(data.questions || [])
      setCurrentReviewIndex(0)
      setReviewMode(true)
    } catch (error) {
      console.error('Error loading review data:', error)
      alert('Failed to load review data')
    } finally {
      setLoadingReview(false)
    }
  }

  const getRankIcon = (index) => {
    if (index === 0) return <LuTrophy size={24} style={{ color: '#fbbf24' }} />
    if (index === 1) return <LuMedal size={24} style={{ color: '#94a3b8' }} />
    if (index === 2) return <LuAward size={24} style={{ color: '#d97706' }} />
    return null
  }

  const getRankColor = (index) => {
    if (index === 0) return '#fbbf24' // Gold
    if (index === 1) return '#94a3b8' // Silver
    if (index === 2) return '#d97706' // Bronze
    return '#64748b' // Gray
  }

  if (loadingReview) {
    return (
      <div className="group-leaderboard">
        <LoadingScreen message="Loading review data..." />
      </div>
    )
  }

  // Review mode view
  if (reviewMode && reviewQuestions.length > 0) {
    const currentQuestion = reviewQuestions[currentReviewIndex]
    const isFirst = currentReviewIndex === 0
    const isLast = currentReviewIndex === reviewQuestions.length - 1

    return (
      <div className="pr">
        <div className="pr__top">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <h2 style={{ margin: 0 }}>Session Review</h2>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 12px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                color: '#fff',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700
              }}>
                <LuUsers size={14} />
                Group Session
              </div>
            </div>
            <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
                color: '#fff',
                fontWeight: 800,
                fontSize: 18
              }}>
                {currentReviewIndex + 1}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>Question {currentReviewIndex + 1} of {reviewQuestions.length}</span>
                </div>
                {room_code && <div style={{ fontSize: 12 }}>Room: {room_code}</div>}
              </div>
            </div>
          </div>
          <div className="pr__top-right" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn btn--ghost"
              onClick={() => setReviewMode(false)}
            >
              <LuChevronLeft /> Back to Leaderboard
            </button>
          </div>
        </div>

        <div className="pr__body">
          <div className="card">
            <div className="card__body">
              <div className="question-stem">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw]}
                >
                  {currentQuestion.stem || ''}
                </ReactMarkdown>
              </div>

              {currentQuestion.options?.length > 0 && (
                <div style={{ display: 'grid', gap: 8, marginTop: 24 }}>
                  {currentQuestion.options.map((o) => {
                    const isCorrect = currentQuestion.correct_answer === o.id
                    const answersForOption = (currentQuestion.answers || []).filter(a => a.answer === o.id)
                    
                    return (
                      <div key={o.id} className="option-wrapper">
                        <label className={`option ${isCorrect ? 'option--correct' : ''}`}>
                          <div className="option__label">{o.label}.</div>
                          <div className="option__body">{o.body}</div>
                        </label>
                        {answersForOption.length > 0 && (
                          <div style={{
                            marginTop: 8,
                            padding: 8,
                            background: isCorrect ? '#dcfce7' : '#fef3c7',
                            borderRadius: 6,
                            fontSize: 13
                          }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: isCorrect ? '#166534' : '#92400e' }}>
                              {answersForOption.length} {answersForOption.length === 1 ? 'person' : 'people'} chose {o.label}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {answersForOption.map((a) => (
                                <span
                                  key={a.user_id}
                                  style={{
                                    padding: '4px 8px',
                                    background: a.is_correct ? '#22c55e' : '#f59e0b',
                                    color: '#fff',
                                    borderRadius: 4,
                                    fontSize: 12,
                                    fontWeight: 600
                                  }}
                                >
                                  {a.username}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {currentQuestion.explanations && (
                <div className="card explanation-card" style={{ marginTop: 24 }}>
                  <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="ex-card__status ex-card__status--info">
                      <LuBookOpen />
                      Explanation
                    </div>
                  </div>
                  <div className="card__body explain">
                    {currentQuestion.explanations.detailed && (
                      <div>
                        <div className="explain__section">
                          <div className="explain__label">Detailed Explanation:</div>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                          >
                            {currentQuestion.explanations.detailed}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                    {currentQuestion.explanations.eli5 && (
                      <div style={{ marginTop: 16 }}>
                        <div className="explain__section">
                          <div className="explain__label">ELI5 (Explain Like I'm 5):</div>
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                          >
                            {currentQuestion.explanations.eli5}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pr__bottom">
          <div className="controls">
            <div className="controls__left">
              <button
                className="btn btn--ghost btn--icon"
                onClick={() => setCurrentReviewIndex(prev => Math.max(0, prev - 1))}
                disabled={isFirst}
                style={{ opacity: isFirst ? 0.5 : 1 }}
              >
                <LuArrowLeft size={18} />
                Previous
              </button>
            </div>
            <div className="controls__right">
              <button
                className="btn btn--primary"
                onClick={() => setCurrentReviewIndex(prev => Math.min(reviewQuestions.length - 1, prev + 1))}
                disabled={isLast}
                style={{ 
                  opacity: isLast ? 0.5 : 1, 
                  minWidth: '90px', 
                  paddingLeft: '16px', 
                  paddingRight: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <span>Next</span>
                <LuArrowRight size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!scores || scores.length === 0) {
    return (
      <div className="group-leaderboard">
        <div className="group-leaderboard__header">
          <button className="setup__back" onClick={() => navigate('/dashboard/question-bank')}>
            <LuChevronLeft /> Back to Question Bank
          </button>
        </div>
        <div className="card" style={{ padding: 48, textAlign: 'center' }}>
          <p>No scores available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="group-leaderboard">
      <div className="group-leaderboard__header">
        <button className="setup__back" onClick={() => navigate('/dashboard/question-bank')}>
          <LuChevronLeft /> Back to Question Bank
        </button>
      </div>

      <div className="group-leaderboard__hero card">
        <div className="group-leaderboard__hero-content">
          <div className="group-leaderboard__icon">
            <LuUsers size={32} />
          </div>
          <div>
            <h1 className="group-leaderboard__title">Session Complete!</h1>
            <p className="group-leaderboard__subtitle">
              Room: {room_code} • {total_questions} Questions
            </p>
          </div>
        </div>
      </div>

      <div className="group-leaderboard__content">
        <div className="card group-leaderboard__card">
          <div className="card__header">
            <h2>Leaderboard</h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
              Ranked by accuracy and correct answers
            </p>
          </div>
          <div className="card__body">
            <div className="leaderboard-list">
              {rankedScores.map((score, index) => {
                const isCurrentUser = score.user_id === user.id
                const rank = index + 1
                const rankIcon = getRankIcon(index)
                const rankColor = getRankColor(index)
                
                return (
                  <div 
                    key={score.user_id} 
                    className={`leaderboard-item ${isCurrentUser ? 'leaderboard-item--you' : ''}`}
                  >
                    <div className="leaderboard-item__rank">
                      {rankIcon || (
                        <div 
                          className="leaderboard-item__rank-number"
                          style={{ color: rankColor }}
                        >
                          {rank}
                        </div>
                      )}
                    </div>
                    
                    <div className="leaderboard-item__info">
                      <div className="leaderboard-item__name">
                        {score.username || 'Anonymous'}
                        {isCurrentUser && (
                          <span className="leaderboard-item__badge">You</span>
                        )}
                      </div>
                      <div className="leaderboard-item__stats">
                        <span className="leaderboard-item__stat">
                          {score.correct} correct
                        </span>
                        <span className="leaderboard-item__stat-divider">•</span>
                        <span className="leaderboard-item__stat">
                          {score.total} answered
                        </span>
                      </div>
                    </div>
                    
                    <div className="leaderboard-item__score">
                      <div 
                        className="leaderboard-item__percentage"
                        style={{ 
                          color: score.accuracy >= 80 ? '#22c55e' : 
                                 score.accuracy >= 60 ? '#f59e0b' : 
                                 '#ef4444'
                        }}
                      >
                        {score.accuracy}%
                      </div>
                      <div className="leaderboard-item__label">Accuracy</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card group-leaderboard__stats-card">
          <div className="card__header">Session Statistics</div>
          <div className="card__body">
            <div className="leaderboard-stats">
              <div className="leaderboard-stat">
                <div className="leaderboard-stat__label">Total Questions</div>
                <div className="leaderboard-stat__value">{total_questions}</div>
              </div>
              <div className="leaderboard-stat">
                <div className="leaderboard-stat__label">Participants</div>
                <div className="leaderboard-stat__value">{scores.length}</div>
              </div>
              <div className="leaderboard-stat">
                <div className="leaderboard-stat__label">Average Accuracy</div>
                <div className="leaderboard-stat__value">
                  {scores.length > 0 
                    ? Math.round(scores.reduce((sum, s) => sum + s.accuracy, 0) / scores.length)
                    : 0}%
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <div className="card__body" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Review Session</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>Review all questions and answers</div>
              </div>
              <button
                className="btn btn--primary"
                onClick={loadReviewData}
                disabled={loadingReview || !session_id}
                style={{ flexShrink: 0 }}
              >
                Review Questions
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

