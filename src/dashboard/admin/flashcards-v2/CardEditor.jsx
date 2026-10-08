import { useId } from 'react'

function ConflictBox({ conflict, onReload, onKeepDraft, onDiscardDraft }) {
  if (!conflict.reloaded) {
    return (
      <div role="alert" className="admin-alert">
        <p>
          This card was changed by someone else since you loaded it — reload to see the latest version. Your text is
          kept here; saving is disabled until you have compared it with theirs.
        </p>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onReload}>
          Reload review
        </button>
      </div>
    )
  }
  const { current } = conflict
  return (
    <div role="alert" className="admin-alert fcv2a-conflict">
      <p>
        This card was changed by someone else. Compare their current version with your draft below, then choose one —
        saving stays disabled until you do.
      </p>
      <section aria-label="Current server version" className="fcv2a-conflict__current">
        <p className="fcv2a-label">{`Current server version (v${current.version})`}</p>
        <p className="fcv2a-label">Question</p>
        <pre className="fcv2a-suggestion">{current.question}</pre>
        <p className="fcv2a-label">Answer (Markdown)</p>
        <pre className="fcv2a-suggestion">{current.answerMarkdown}</pre>
      </section>
      <div className="fcv2a-row">
        <button type="button" className="admin-btn-issue" onClick={onKeepDraft}>
          Keep my draft (replace current)
        </button>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onDiscardDraft}>
          Discard my draft
        </button>
      </div>
    </div>
  )
}

function ErrorBox({ error, onReload }) {
  const issues = Array.isArray(error.details) ? error.details : []
  return (
    <div role="alert" className="admin-alert">
      <p>
        {error.message}
        {error.code ? ` (${error.code})` : ''}
      </p>
      {issues.length > 0 && (
        <ul>
          {issues.map((i, n) => (
            <li key={n}>{`${i.path || 'body'}: ${i.message}`}</li>
          ))}
        </ul>
      )}
      {error.kind === 'not_found' && (
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onReload}>
          Reload review
        </button>
      )}
    </div>
  )
}

/** Controlled question/answer editor; the owner holds the draft so it survives reloads and errors. */
export default function CardEditor({ draft, onChange, onSave, onCancel, saving, error, conflict, onKeepDraft, onDiscardDraft, onReload }) {
  const qId = useId()
  const aId = useId()
  return (
    <div className="fcv2a-editor">
      <label htmlFor={qId} className="fcv2a-label">
        Question
      </label>
      <textarea id={qId} rows={3} value={draft.question} onChange={(e) => onChange({ ...draft, question: e.target.value })} />
      <label htmlFor={aId} className="fcv2a-label">
        Answer (Markdown)
      </label>
      <textarea id={aId} rows={8} value={draft.answerMarkdown} onChange={(e) => onChange({ ...draft, answerMarkdown: e.target.value })} />
      <p className="fcv2a-muted">Saving makes the card a draft again: it is unpublished and needs validation before the topic can be published.</p>
      {conflict && <ConflictBox conflict={conflict} onReload={onReload} onKeepDraft={onKeepDraft} onDiscardDraft={onDiscardDraft} />}
      {error && <ErrorBox error={error} onReload={onReload} />}
      <div className="fcv2a-row">
        <button type="button" className="admin-btn-issue" onClick={onSave} disabled={saving || !!conflict}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  )
}
