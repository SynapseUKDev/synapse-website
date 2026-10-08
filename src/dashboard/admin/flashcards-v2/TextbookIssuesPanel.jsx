import { useId, useState } from 'react'
import { setTextbookIssue } from './flashcardsV2AdminApi'
import { formatTime } from './reviewModel'

const STATUSES = ['open', 'accepted', 'rejected', 'fixed']

function IssueRow({ runId, issue, number }) {
  const [status, setStatus] = useState(issue.resolution?.status ?? 'open')
  const [note, setNote] = useState(issue.resolution?.note ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const statusId = useId()
  const noteId = useId()

  async function save(nextStatus) {
    setSaving(true)
    setError(null)
    try {
      const result = await setTextbookIssue(runId, issue.reviewIndex, issue.issueIndex, {
        status: nextStatus,
        note: note.trim() ? note : null,
      })
      if (result?.status) setStatus(result.status)
      setSavedAt(result?.updatedAt ?? new Date().toISOString())
    } catch (e) {
      setError(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="fcv2a-issue">
      <p className="fcv2a-label">{`Issue ${number}${issue.blockIds?.length ? ` · blocks ${issue.blockIds.join(', ')}` : ''}`}</p>
      <dl className="fcv2a-dl">
        <dt>Current text</dt>
        <dd>{issue.currentText}</dd>
        <dt>Problem</dt>
        <dd>{issue.problem}</dd>
        <dt>Proposed correction</dt>
        <dd>{issue.proposedCorrection}</dd>
      </dl>
      <div className="fcv2a-row">
        <label htmlFor={statusId} className="fcv2a-label">
          {`Status of issue ${number}`}
        </label>
        <select
          id={statusId}
          value={status}
          disabled={saving}
          onChange={(e) => {
            setStatus(e.target.value)
            save(e.target.value)
          }}
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <label htmlFor={noteId} className="fcv2a-label">
        {`Note for issue ${number}`}
      </label>
      <textarea id={noteId} rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="fcv2a-row">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => save(status)} disabled={saving}>
          Save note
        </button>
        <span role="status" aria-live="polite" className="fcv2a-muted">
          {saving ? 'Saving…' : savedAt ? `Saved ${formatTime(savedAt)}` : ''}
        </span>
      </div>
      {error && (
        <div role="alert" className="admin-alert">
          {`${error.message}${error.code ? ` (${error.code})` : ''}`}
        </div>
      )}
    </li>
  )
}

/**
 * Problems the reviewer found in the textbook source. Only their resolution is tracked here; the
 * textbook itself is never edited from this screen (the link opens it read-only).
 */
export default function TextbookIssuesPanel({ runId, topicName, issues }) {
  const list = issues ?? []
  return (
    <section aria-label="Textbook issues" className="fcv2a-panel">
      <h3 className="fcv2a-panel__title">Textbook issues ({list.length})</h3>
      <p className="fcv2a-muted">
        Tracking only — the textbook is not changed from here.{' '}
        {topicName && (
          <a href={`/dashboard/textbook/search?q=${encodeURIComponent(topicName)}`} target="_blank" rel="noreferrer">
            {`Find “${topicName}” in the textbook (opens read-only)`}
          </a>
        )}
      </p>
      {list.length === 0 ? (
        <p className="fcv2a-muted">The reviewer reported no textbook issues.</p>
      ) : (
        <ol className="fcv2a-issues">
          {list.map((issue, i) => (
            <IssueRow key={`${runId}:${issue.reviewIndex}:${issue.issueIndex}`} runId={runId} issue={issue} number={i + 1} />
          ))}
        </ol>
      )}
    </section>
  )
}
