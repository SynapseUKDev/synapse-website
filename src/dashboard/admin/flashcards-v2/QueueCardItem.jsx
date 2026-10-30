import { useId, useState } from 'react'
import { CardAnswer } from '../../flashcards-v2/StudyCard'
import { plainQuestion } from '../../flashcards-v2/plainQuestion'
import CardDiagnostics from './CardDiagnostics'
import { CardEditSection } from './CardEditor'
import CardImagesControl from './CardImagesControl'
import Dialog from './Dialog'
import { KIND_LABELS, cardKind, findingLabel, needsFrontImage } from './findingLabels'
import { approveCard, discardCard } from './flashcardsV2AdminApi'

const MESSAGE_PREVIEW = 300

const HIDDEN_REASON = {
  reports_threshold: 'two learners reported a serious problem with this version',
  ai_confirmed_error: 'AI reassessment of a learner report confirmed a material error',
}

const errorText = (e) => `${e?.message || 'The request failed.'}${e?.code ? ` (${e.code})` : ''}`

/** A finding's message in full; one longer than 300 characters starts collapsed with "Show more". */
function FindingMessage({ message }) {
  const [open, setOpen] = useState(false)
  const text = String(message ?? '')
  if (text.length <= MESSAGE_PREVIEW) return <span className="fcv2a-why__msg">{text}</span>
  return (
    <span className="fcv2a-why__msg">
      {open ? text : `${text.slice(0, MESSAGE_PREVIEW).trimEnd()}…`}{' '}
      <button type="button" className="fcv2a-link" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Show less' : 'Show more'}
      </button>
    </span>
  )
}

/** WHY: the generator's reasons (run errors and warnings) in plain words, then the image requirement. */
function Why({ card }) {
  const findings = (card.findings ?? []).filter((f) => f.severity !== 'review')
  const review = (card.findings ?? []).find((f) => f.severity === 'review')
  const imageNeeded = card.qaStatus === 'media_pending'
  return (
    <section aria-label="Why" className="fcv2a-why">
      <p className="fcv2a-diag__title">Why</p>
      {findings.length > 0 ? (
        <ul className="fcv2a-findings">
          {findings.map((f, i) => (
            <li key={i} className={`fcv2a-finding fcv2a-finding--${f.severity}`}>
              <strong className="fcv2a-why__label">{findingLabel(f.code)}</strong> <FindingMessage message={f.message} />
            </li>
          ))}
        </ul>
      ) : review && !imageNeeded ? (
        <p>
          <strong className="fcv2a-why__label">Final review</strong> <FindingMessage message={review.message} />
        </p>
      ) : (
        !imageNeeded && <p className="fcv2a-muted">The generator gave no reason.</p>
      )}
      {imageNeeded && (
        <p className="fcv2a-media__req">
          <strong>Image needed: </strong>
          <span>{card.mediaRequirement || 'no description given'}</span>
        </p>
      )}
    </section>
  )
}

function DiscardDialog({ card, busy, error, onConfirm, onCancel }) {
  return (
    <Dialog title="Discard this card?" onClose={onCancel}>
      <p>
        <code>{card.semanticKey}</code>
        {card.topicName ? ` (${card.topicName})` : ''} is retired: it leaves this list and learners never see it.
      </p>
      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}
      <div className="fcv2a-row fcv2a-dialog__actions">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Discarding…' : 'Discard card'}
        </button>
      </div>
    </Dialog>
  )
}

/**
 * One needs-attention card: topic · key · kind chip, FRONT, BACK, WHY, images, and Edit / Approve /
 * Discard. Every write sends the card's contentVersion; a 409 STALE_VERSION calls onStale(cardId) so
 * the queue refetches the card ("This card changed — reloaded" arrives as `notice`).
 *
 * onCardChange(nextCard) after an edit or image change; onRemoved(card, message) after approve /
 * discard (the queue drops the item and refreshes its counts).
 */
export default function QueueCardItem({ card, notice, onCardChange, onRemoved, onStale }) {
  const [busy, setBusy] = useState(null) // 'approve' | 'discard'
  const [error, setError] = useState(null)
  const [discarding, setDiscarding] = useState(false)
  const [editing, setEditing] = useState(false)
  const [discardError, setDiscardError] = useState(null)
  const reasonId = useId()
  const kind = cardKind(card)
  const blockedByImage = needsFrontImage(card)
  const label = card.semanticKey ?? card.id

  async function approve() {
    setBusy('approve')
    setError(null)
    try {
      await approveCard(card.id, { expectedVersion: card.contentVersion })
      onRemoved?.(card, `Approved ${label}.`)
    } catch (e) {
      if (e?.kind === 'stale') onStale?.(card.id)
      else if (e?.code === 'APPROVE_ALREADY_APPROVED') onRemoved?.(card, `${label} was already approved.`)
      else if (e?.code === 'APPROVE_CARD_NOT_FOUND') onRemoved?.(card, `${label} no longer exists or was discarded.`)
      else setError(e)
    } finally {
      setBusy(null)
    }
  }

  async function discard() {
    setBusy('discard')
    setDiscardError(null)
    try {
      await discardCard(card.id, { expectedVersion: card.contentVersion })
      setDiscarding(false)
      onRemoved?.(card, `Discarded ${label}.`)
    } catch (e) {
      if (e?.kind === 'stale') {
        setDiscarding(false)
        onStale?.(card.id)
      } else if (e?.code === 'DISCARD_CARD_NOT_FOUND') {
        setDiscarding(false)
        onRemoved?.(card, `${label} no longer exists or was discarded.`)
      } else setDiscardError(e)
    } finally {
      setBusy(null)
    }
  }

  // An edit answer (PATCH /cards) has no topic or specialty names: keep the ones the list gave.
  const merge = (next) => onCardChange?.({ ...card, ...next, topicName: card.topicName, specialtyName: card.specialtyName })

  return (
    <article aria-label={`Card ${label}`} className="fcv2a-card">
      <header className="fcv2a-card__head">
        {card.topicName && <span className="fcv2a-card__topic">{card.topicName}</span>}
        <code className="fcv2a-card__key">{card.semanticKey}</code>
        <span className={`fcv2a-tag fcv2a-tag--${kind}`}>{KIND_LABELS[kind]}</span>
      </header>

      {notice && (
        <p role="status" className="fcv2a-notice">
          {notice}
        </p>
      )}

      {card.hiddenReason && (
        <p role="note" className="fcv2a-hidden-banner">
          {`Hidden from learners: ${HIDDEN_REASON[card.hiddenReason] ?? card.hiddenReason}. Resolve its reports (Learner reports tab) before approving.`}
        </p>
      )}

      <div className="fcv2a-card__cols">
        <section aria-label="Front" className="fcv2a-preview">
          <p className="fcv2a-diag__title">Front</p>
          <p className="fc2-question">{plainQuestion(card.question)}</p>
        </section>
        <section aria-label="Back" className="fcv2a-preview">
          <p className="fcv2a-diag__title">Back</p>
          <CardAnswer markdown={card.answerMarkdown} />
        </section>
      </div>

      <Why card={card} />

      <CardImagesControl card={card} onChange={merge} onStale={() => onStale?.(card.id)} />

      <details className="fcv2a-details">
        <summary>Technical details</summary>
        <CardDiagnostics card={card} />
      </details>

      <div className="fcv2a-row">
        <CardEditSection card={card} onSaved={merge} onStale={() => onStale?.(card.id)} onEditingChange={setEditing} />
        <button
          type="button"
          className="admin-btn-issue"
          onClick={approve}
          disabled={!!busy || blockedByImage || editing}
          aria-describedby={blockedByImage || editing ? reasonId : undefined}
        >
          {busy === 'approve' ? 'Approving…' : 'Approve'}
        </button>
        <button
          type="button"
          className="admin-btn-issue admin-btn-issue--danger"
          onClick={() => {
            setDiscardError(null)
            setDiscarding(true)
          }}
          disabled={!!busy}
        >
          Discard
        </button>
        {(editing || blockedByImage) && (
          <span id={reasonId} className="fcv2a-muted">
            {editing ? 'Save or cancel your edit first' : 'Add a front image first'}
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}

      {discarding && (
        <DiscardDialog card={card} busy={busy === 'discard'} error={discardError} onConfirm={discard} onCancel={() => setDiscarding(false)} />
      )}
    </article>
  )
}
