import Dialog from './Dialog'
import { plural } from './reviewModel'

/**
 * retiredCandidates = active cards whose keys are absent from the current run. Retiring deactivates and
 * unpublishes them (the run id is checked server-side, so a newer run makes the request fail).
 */
export default function RetirePanel({ candidates, selected, onToggle, onRetire }) {
  return (
    <section aria-label="Retire candidates" className="fcv2a-panel">
      <h3 className="fcv2a-panel__title">Retire candidates ({candidates.length})</h3>
      {candidates.length === 0 ? (
        <p className="fcv2a-muted">No retire candidates: every active card is in the current run.</p>
      ) : (
        <>
          <p className="fcv2a-muted">Active cards the current run no longer contains. They block publishing until retired.</p>
          <ul className="fcv2a-retire">
            {candidates.map((key) => (
              <li key={key}>
                <label className="fcv2a-check">
                  <input type="checkbox" checked={selected.has(key)} onChange={() => onToggle(key)} />
                  {`Retire ${key}`}
                </label>
              </li>
            ))}
          </ul>
          <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={onRetire} disabled={selected.size === 0}>
            {`Retire selected (${selected.size})`}
          </button>
        </>
      )}
    </section>
  )
}

export function RetireDialog({ keys, busy, error, onConfirm, onCancel }) {
  return (
    <Dialog title={`Retire ${plural(keys.length, 'card')}?`} onClose={onCancel}>
      <p>These cards are deactivated and unpublished. Learners stop seeing them.</p>
      <ul>
        {keys.map((k) => (
          <li key={k}>
            <code>{k}</code>
          </li>
        ))}
      </ul>
      {error && (
        <div role="alert" className="admin-alert">
          {`${error.message}${error.code ? ` (${error.code})` : ''}${typeof error.details === 'string' ? `: ${error.details}` : ''}`}
        </div>
      )}
      <div className="fcv2a-row fcv2a-dialog__actions">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Retiring…' : 'Confirm retire'}
        </button>
      </div>
    </Dialog>
  )
}
