import { useState } from 'react'
import { CardEditSection } from '../admin/flashcards-v2/CardEditor'
import CardImagesControl from '../admin/flashcards-v2/CardImagesControl'
import { setCardsLive } from '../admin/flashcards-v2/flashcardsV2AdminApi'
import { CardAnswer } from './StudyCard'
import { plainQuestion } from './plainQuestion'

const SKIP_REASON = {
  hidden: 'it is hidden after learner reports',
  not_approved: 'it is not approved yet',
  needs_front_image: 'it needs a front image first',
  inactive: 'it has been retired',
  not_found: 'it no longer exists',
}

const errorText = (e) => `${e?.message || 'The request failed.'}${e?.code ? ` (${e.code})` : ''}`

/**
 * One approved card in Manage mode: question, expandable answer, Live / Not live chip, Edit, Images and
 * Push live / Take off live. `card` is an AdminCardDTO; onChange(next) hands the owner the updated card,
 * onStale() asks it to reload the topic after a 409 STALE_VERSION.
 */
export default function ManageCardRow({ card, onChange, onStale }) {
  const [showAnswer, setShowAnswer] = useState(false)
  const [showImages, setShowImages] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const label = card.semanticKey ?? card.id

  // The edit PATCH answers carry no topic / specialty names; keep the card's own.
  const merge = (next) => onChange({ ...card, ...next, topicName: card.topicName, specialtyName: card.specialtyName })

  async function toggleLive() {
    const live = !card.isLive
    setBusy(true)
    setError(null)
    setNotice('')
    try {
      const res = await setCardsLive([card.id], live)
      const skip = (res?.skipped ?? []).find((s) => s.id === card.id && s.reason !== 'already')
      if (skip) setNotice(`Not ${live ? 'pushed live' : 'taken off live'}: ${SKIP_REASON[skip.reason] ?? skip.reason}.`)
      else onChange({ ...card, isLive: live })
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <article aria-label={`Card ${label}`} className="fcv2a-card fc2-manage-row">
      <div className="fcv2a-card__head">
        <span className={`fcv2a-tag fcv2a-tag--${card.isLive ? 'live' : 'notlive'}`}>{card.isLive ? 'Live' : 'Not live'}</span>
        <code className="fcv2a-card__key">{label}</code>
      </div>
      <p className="fc2-question">{plainQuestion(card.question)}</p>
      <div className="fcv2a-row">
        <button
          type="button"
          className="admin-btn-issue admin-btn-issue--ghost"
          aria-expanded={showAnswer}
          onClick={() => setShowAnswer((v) => !v)}
        >
          {showAnswer ? 'Hide answer' : 'Show answer'}
        </button>
        <CardEditSection card={card} onSaved={merge} onStale={onStale} />
        <button
          type="button"
          className="admin-btn-issue admin-btn-issue--ghost"
          aria-expanded={showImages}
          onClick={() => setShowImages((v) => !v)}
        >
          Images
        </button>
        <button type="button" className="admin-btn-issue" onClick={toggleLive} disabled={busy}>
          {busy ? 'Saving…' : card.isLive ? 'Take off live' : 'Push live'}
        </button>
      </div>
      {showAnswer && <CardAnswer markdown={card.answerMarkdown} />}
      {showImages && <CardImagesControl card={card} onChange={onChange} onStale={onStale} />}
      {notice && <p className="fcv2a-notice">{notice}</p>}
      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}
    </article>
  )
}
