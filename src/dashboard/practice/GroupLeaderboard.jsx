import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LuChevronLeft, LuTrophy, LuMedal, LuAward, LuUsers } from 'react-icons/lu'
import './PracticeResults.css'
import './GroupLeaderboard.css'
import { useOutletContext } from 'react-router-dom'

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
      </div>
    </div>
  )
}

