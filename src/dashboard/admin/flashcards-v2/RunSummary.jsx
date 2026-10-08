import { entryText, formatTime } from './reviewModel'

function ReviewList({ title, items }) {
  if (!items?.length) return null
  return (
    <div className="fcv2a-summary__list">
      <p className="fcv2a-label">
        {title} ({items.length})
      </p>
      <ul>
        {items.map((item, i) => (
          <li key={i}>{entryText(item)}</li>
        ))}
      </ul>
    </div>
  )
}

/** Run metadata plus run-level (not card-level) findings and the final review's topic notes. */
export default function RunSummary({ review, run }) {
  const finalReview = run.reviews?.[run.reviews.length - 1]
  const topicFindings = [...(run.errors ?? []), ...(run.warnings ?? [])].filter((f) => !f?.semanticKey)
  return (
    <section aria-label="Run summary" className="fcv2a-panel">
      <h3 className="fcv2a-panel__title">Run summary</h3>
      <dl className="fcv2a-dl">
        <dt>Review status</dt>
        <dd>
          <code>{review.status}</code>
        </dd>
        <dt>Text deck status</dt>
        <dd>
          <code>{run.textDeckStatus}</code>
        </dd>
        <dt>Model</dt>
        <dd>{run.model || '—'}</dd>
        <dt>Prompt version</dt>
        <dd>{run.promptVersion || '—'}</dd>
        <dt>Imported</dt>
        <dd>{formatTime(run.importedAt)}</dd>
        <dt>Approved</dt>
        <dd>{review.approvedAt ? formatTime(review.approvedAt) : 'Not approved'}</dd>
        <dt>Run</dt>
        <dd>
          <code>{run.id}</code>
        </dd>
        <dt>Reviews</dt>
        <dd>
          {run.reviews?.length ?? 0} · {run.errors?.length ?? 0} errors · {run.warnings?.length ?? 0} warnings
        </dd>
      </dl>
      {topicFindings.length > 0 && (
        <div className="fcv2a-summary__list">
          <p className="fcv2a-label">Topic-level findings</p>
          <ul>
            {topicFindings.map((f, i) => (
              <li key={i}>
                <code>{f.code}</code> <span>{f.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ReviewList title="Missing cards suggested by the reviewer" items={finalReview?.missingCards} />
      <ReviewList title="Low-yield cards" items={finalReview?.lowYield} />
      <ReviewList title="Needs human verification" items={finalReview?.needsHumanVerification} />
    </section>
  )
}
