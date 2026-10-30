import { useEffect, useId, useState } from 'react'
import { editCard } from './flashcardsV2AdminApi'

function ConflictBox({ conflict, onReload, onKeepDraft, onDiscardDraft }) {
  if (!conflict.reloaded) {
    return (
      <div role="alert" className="admin-alert">
        <p>
          This card was changed by someone else since you loaded it — reload to see the latest version. Your text is
          kept here; saving is disabled until you have compared it with theirs.
        </p>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onReload}>
          Reload card
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
          Reload card
        </button>
      )}
    </div>
  )
}

/**
 * Controlled question/answer editor; the owner holds the draft so it survives reloads and errors.
 * Used by the needs-attention queue (QueueCardItem) and the Flashcards page Manage mode.
 *
 * draft {question, answerMarkdown}; onChange(nextDraft); onSave(); onCancel(); saving; error (an
 * API error, non-conflict); conflict {reloaded, current: {question, answerMarkdown, version}} | null
 * after a 409; onKeepDraft() / onDiscardDraft() resolve it; onReload() refetches the card.
 */
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
      <p className="fcv2a-muted">Saving keeps the card where it is (approved or live cards stay so); learner progress on it restarts.</p>
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

/**
 * "Edit card" button plus the editor, owning the draft and the version check: PATCH /cards/:id with
 * the card's contentVersion, only the changed fields. A 409 opens a conflict that lasts until the
 * admin chooses: onStale() asks the owner to refetch the card (the current text then shows beside
 * the draft) and Save stays disabled until "Keep my draft" or "Discard my draft". Nothing is saved
 * over someone else's version without that choice.
 *
 * card: AdminCardDto; onSaved(updatedCardDto) after a save; onStale() to refetch the card; onEditingChange(bool) while an edit draft is open.
 */
export function CardEditSection({ card, onSaved, onStale, onEditingChange }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({ question: card.question, answerMarkdown: card.answerMarkdown }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [conflict, setConflict] = useState(null) // {atVersion}: the version our rejected save expected

  useEffect(() => {
    onEditingChange?.(editing)
    return () => onEditingChange?.(false)
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  const fromCard = () => ({ question: card.question, answerMarkdown: card.answerMarkdown })

  function open() {
    setDraft(fromCard())
    setError(null)
    setConflict(null)
    setEditing(true)
  }

  function close() {
    setEditing(false)
    setError(null)
    setConflict(null)
  }

  function discardDraft() {
    setDraft(fromCard())
    setConflict(null)
    setError(null)
  }

  async function save() {
    if (conflict) return
    const body = { expectedVersion: card.contentVersion }
    if (draft.question !== card.question) body.question = draft.question
    if (draft.answerMarkdown !== card.answerMarkdown) body.answerMarkdown = draft.answerMarkdown
    if (body.question === undefined && body.answerMarkdown === undefined) {
      setError({ message: 'Nothing changed.', kind: 'validation' })
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await editCard(card.id, body)
      setEditing(false)
      onSaved?.(updated ?? card)
    } catch (e) {
      if (e?.kind === 'stale') {
        setConflict({ atVersion: card.contentVersion })
        onStale?.()
      } else setError(e)
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={open}>
        Edit
      </button>
    )
  }
  // Reloaded = the card now carries a different version than the one our rejected save expected.
  const conflictState = conflict
    ? {
        reloaded: card.contentVersion !== conflict.atVersion,
        current: { question: card.question, answerMarkdown: card.answerMarkdown, version: card.contentVersion },
      }
    : null
  return (
    <CardEditor
      draft={draft}
      onChange={setDraft}
      onSave={save}
      onCancel={close}
      saving={saving}
      error={error}
      conflict={conflictState}
      onKeepDraft={() => setConflict(null)}
      onDiscardDraft={discardDraft}
      onReload={onStale}
    />
  )
}
