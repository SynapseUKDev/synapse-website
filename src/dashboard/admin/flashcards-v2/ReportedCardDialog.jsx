import { useCallback, useEffect, useState } from 'react'
import { CardAnswer } from '../../flashcards-v2/StudyCard'
import { plainQuestion } from '../../flashcards-v2/plainQuestion'
import { CardEditSection } from './CardEditor'
import CardImagesControl from './CardImagesControl'
import Dialog from './Dialog'
import { findAdminCard } from './cardLookup'
import { setCardsLive } from './flashcardsV2AdminApi'

const RELOADED = 'This card changed — reloaded'
const LIVE_SKIP = {
  hidden: 'it is hidden after learner reports — resolve them with "Unhide" first',
  not_approved: 'it is not approved yet (Needs attention tab)',
  needs_front_image: 'it needs a front image first',
  inactive: 'it has been retired',
  not_found: 'it no longer exists',
  already: 'it already was',
}

const errorText = (e) => `${e?.message || 'The request failed.'}${e?.code ? ` (${e.code})` : ''}`

/**
 * The card behind a learner report, opened from the Learner reports tab: its Live state, text, Edit,
 * images and Push live / Take off live. Reported cards are usually approved or live, so they are not
 * in the needs-attention queue; this is where an admin fixes one. `target` {topicId, topicName, cardId}.
 */
export default function ReportedCardDialog({ target, onClose }) {
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [missing, setMissing] = useState(false)
  const [notice, setNotice] = useState('')
  const [liveBusy, setLiveBusy] = useState(false)
  const [liveError, setLiveError] = useState(null)

  const load = useCallback(
    async ({ signal, reloaded = false } = {}) => {
      setLoading(true)
      try {
        const found = await findAdminCard(target.cardId, target.topicId, { signal })
        setCard(found)
        setMissing(!found)
        setError(null)
        if (reloaded) setNotice(RELOADED)
      } catch (e) {
        if (e?.name !== 'AbortError') setError(e)
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [target.cardId, target.topicId],
  )

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
  }, [load])

  const reload = () => load({ reloaded: true })
  // PATCH answers carry no topic / specialty names: keep the ones the lookup gave.
  const update = (next) => {
    setNotice('')
    setCard((prev) => ({ ...prev, ...next, topicName: prev?.topicName, specialtyName: prev?.specialtyName }))
  }

  async function toggleLive() {
    const live = !card.isLive
    setLiveBusy(true)
    setLiveError(null)
    try {
      const res = await setCardsLive([card.id], live)
      const skip = (res?.skipped ?? [])[0]
      if (skip && skip.reason !== 'already') {
        setNotice(`Not ${live ? 'pushed live' : 'taken off live'}: ${LIVE_SKIP[skip.reason] ?? skip.reason}.`)
      } else {
        setCard((prev) => ({ ...prev, isLive: live, isPublished: live }))
        setNotice(live ? 'Pushed live: learners see this card.' : 'Taken off live: learners no longer see this card.')
      }
    } catch (e) {
      setLiveError(e)
    } finally {
      setLiveBusy(false)
    }
  }

  const label = card?.semanticKey ?? target.cardId
  return (
    <Dialog title={`Reported card${target.topicName ? ` — ${target.topicName}` : ''}`} onClose={onClose}>
      <div className="fcv2a-row fcv2a-row--between">
        {card ? <code className="fcv2a-card__key">{label}</code> : <span />}
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onClose}>
          Close
        </button>
      </div>
      {loading && !card && <p className="fcv2a-muted">Loading…</p>}
      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}
      {missing && !loading && <p className="fcv2a-muted">This card has been discarded or retired.</p>}
      {card && (
        <section aria-label={`Card ${label}`} className="fcv2a-card">
          <div className="fcv2a-card__head">
            <span className={`fcv2a-tag fcv2a-tag--${card.isLive ? 'live' : 'notlive'}`}>{card.isLive ? 'Live' : 'Not live'}</span>
            {card.hiddenReason && <span className="fcv2a-tag fcv2a-tag--hidden">Hidden</span>}
          </div>
          <p role="status" className="fcv2a-notice">
            {notice}
          </p>
          <section aria-label="Front" className="fcv2a-preview">
            <p className="fcv2a-diag__title">Front</p>
            <p className="fc2-question">{plainQuestion(card.question)}</p>
          </section>
          <section aria-label="Back" className="fcv2a-preview">
            <p className="fcv2a-diag__title">Back</p>
            <CardAnswer markdown={card.answerMarkdown} />
          </section>
          <CardImagesControl card={card} onChange={update} onStale={reload} />
          <div className="fcv2a-row">
            <CardEditSection card={card} onSaved={update} onStale={reload} />
            <button type="button" className="admin-btn-issue" onClick={toggleLive} disabled={liveBusy}>
              {liveBusy ? 'Saving…' : card.isLive ? 'Take off live' : 'Push live'}
            </button>
          </div>
          {liveError && (
            <div role="alert" className="admin-alert">
              {errorText(liveError)}
            </div>
          )}
        </section>
      )}
    </Dialog>
  )
}
