import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import {
  LuArrowLeft, LuBookOpen, LuChevronRight, LuRotateCcw,
  LuThumbsUp, LuThumbsDown, LuZap, LuMinus, LuCheck,
  LuTrophy, LuLoader
} from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Flashcards.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// ─── Views ──────────────────────────────────────────────────
const VIEWS = { PICKER: 'picker', SESSION: 'session', SUMMARY: 'summary' }

// ─── Confidence config ───────────────────────────────────────
const CONFIDENCE = [
  { key: 'again', label: 'Again',  icon: LuRotateCcw, color: '#dc2626', bg: '#fee2e2', darkBg: 'rgba(239,68,68,.12)' },
  { key: 'hard',  label: 'Hard',   icon: LuThumbsDown, color: '#d97706', bg: '#fef3c7', darkBg: 'rgba(245,158,11,.12)' },
  { key: 'good',  label: 'Good',   icon: LuThumbsUp, color: '#16a34a', bg: '#dcfce7', darkBg: 'rgba(34,197,94,.12)' },
  { key: 'easy',  label: 'Easy',   icon: LuZap, color: '#7c3aed', bg: '#ede9fe', darkBg: 'rgba(124,58,237,.12)' },
]

// ─────────────────────────────────────────────────────────────
// Picker screen — choose specialty + topic
// ─────────────────────────────────────────────────────────────
function PickerScreen({ onStart }) {
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedSpecialty, setSelectedSpecialty] = useState(null)
  const [selectedTopic, setSelectedTopic] = useState(null)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    authenticatedFetch(`${API_BASE}/flashcards/topics`)
      .then(r => r.json())
      .then(d => setSpecialties(d.specialties || []))
      .catch(() => setError('Failed to load topics'))
      .finally(() => setLoading(false))
  }, [])

  const currentTopics = selectedSpecialty?.topics || []

  async function handleStart() {
    if (!selectedSpecialty) return
    setStarting(true)
    setError(null)
    try {
      const res = await authenticatedFetch(`${API_BASE}/flashcards/sessions`, {
        method: 'POST',
        body: JSON.stringify({
          specialty_id: selectedSpecialty.id,
          topic_id: selectedTopic?.id ?? undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start session')
      onStart(data.session, data.card_ids)
    } catch (e) {
      setError(e.message)
    } finally {
      setStarting(false)
    }
  }

  if (loading) return <LoadingScreen message="Loading flashcards..." inline />

  return (
    <div className="fc-picker">
      <div className="fc-picker__icon">🃏</div>
      <h2 className="fc-picker__title">Flashcard Session</h2>
      <p className="fc-picker__sub">Pick a specialty and topic to start testing yourself</p>

      {error && <div className="fc-error">{error}</div>}

      {specialties.length === 0 ? (
        <div className="fc-picker__empty">No flashcards published yet — check back soon!</div>
      ) : (
        <>
          {/* Specialty grid */}
          <div className="fc-picker__label">Specialty</div>
          <div className="fc-picker__specialties">
            {specialties.map(sp => (
              <button
                key={sp.id}
                id={`fc-specialty-${sp.id}`}
                className={`fc-picker__sp-btn ${selectedSpecialty?.id === sp.id ? 'fc-picker__sp-btn--active' : ''}`}
                onClick={() => { setSelectedSpecialty(sp); setSelectedTopic(null) }}
              >
                {sp.name}
              </button>
            ))}
          </div>

          {/* Topic list */}
          {selectedSpecialty && (
            <>
              <div className="fc-picker__label" style={{ marginTop: 24 }}>Topic <span className="fc-picker__opt">(optional — skip for all topics)</span></div>
              <div className="fc-picker__topics">
                <button
                  id="fc-topic-all"
                  className={`fc-picker__topic-row ${!selectedTopic ? 'fc-picker__topic-row--active' : ''}`}
                  onClick={() => setSelectedTopic(null)}
                >
                  <span>All topics in {selectedSpecialty.name}</span>
                  <span className="fc-picker__topic-count">{currentTopics.reduce((s, t) => s + t.card_count, 0)} cards</span>
                </button>
                {currentTopics.map(t => (
                  <button
                    key={t.id}
                    id={`fc-topic-${t.id}`}
                    className={`fc-picker__topic-row ${selectedTopic?.id === t.id ? 'fc-picker__topic-row--active' : ''}`}
                    onClick={() => setSelectedTopic(t)}
                  >
                    <span>{t.name}</span>
                    <span className="fc-picker__topic-count">{t.card_count} cards</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            id="fc-start-btn"
            className="fc-picker__start"
            disabled={!selectedSpecialty || starting}
            onClick={handleStart}
          >
            {starting ? <LuLoader size={18} className="fc-spinner" /> : <LuChevronRight size={18} />}
            {starting ? 'Starting…' : 'Start Session'}
          </button>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Card — the flip animation
// ─────────────────────────────────────────────────────────────
function FlashCard({ card, flipped, onFlip }) {
  return (
    <div
      id="fc-card"
      className={`fc-card ${flipped ? 'fc-card--flipped' : ''}`}
      onClick={!flipped ? onFlip : undefined}
    >
      {/* Front */}
      <div className="fc-card__face fc-card__face--front">
        <div className="fc-card__face-inner">
          <div className="fc-card__type-badge">{card.card_type}</div>
          <div className="fc-card__front-text">{card.front}</div>
          <button id="fc-reveal-btn" className="fc-card__reveal-btn" onClick={onFlip}>
            Tap to reveal answer
          </button>
        </div>
      </div>

      {/* Back */}
      <div className="fc-card__face fc-card__face--back">
        <div className="fc-card__face-inner">
          <div className="fc-card__back-text">{card.back}</div>

          {card.safety_check && (
            <div className="fc-card__callout fc-card__callout--safety">
              <span className="fc-card__callout-icon">⚠️</span>
              <div>
                <div className="fc-card__callout-label">Safety Check</div>
                <div className="fc-card__callout-text">{card.safety_check}</div>
              </div>
            </div>
          )}

          {card.exam_tip && (
            <div className="fc-card__callout fc-card__callout--tip">
              <span className="fc-card__callout-icon">💡</span>
              <div>
                <div className="fc-card__callout-label">Exam Tip</div>
                <div className="fc-card__callout-text">{card.exam_tip}</div>
              </div>
            </div>
          )}

          {card.mnemonics && (
            <div className="fc-card__callout fc-card__callout--mnemonic">
              <span className="fc-card__callout-icon">🧠</span>
              <div>
                <div className="fc-card__callout-label">Mnemonic</div>
                <div className="fc-card__callout-text">{card.mnemonics}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Session screen — plays through card_ids
// ─────────────────────────────────────────────────────────────
function SessionScreen({ session, cardIds, onComplete, onAbandon }) {
  const [cardIndex, setCardIndex]   = useState(0)
  const [card, setCard]             = useState(null)
  const [flipped, setFlipped]       = useState(false)
  const [loadingCard, setLoadingCard] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState(null)
  const [counters, setCounters]     = useState({ seen: 0, correct: 0 })
  const sessionId = session.id

  const loadCard = useCallback(async (idx) => {
    setLoadingCard(true)
    setFlipped(false)
    setError(null)
    try {
      const cardId = cardIds[idx]
      const res = await authenticatedFetch(`${API_BASE}/flashcards/sessions/${sessionId}/card/${cardId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load card')
      setCard(data.card)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingCard(false)
    }
  }, [sessionId, cardIds])

  useEffect(() => { loadCard(0) }, [loadCard])

  async function handleConfidence(confidence) {
    if (submitting || !card) return
    setSubmitting(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/flashcards/sessions/${sessionId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ flashcard_id: card.id, confidence }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to record response')

      setCounters({ seen: data.cards_seen, correct: data.cards_correct })

      if (data.session_complete) {
        onComplete(sessionId)
      } else {
        const next = cardIndex + 1
        setCardIndex(next)
        await loadCard(next)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const total    = cardIds.length
  const current  = cardIndex + 1
  const progress = (cardIndex / total) * 100

  return (
    <div className="fc-session">
      {/* Header */}
      <div className="fc-session__header">
        <button id="fc-abandon-btn" className="fc-session__abandon" onClick={onAbandon}>
          <LuArrowLeft size={16} /> Exit
        </button>
        <div className="fc-session__progress-wrap">
          <div className="fc-session__progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="fc-session__counter">{current}/{total}</div>
      </div>

      {/* Score strip */}
      <div className="fc-session__score-strip">
        <span>✅ {counters.correct} correct</span>
        <span>📋 {counters.seen} seen</span>
        <span>📚 {total - counters.seen} left</span>
      </div>

      {error && <div className="fc-error">{error}</div>}

      {/* Card */}
      {loadingCard ? (
        <div className="fc-card fc-card--loading">
          <LuLoader size={32} className="fc-spinner" />
        </div>
      ) : card ? (
        <FlashCard card={card} flipped={flipped} onFlip={() => setFlipped(true)} />
      ) : null}

      {/* Confidence buttons — only after reveal */}
      <div className={`fc-confidence ${flipped ? 'fc-confidence--visible' : ''}`}>
        <div className="fc-confidence__label">How well did you know this?</div>
        <div className="fc-confidence__btns">
          {CONFIDENCE.map(c => {
            const Icon = c.icon
            return (
              <button
                key={c.key}
                id={`fc-confidence-${c.key}`}
                className="fc-confidence__btn"
                style={{ '--fc-conf-color': c.color, '--fc-conf-bg': c.bg }}
                disabled={submitting || !flipped}
                onClick={() => handleConfidence(c.key)}
              >
                <Icon size={18} />
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Summary screen
// ─────────────────────────────────────────────────────────────
function SummaryScreen({ sessionId, onRestart, onExit }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    authenticatedFetch(`${API_BASE}/flashcards/sessions/${sessionId}/summary`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setSummary(d)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  if (loading) return <LoadingScreen message="Loading results…" inline />
  if (error)   return <div className="fc-error">{error}</div>
  if (!summary) return null

  const { session, confidence_breakdown: breakdown } = summary
  const pct = session.score_pct

  const grade =
    pct >= 80 ? { label: 'Excellent work!',    color: '#16a34a', emoji: '🏆' } :
    pct >= 60 ? { label: 'Good effort!',        color: '#d97706', emoji: '👍' } :
    pct >= 40 ? { label: 'Keep practising!',    color: '#ea580c', emoji: '💪' } :
                { label: 'More revision needed', color: '#dc2626', emoji: '📖' }

  // Duration
  const durationSec = session.started_at && session.completed_at
    ? Math.round((new Date(session.completed_at) - new Date(session.started_at)) / 1000)
    : null
  const durationStr = durationSec
    ? durationSec >= 60
      ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
      : `${durationSec}s`
    : null

  const topicLabel = session.topic?.name || `All of ${session.specialty?.name || 'selected specialty'}`

  return (
    <div className="fc-summary">
      {/* Header */}
      <div className="fc-summary__header">
        <div className="fc-summary__trophy">{grade.emoji}</div>
        <h2 className="fc-summary__title" style={{ color: grade.color }}>{grade.label}</h2>
        <p className="fc-summary__topic">{topicLabel}</p>
      </div>

      {/* Score ring */}
      <div className="fc-summary__score">
        <svg viewBox="0 0 120 120" className="fc-summary__ring">
          <circle cx="60" cy="60" r="50" fill="none" stroke="var(--syn-border)" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="50" fill="none"
            stroke={grade.color} strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="fc-summary__score-inner">
          <div className="fc-summary__pct" style={{ color: grade.color }}>{pct}%</div>
          <div className="fc-summary__pct-label">Score</div>
        </div>
      </div>

      {/* Stats row */}
      <div className="fc-summary__stats">
        <div className="fc-summary__stat">
          <div className="fc-summary__stat-value">{session.cards_correct}</div>
          <div className="fc-summary__stat-label">Correct</div>
        </div>
        <div className="fc-summary__stat-divider" />
        <div className="fc-summary__stat">
          <div className="fc-summary__stat-value">{session.total_cards}</div>
          <div className="fc-summary__stat-label">Total cards</div>
        </div>
        {durationStr && (
          <>
            <div className="fc-summary__stat-divider" />
            <div className="fc-summary__stat">
              <div className="fc-summary__stat-value">{durationStr}</div>
              <div className="fc-summary__stat-label">Duration</div>
            </div>
          </>
        )}
      </div>

      {/* Confidence breakdown */}
      <div className="fc-summary__breakdown-wrap">
        <div className="fc-summary__breakdown-title">How you rated each card</div>
        <div className="fc-summary__breakdown">
          {CONFIDENCE.map(c => (
            <div
              key={c.key}
              className="fc-summary__bd-item"
              style={{ '--fc-conf-color': c.color, '--fc-conf-bg': c.bg }}
            >
              <div className="fc-summary__bd-count">{breakdown[c.key] ?? 0}</div>
              <div className="fc-summary__bd-label">{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="fc-summary__actions">
        <button
          id="fc-new-session-btn"
          className="fc-summary__btn fc-summary__btn--primary"
          onClick={onRestart}
        >
          <LuRotateCcw size={18} />
          New Session
        </button>
        <button
          id="fc-exit-btn"
          className="fc-summary__btn fc-summary__btn--secondary"
          onClick={onExit}
        >
          <LuArrowLeft size={18} />
          Back to OSCE
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Root component
// ─────────────────────────────────────────────────────────────
export default function Flashcards() {
  const navigate = useNavigate()
  const [view, setView]         = useState(VIEWS.PICKER)
  const [session, setSession]   = useState(null)
  const [cardIds, setCardIds]   = useState([])
  const [doneId, setDoneId]     = useState(null)

  function handleStart(sess, ids) {
    setSession(sess)
    setCardIds(ids)
    setView(VIEWS.SESSION)
  }

  async function handleAbandon() {
    if (session) {
      await authenticatedFetch(`${API_BASE}/flashcards/sessions/${session.id}/abandon`, { method: 'PATCH' })
        .catch(() => {})
    }
    setView(VIEWS.PICKER)
    setSession(null)
    setCardIds([])
  }

  function handleComplete(sessionId) {
    setDoneId(sessionId)
    setView(VIEWS.SUMMARY)
  }

  function handleRestart() {
    setView(VIEWS.PICKER)
    setSession(null)
    setCardIds([])
    setDoneId(null)
  }

  return (
    <div className="fc-page">
      {/* Back to OSCE page */}
      <button id="fc-back-btn" className="fc-page__back" onClick={() => navigate('/dashboard/osce')}>
        <LuArrowLeft size={16} /> OSCE Stations
      </button>

      <div className="fc-page__card">
        {view === VIEWS.PICKER  && <PickerScreen onStart={handleStart} />}
        {view === VIEWS.SESSION && session && (
          <SessionScreen
            session={session}
            cardIds={cardIds}
            onComplete={handleComplete}
            onAbandon={handleAbandon}
          />
        )}
        {view === VIEWS.SUMMARY && doneId && (
          <SummaryScreen
            sessionId={doneId}
            onRestart={handleRestart}
            onExit={() => navigate('/dashboard/osce')}
          />
        )}
      </div>
    </div>
  )
}
