import { useState } from 'react'
import StudyCard from '../../flashcards-v2/StudyCard'
import CardDiagnostics from './CardDiagnostics'
import CardEditor from './CardEditor'
import CardMediaControl from './CardMediaControl'
import { editCard } from './flashcardsV2AdminApi'
import { needsMediaPlaceholder } from './reviewModel'

const HIDDEN_REASON = {
  reports_threshold: 'two learners reported a serious problem with this version',
  ai_confirmed_error: 'AI reassessment of a learner report confirmed a material error',
}

/**
 * One card: the student preview (the learner StudyCard, unchanged, without admin badges) beside a
 * separate admin diagnostics block, plus the version-checked inline editor.
 *
 * The draft lives here, keyed by card id in the parent, so a reload after a 409 keeps the admin's
 * text. A 409 opens a conflict that lasts until the admin resolves it explicitly: before the reload
 * only "Reload review" is offered; after it the current server text is shown beside the draft and
 * Save stays disabled until they choose "Keep my draft (replace current)" or "Discard my draft".
 * Nothing is ever saved over someone else's version without that choice.
 */
export default function AdminCardItem({ card, verdict, retirable, selected, onToggleRetire, onSaved, onMediaChanged, onReload }) {
  const [revealed, setRevealed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(() => ({ question: card.question, answerMarkdown: card.answerMarkdown }))
  const [saving, setSaving] = useState(false)
  const [editError, setEditError] = useState(null) // non-conflict save error
  const [conflict, setConflict] = useState(null) // {atVersion}: the version our rejected save expected

  const fromCard = () => ({ question: card.question, answerMarkdown: card.answerMarkdown })

  function openEditor() {
    setDraft(fromCard())
    setEditError(null)
    setConflict(null)
    setEditing(true)
  }

  function closeEditor() {
    setEditing(false)
    setEditError(null)
    setConflict(null)
  }

  const keepDraft = () => setConflict(null)
  function discardDraft() {
    setDraft(fromCard())
    setConflict(null)
    setEditError(null)
  }

  function applySuggestion() {
    const base = editing ? draft : fromCard()
    setDraft({
      question: verdict?.correctedQuestion ?? base.question,
      answerMarkdown: verdict?.correctedAnswerMarkdown ?? base.answerMarkdown,
    })
    setEditError(null)
    setEditing(true)
  }

  async function save() {
    if (conflict) return
    const body = { expectedVersion: card.contentVersion }
    if (draft.question !== card.question) body.question = draft.question
    if (draft.answerMarkdown !== card.answerMarkdown) body.answerMarkdown = draft.answerMarkdown
    if (body.question === undefined && body.answerMarkdown === undefined) {
      setEditError({ message: 'Nothing changed.', kind: 'validation' })
      return
    }
    setSaving(true)
    setEditError(null)
    try {
      const updated = await editCard(card.id, body)
      setEditing(false)
      onSaved?.(updated ?? card)
    } catch (error) {
      if (error?.kind === 'stale') setConflict({ atVersion: card.contentVersion })
      else setEditError(error)
    } finally {
      setSaving(false)
    }
  }

  // Reloaded = the card now carries a different version than the one our rejected save expected.
  const conflictState = conflict
    ? {
        reloaded: card.contentVersion !== conflict.atVersion,
        current: { question: card.question, answerMarkdown: card.answerMarkdown, version: card.contentVersion },
      }
    : null
  const placeholder = needsMediaPlaceholder(card)

  return (
    <section aria-label={`Card ${card.semanticKey}`} className={`fcv2a-card${card.legacy ? ' fcv2a-card--legacy' : ''}`}>
      <header className="fcv2a-card__head">
        <code className="fcv2a-card__key">{card.semanticKey}</code>
        {card.legacy && <span className="fcv2a-tag fcv2a-tag--legacy">Legacy — not in current run</span>}
        {card.legacy && retirable && (
          <label className="fcv2a-check">
            <input type="checkbox" checked={selected} onChange={() => onToggleRetire?.(card.semanticKey)} />
            {`Select ${card.semanticKey} for retirement`}
          </label>
        )}
        {card.legacy && !retirable && <span className="fcv2a-muted">Its key is in the current run, so it cannot be retired here.</span>}
      </header>

      {card.hiddenReason && (
        <p role="note" className="fcv2a-hidden-banner">
          {`Hidden from learners: ${HIDDEN_REASON[card.hiddenReason] ?? card.hiddenReason}. It blocks publishing until it is corrected or its reports are resolved with "unhide" (Reports tab).`}
        </p>
      )}

      <div className="fcv2a-card__cols">
        <section aria-label="Student preview" className="fcv2a-preview">
          <p className="fcv2a-diag__title">Student preview</p>
          {placeholder && (
            <p className="fcv2a-media-placeholder">{`Image required: ${card.mediaRequirement || 'no description given'}`}</p>
          )}
          <StudyCard card={card} revealed={revealed} />
          <button type="button" className="fc2-btn" aria-expanded={revealed} onClick={() => setRevealed((r) => !r)}>
            {revealed ? 'Hide answer' : 'Show answer'}
          </button>
        </section>
        <CardDiagnostics card={card} verdict={verdict} onApplySuggestion={applySuggestion} />
      </div>

      {card.isMediaRequired && <CardMediaControl card={card} onChanged={onMediaChanged} onReload={onReload} />}

      {editing ? (
        <CardEditor
          draft={draft}
          onChange={setDraft}
          onSave={save}
          onCancel={closeEditor}
          saving={saving}
          error={editError}
          conflict={conflictState}
          onKeepDraft={keepDraft}
          onDiscardDraft={discardDraft}
          onReload={onReload}
        />
      ) : (
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={openEditor}>
          Edit card
        </button>
      )}
    </section>
  )
}
