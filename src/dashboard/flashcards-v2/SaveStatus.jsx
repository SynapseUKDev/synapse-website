import { plainQuestion } from './plainQuestion'

// Visible save state for ratings: in-flight count, every failed rating with its own Retry (plus
// "Retry all" when there are several), and cards that changed or disappeared while being rated.

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const CONFIDENCE_LABEL = { hard: 'Hard', good: 'Good', easy: 'Easy' }

function shortQuestion(card) {
  const q = plainQuestion(card?.question).replace(/\n/g, ' ')
  return q.length > 80 ? `${q.slice(0, 77)}…` : q
}

export default function SaveStatus({ entries, counts, onRetry, onRetryAll }) {
  const failed = entries.filter((e) => e.status === 'failed')
  const notices = entries.filter((e) => e.status === 'stale' || e.status === 'gone')
  if (!counts.pending && !failed.length && !notices.length) return null

  return (
    <section className="fc2-saves" aria-label="Save status">
      <div role="status" aria-live="polite" className="fc2-saves__line">
        {counts.pending > 0 && <span>Saving {plural(counts.pending, 'rating')}…</span>}
        {failed.length > 0 && (
          <span className="fc2-saves__failed">{plural(failed.length, 'rating')} not saved</span>
        )}
      </div>

      {failed.length > 1 && (
        <button type="button" className="fc2-btn fc2-btn--primary" onClick={onRetryAll}>
          Retry all
        </button>
      )}

      {(failed.length > 0 || notices.length > 0) && (
        <ul className="fc2-saves__list">
          {failed.map((e) => (
            <li key={e.rating.reviewId} className="fc2-saves__item fc2-saves__item--failed">
              <span className="fc2-saves__text">
                <span className="fc2-saves__question">{shortQuestion(e.card)}</span>
                <span className="fc2-saves__meta">
                  {CONFIDENCE_LABEL[e.rating.confidence]} · {e.message}
                </span>
              </span>
              <button
                type="button"
                className="fc2-btn"
                onClick={() => onRetry(e.rating.reviewId)}
                aria-label={`Retry saving ${CONFIDENCE_LABEL[e.rating.confidence]} for: ${shortQuestion(e.card)}`}
              >
                Retry
              </button>
            </li>
          ))}
          {notices.map((e) => (
            <li key={e.rating.reviewId} className="fc2-saves__item">
              <span className="fc2-saves__text">
                <span className="fc2-saves__question">{shortQuestion(e.card)}</span>
                <span className="fc2-saves__meta">{e.message}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
