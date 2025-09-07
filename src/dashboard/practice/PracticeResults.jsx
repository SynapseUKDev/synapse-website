import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './PracticeResults.css'
import { LuChevronLeft, LuShare2 } from 'react-icons/lu'

function useResultsData() {
  const location = useLocation()
  const state = location.state || {}
  return state
}

export default function PracticeResults() {
  const navigate = useNavigate()
  const { specialtyName, totalQuestions, correct, skipped, totalMs, perQuestionMs } = useResultsData()

  const accuracyPct = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0
  const totalTimeMin = Math.round((totalMs / 1000) / 60)
  const avgTimeSec = Math.round((perQuestionMs || (totalQuestions ? totalMs / totalQuestions : 0)) / 1000)

  return (
    <div className="prr">
      <div className="prr__top">
        <button className="btn btn--ghost btn--icon" onClick={() => navigate('/dashboard/question-bank')}>
          <LuChevronLeft /> Back to Question Bank
        </button>
        <div className="prr__actions">
          <button className="btn btn--ghost btn--icon"><LuShare2 /> Share Results</button>
        </div>
      </div>

      <h1 className="prr__title">Session Complete!</h1>
      {specialtyName && <div className="prr__subtitle">{specialtyName} • Practice</div>}

      <div className="prr__grid prr__grid--top">
        <div className="card prr-card">
          <div className="card__header">Overall Score</div>
          <div className="card__body prr-card__body">
            <div className="prr-score">{accuracyPct}%</div>
            <div className="prr-sub">{correct}/{totalQuestions} correct</div>
            <div className="prr-bar"><div className="prr-fill" style={{ width: `${accuracyPct}%` }} /></div>
          </div>
        </div>

        <div className="card prr-card">
          <div className="card__header">Time Performance</div>
          <div className="card__body prr-card__body">
            <div className="prr-time">{totalTimeMin}m</div>
            <div className="prr-sub">Avg: {isNaN(avgTimeSec) ? 0 : avgTimeSec}s per question</div>
            <div className="prr-badge prr-badge--green">Within optimal range</div>
          </div>
        </div>
      </div>

      <div className="prr__grid">
        <div className="card">
          <div className="card__header">Performance Summary</div>
          <div className="card__body prr-summary">
            <div className="prr-summary__item prr-summary__item--green">
              <div className="prr-summary__big">{correct}</div>
              <div className="prr-summary__label">Correct</div>
            </div>
            <div className="prr-summary__item prr-summary__item--red">
              <div className="prr-summary__big">{Math.max(totalQuestions - correct - (skipped || 0), 0)}</div>
              <div className="prr-summary__label">Incorrect</div>
            </div>
            <div className="prr-summary__item">
              <div className="prr-summary__big">{skipped || 0}</div>
              <div className="prr-summary__label">Skipped</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


