import React, { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './PracticeResults.css'
import './PracticeSetup.css'
import { LuChevronLeft, LuArrowRight } from 'react-icons/lu'

function useResultsData() {
  const location = useLocation()
  const state = location.state || {}
  return state
}

export default function PracticeResults() {
  const navigate = useNavigate()
  const { specialtyName, totalQuestions = 0, correct = 0, skipped = 0, totalMs = 0, perQuestionMs } = useResultsData()

  const incorrect = Math.max(totalQuestions - correct - (skipped || 0), 0)
  const accuracyPct = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0
  const totalTimeMin = Math.round((totalMs / 1000) / 60)
  const avgTimeMs = perQuestionMs || (totalQuestions ? totalMs / totalQuestions : 0)
  const avgTimeSec = Math.round((avgTimeMs || 0) / 1000)

  const scoreTheme = accuracyPct >= 80 ? 'good' : accuracyPct >= 60 ? 'ok' : 'poor'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  return (
    <div className="prr">
      <div className="prr__top">
        <button className="setup__back" onClick={() => navigate('/dashboard/question-bank')}>
          <LuChevronLeft /> Back to Question Bank
        </button>
      </div>

      <div className="prr-hero card">
        <div className="prr-hero__left">
          <div className={`score-ring score-ring--${scoreTheme}`} style={{
            ['--pct']: `${accuracyPct}%`
          }} aria-label={`Accuracy ${accuracyPct}%`}>
            <div className="score-ring__inner">
              <div className="score-ring__value">{accuracyPct}%</div>
              <div className="score-ring__label">Accuracy</div>
            </div>
          </div>
          <div className="prr-hero__meta">
            <h1 className="prr__title">Session Complete</h1>
            {specialtyName && <div className="prr__subtitle">{specialtyName} • Practice</div>}
          </div>
        </div>
        <div className="prr-hero__right">
          <div className="kpi">
            <div className="kpi__value kpi__value--green">{correct}</div>
            <div className="kpi__label">Correct</div>
          </div>
          <div className="kpi">
            <div className="kpi__value kpi__value--red">{incorrect}</div>
            <div className="kpi__label">Incorrect</div>
          </div>
          <div className="kpi">
            <div className="kpi__value kpi__value--muted">{skipped}</div>
            <div className="kpi__label">Skipped</div>
          </div>
          <div className="kpi">
            <div className="kpi__value">{totalQuestions}</div>
            <div className="kpi__label">Total</div>
          </div>
        </div>
      </div>

      <div className="prr__grid prr__grid--top">
        <div className="card prr-card">
          <div className="card__header">Performance Highlights</div>
          <div className="card__body prr-card__body">
            <ul className="highlights">
              <li><span className="dot dot--green" /> You answered {correct} correctly</li>
              <li><span className="dot dot--blue" /> Accuracy at {accuracyPct}%</li>
              <li><span className="dot dot--amber" /> {skipped} skipped questions</li>
            </ul>
            <div className="prr-bar"><div className="prr-fill" style={{ width: `${accuracyPct}%` }} /></div>
          </div>
        </div>

        <div className="card prr-card">
          <div className="card__header">Time Analysis</div>
          <div className="card__body prr-card__body">
            <div className="time-grid">
              <div>
                <div className="time__value">{totalTimeMin}m</div>
                <div className="time__label">Total time</div>
              </div>
              <div>
                <div className="time__value">{isNaN(avgTimeSec) ? 0 : avgTimeSec}s</div>
                <div className="time__label">Average per question</div>
              </div>
            </div>
            <div className={`prr-badge ${avgTimeSec <= 90 ? 'prr-badge--green' : 'prr-badge--amber'}`}>
              {avgTimeSec <= 90 ? 'Within optimal range' : 'Consider pacing slightly faster'}
            </div>
          </div>
        </div>
      </div>

      <div className="prr__grid">
        <div className="card">
          <div className="card__header">Next Actions</div>
          <div className="card__body next-steps">
            <button className="btn btn--primary btn--icon" onClick={() => navigate('/dashboard/question-bank')}>
              Start another set <LuArrowRight />
            </button>
            <button className="btn btn--ghost" onClick={() => navigate('/dashboard/textbook')}>
              Review textbook topics
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


