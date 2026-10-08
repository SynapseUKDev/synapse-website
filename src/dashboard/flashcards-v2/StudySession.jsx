import { useCallback, useEffect, useRef, useState } from 'react'
import { LuX } from 'react-icons/lu'
import StudyCard from './StudyCard'
import SaveStatus from './SaveStatus'
import SessionSummary from './SessionSummary'
import ReportProblemDialog from './ReportProblemDialog'
import { fetchCurrentCard } from './flashcardsV2Api'
import { applyRating, createQueue, currentCard, progressOf, removeCard, replaceCard } from './sessionQueue'
import { useReviewSaves } from './useReviewSaves'

// One study session: reveal → Hard/Good/Easy → save (in the background, visibly) → next card.
//
// Keyboard: Space or Enter reveals; once revealed 1 = Hard, 2 = Good, 3 = Easy. Keys are ignored while
// typing in a field, with modifier keys held, and (for Space/Enter) while a control has focus, so the
// browser's own button activation is never doubled.
//
// "Report a problem" is offered on the revealed card only (never on the front, where it could hint at
// the answer). While its modal is open every study shortcut is off.

const RATINGS = [
  { key: '1', confidence: 'hard', label: 'Hard' },
  { key: '2', confidence: 'good', label: 'Good' },
  { key: '3', confidence: 'easy', label: 'Easy' },
]
const BY_KEY = Object.fromEntries(RATINGS.map((r) => [r.key, r.confidence]))

const REPORT_NOTICES = {
  sent: 'Thanks — your report was sent. Our clinical team will review this card.',
  stale: 'This card was just updated — thanks, the new version is now shown.',
  gone: 'This card is no longer available, so it has been removed from this session. Thanks for reporting.',
}

function isTyping(el) {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function isControl(el) {
  if (!el?.closest) return false
  return !!el.closest('button, a[href], summary, [role="button"], [role="tab"], [role="checkbox"]')
}

export default function StudySession({ cards, preview = false, showAdminBadge = false, onExit, onComplete, exitGuardRef }) {
  const [queue, setQueue] = useState(() => createQueue(cards))
  // Revealed is tied to one card at one content version, so a card that is swapped or refreshed
  // underneath (409 refetch, removal) never shows its answer unasked.
  const [revealedKey, setRevealedKey] = useState(null)
  const [ended, setEnded] = useState(false)
  const [reporting, setReporting] = useState(null) // the card being reported, while the modal is open
  const [reportNotice, setReportNotice] = useState('')
  const [staleRetry, setStaleRetry] = useState(null) // the reported card whose refetch failed
  const answerRef = useRef(null)
  const revealRef = useRef(null)
  const reportRef = useRef(null)

  const onCardChanged = useCallback((card) => setQueue((q) => replaceCard(q, card)), [])
  const onCardGone = useCallback((id) => setQueue((q) => removeCard(q, id)), [])
  const saves = useReviewSaves({ preview, onCardChanged, onCardGone })
  const { submit } = saves

  // The page-level back button asks this first: with a rating still saving or failed, the session is
  // routed to its summary (which lists and guards them) instead of being silently dropped.
  useEffect(() => {
    if (!exitGuardRef) return undefined
    exitGuardRef.current = () => {
      if (saves.counts.pending > 0 || saves.counts.failed > 0) {
        setEnded(true)
        return true
      }
      return false
    }
    return () => {
      exitGuardRef.current = null
    }
  }, [exitGuardRef, saves.counts.pending, saves.counts.failed])

  const card = currentCard(queue)
  const progress = progressOf(queue)
  const finished = ended || !card
  const cardKey = card ? `${card.id}:${card.contentVersion}` : null

  // "Completed" means the learner worked through the whole deck (not ended early); reported once.
  const completedRef = useRef(false)
  useEffect(() => {
    if (card || completedRef.current) return
    completedRef.current = true
    onComplete?.(progress)
  }, [card, onComplete, progress])
  const revealed = cardKey !== null && revealedKey === cardKey

  const reveal = useCallback(() => setRevealedKey(cardKey), [cardKey])
  const rate = useCallback(
    (confidence) => {
      if (!card || !revealed) return
      submit(card, confidence)
      setQueue((q) => applyRating(q, confidence))
      setRevealedKey(null)
      setReportNotice('')
      setStaleRetry(null)
    },
    [card, revealed, submit],
  )

  // After a 409 the current version is fetched; "the new version is now shown" appears only once it is.
  const refreshStale = useCallback(
    async (reported) => {
      setStaleRetry(null)
      setReportNotice('')
      let fresh = null
      try {
        fresh = await fetchCurrentCard(reported, { preview })
      } catch (error) {
        console.warn('Flashcards V2: refetch after a stale report failed', error?.name, error?.message)
        setStaleRetry(reported)
        return
      }
      if (fresh) {
        onCardChanged(fresh) // starts unrevealed: the reveal is tied to the version
        setReportNotice(REPORT_NOTICES.stale)
      } else {
        onCardGone(reported.id)
        setReportNotice(REPORT_NOTICES.gone)
      }
    },
    [preview, onCardChanged, onCardGone],
  )

  const onReportDone = useCallback(
    (outcome) => {
      const reported = reporting
      setReporting(null)
      if (!reported) return
      if (outcome === 'stale') {
        refreshStale(reported)
        return
      }
      setReportNotice(REPORT_NOTICES[outcome] ?? '')
      if (outcome === 'gone') onCardGone(reported.id)
    },
    [reporting, refreshStale, onCardGone],
  )

  useEffect(() => {
    if (finished || reporting) return undefined
    function onKeyDown(e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        if (isControl(e.target)) return
        e.preventDefault()
        reveal()
      } else if (revealed && BY_KEY[e.key]) {
        e.preventDefault()
        rate(BY_KEY[e.key])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [finished, reporting, revealed, reveal, rate])

  // Focus follows the flow: the answer when revealed, the reveal control for each new card.
  useEffect(() => {
    if (finished) return
    if (revealed) answerRef.current?.focus()
    else revealRef.current?.focus()
  }, [cardKey, revealed, finished])

  if (finished) {
    return <SessionSummary complete={!card} progress={progress} saves={saves} onFinish={onExit} />
  }

  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="fc2-session">
      <div className="fc2-session__header">
        <button type="button" className="fc2-icon-btn" onClick={() => setEnded(true)} aria-label="End session">
          <LuX size={18} aria-hidden="true" />
        </button>
        <div className="fc2-progress" aria-hidden="true">
          <div className="fc2-progress__bar" style={{ width: `${pct}%` }} />
        </div>
        <p className="fc2-progress__text" aria-live="polite">
          {progress.done} of {progress.total} cards done
        </p>
      </div>

      <StudyCard card={card} revealed={revealed} showAdminBadge={showAdminBadge} answerRef={answerRef} />

      {!revealed ? (
        <div className="fc2-actions">
          <button type="button" ref={revealRef} className="fc2-btn fc2-btn--primary fc2-btn--wide" onClick={reveal}>
            Show answer <kbd>Space</kbd>
          </button>
        </div>
      ) : (
        <div className="fc2-rating" role="group" aria-labelledby="fc2-rating-prompt">
          <p id="fc2-rating-prompt" className="fc2-rating__prompt">
            How well did you know this?
          </p>
          <div className="fc2-rating__btns">
            {RATINGS.map((r) => (
              <button
                key={r.confidence}
                type="button"
                className={`fc2-rating__btn fc2-rating__btn--${r.confidence}`}
                onClick={() => rate(r.confidence)}
              >
                {r.label} <kbd>{r.key}</kbd>
              </button>
            ))}
          </div>
          {/* Admin preview drafts (isPublished false) cannot be reported: only live cards take reports. */}
          {card.isPublished !== false && (
            <div className="fc2-report-trigger">
              <button type="button" ref={reportRef} onClick={() => setReporting(card)}>
                Report a problem
              </button>
            </div>
          )}
        </div>
      )}

      {staleRetry && (
        <div role="alert" className="fc2-report-notice">
          This card was just updated, but the new version could not be loaded.{' '}
          <button type="button" className="fc2-btn" onClick={() => refreshStale(staleRetry)}>
            Retry
          </button>
        </div>
      )}
      {reportNotice && (
        <p role="status" className="fc2-report-notice">
          {reportNotice}
        </p>
      )}
      {reporting && <ReportProblemDialog card={reporting} returnFocusRef={reportRef} onClose={() => setReporting(null)} onDone={onReportDone} />}

      <SaveStatus entries={saves.entries} counts={saves.counts} onRetry={saves.retry} onRetryAll={saves.retryAll} />
    </div>
  )
}
