import { useEffect, useRef } from 'react'
import SaveStatus from './SaveStatus'

// End of a session (completed, or ended early). Finish stays disabled while any rating is still
// saving or has failed, until those are retried successfully or the learner explicitly discards them.

export default function SessionSummary({ complete, progress, saves, onFinish }) {
  const { entries, counts, retry, retryAll, discardFailed } = saves
  const headingRef = useRef(null)
  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  const tally = { hard: 0, good: 0, easy: 0 }
  for (const e of entries) tally[e.rating.confidence] += 1
  const blocked = counts.pending > 0 || counts.failed > 0

  return (
    <div className="fc2-summary">
      <h2 className="fc2-summary__title" tabIndex={-1} ref={headingRef}>
        {complete ? 'Session complete' : 'Session ended'}
      </h2>
      <p className="fc2-summary__line">
        You completed {progress.done} of {progress.total} cards.
      </p>
      <dl className="fc2-summary__tally">
        <div>
          <dt>Hard</dt>
          <dd>{tally.hard}</dd>
        </div>
        <div>
          <dt>Good</dt>
          <dd>{tally.good}</dd>
        </div>
        <div>
          <dt>Easy</dt>
          <dd>{tally.easy}</dd>
        </div>
      </dl>

      <SaveStatus entries={entries} counts={counts} onRetry={retry} onRetryAll={retryAll} />

      {blocked && (
        <p className="fc2-summary__hint">
          {counts.failed > 0
            ? 'Some ratings are not saved yet. Retry them, or discard them to finish.'
            : 'Waiting for your ratings to save…'}
        </p>
      )}

      <div className="fc2-summary__actions">
        {counts.failed > 0 && (
          <button type="button" className="fc2-btn" onClick={discardFailed}>
            Discard unsaved ratings
          </button>
        )}
        <button type="button" className="fc2-btn fc2-btn--primary" onClick={onFinish} disabled={blocked}>
          Finish
        </button>
      </div>
    </div>
  )
}
