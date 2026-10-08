import Dialog from './Dialog'
import { publishPlan } from './reviewModel'

function CardList({ label, cards, empty }) {
  return (
    <section aria-label={label} className="fcv2a-dialog__section">
      <p className="fcv2a-label">
        {label} ({cards.length})
      </p>
      {cards.length === 0 ? (
        <p className="fcv2a-muted">{empty}</p>
      ) : (
        <ul>
          {cards.map((c) => (
            <li key={c.id}>
              <code>{c.semanticKey}</code> <span>{c.question}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** What the server said when it refused: blockers ({blockers, detail}) or a stale run/version. */
export function PublishRefusal({ error, onReload }) {
  const blockers = Array.isArray(error?.details?.blockers) ? error.details.blockers : []
  return (
    <div role="alert" className="admin-alert">
      {error.kind === 'blocked' ? (
        <>
          <p>{`Publishing was refused (${error.code}):`}</p>
          <ul>
            {blockers.map((b, i) => (
              <li key={i}>{b.message}</li>
            ))}
          </ul>
        </>
      ) : error.kind === 'stale' ? (
        <p>
          {`The run or a card changed since this review was loaded (${error.code}${typeof error.details === 'string' && error.details ? `: ${error.details}` : ''}). Reload the review and check it again.`}
        </p>
      ) : (
        <p>{`${error.message}${error.code ? ` (${error.code})` : ''}`}</p>
      )}
      {(error.kind === 'blocked' || error.kind === 'stale' || error.kind === 'conflict') && (
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onReload}>
          Reload review
        </button>
      )}
    </div>
  )
}

export default function PublishDialog({ topicName, cards, busy, error, onConfirm, onCancel, onReload }) {
  const plan = publishPlan(cards)
  return (
    <Dialog title={`Publish ${topicName}?`} onClose={onCancel}>
      <p>Approval and publication happen together, for exactly the versions shown on this page.</p>
      <CardList label="Will publish" cards={plan.willPublish} empty="No new cards will be published." />
      <CardList label="Stays awaiting image" cards={plan.awaitingImage} empty="No card is waiting for an image." />
      {plan.alreadyPublished.length > 0 && <CardList label="Already published" cards={plan.alreadyPublished} empty="" />}
      {error && <PublishRefusal error={error} onReload={onReload} />}
      <div className="fcv2a-row fcv2a-dialog__actions">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="admin-btn-issue" onClick={onConfirm} disabled={busy}>
          {busy ? 'Publishing…' : 'Confirm publish'}
        </button>
      </div>
    </Dialog>
  )
}
