import { useEffect, useId, useRef, useState } from 'react'
import { submitReport } from './flashcardsV2Api'
import { MAX_DETAILS, REPORT_CATEGORIES } from './reportCategories'
import './ReportProblem.css'

// "Report a problem" modal for one card (design §7 Reports; backend POST /cards/:id/reports).
// The learner picks one of the seven categories (plain English), may add details, and the report is
// sent for the content version they are looking at. The outcome goes back to the session:
//   sent  — 201 new report, or 200 because this learner already reported this version (same message)
//   stale — 409: the card changed since it was shown; the session refreshes it
//   gone  — 404: the card is no longer available
// Anything else (network, rate limit, server) stays in the modal with its message and can be retried.


const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** `returnFocusRef`: where focus goes on close (default: whatever had focus on open; Safari does not focus clicked buttons). */
export default function ReportProblemDialog({ card, onClose, onDone, returnFocusRef }) {
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const ref = useRef(null)
  const titleId = useId()
  const categoryId = useId()
  const detailsId = useId()

  // Focus moves inside on open and returns to the opener on close.
  useEffect(() => {
    const opener = document.activeElement
    ref.current?.querySelector(FOCUSABLE)?.focus()
    return () => {
      // The opener's CURRENT node at close time is wanted here (it may have re-rendered).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const target = returnFocusRef?.current ?? opener
      if (target && typeof target.focus === 'function' && document.contains(target)) target.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per opening
  }, [])

  function onKeyDown(event) {
    // Nothing typed here may reach the study shortcuts (1/2/3, Space, Enter) on the window.
    event.stopPropagation()
    if (event.key === 'Escape') {
      if (!sending) onClose?.()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...(ref.current?.querySelectorAll(FOCUSABLE) ?? [])]
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (!category || sending) return
    setSending(true)
    setError(null)
    try {
      await submitReport(card.id, { category, details, contentVersion: card.contentVersion })
      onDone?.('sent')
    } catch (e) {
      if (e?.kind === 'stale') onDone?.('stale')
      else if (e?.kind === 'not_found') onDone?.('gone')
      else {
        console.warn('Flashcards V2: report failed', e?.name, e?.kind, e?.message)
        setError(e?.message || 'Could not send the report. Try again.')
        setSending(false)
      }
    }
  }

  return (
    <div className="fc2-report-backdrop">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fc2-report"
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="fc2-report__title">
          Report a problem with this card
        </h2>
        <form onSubmit={submit} className="fc2-report__form ph-no-capture">
          <label htmlFor={categoryId} className="fc2-report__label">
            What is wrong?
          </label>
          <select id={categoryId} value={category} onChange={(e) => setCategory(e.target.value)} required>
            <option value="">Choose a reason…</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <label htmlFor={detailsId} className="fc2-report__label">
            Details <span className="fc2-report__optional">(optional)</span>
          </label>
          <textarea
            id={detailsId}
            rows={4}
            maxLength={MAX_DETAILS}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="What should the card say instead?"
          />
          <p className="fc2-report__hint">
            {details.length}/{MAX_DETAILS}
          </p>
          {error && (
            <p role="alert" className="fc2-report__error">
              {error}
            </p>
          )}
          <div className="fc2-report__actions">
            <button type="button" className="fc2-btn" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button type="submit" className="fc2-btn fc2-btn--primary" disabled={!category || sending}>
              {sending ? 'Sending…' : 'Send report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
