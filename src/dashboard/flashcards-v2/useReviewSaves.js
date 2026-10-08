import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRating, fetchCurrentCard, recordReview } from './flashcardsV2Api'

// Save state for every rating made in a session. Each rating gets its review_id once (createRating) and
// every retry resends that same rating, so the server applies it at most once.
//
// Entry status:
//   pending   – request (or the stale-card refetch) in flight
//   saved     – server accepted it
//   failed    – network/server error; retryable individually or via retryAll
//   stale     – 409 STALE_VERSION: the card changed; the fresh copy replaced it in the session and it
//               will reappear as new (the rating for the old version is intentionally not resent)
//   gone      – 404: the card is no longer available; removed from the session
//   discarded – the learner chose to give up on a failed rating

export function useReviewSaves({ preview = false, onCardChanged, onCardGone } = {}) {
  const [entries, setEntries] = useState([])
  const handlers = useRef({ onCardChanged, onCardGone })
  useEffect(() => {
    handlers.current = { onCardChanged, onCardGone }
  }, [onCardChanged, onCardGone])

  const patch = useCallback((reviewId, fields) => {
    // A discarded rating stays discarded even if its request settles later.
    setEntries((list) =>
      list.map((e) => (e.rating.reviewId === reviewId && e.status !== 'discarded' ? { ...e, ...fields } : e)),
    )
  }, [])

  const send = useCallback(
    async (rating, card) => {
      patch(rating.reviewId, { status: 'pending', message: null })
      try {
        const result = await recordReview(rating, { preview })
        patch(rating.reviewId, { status: 'saved', result })
      } catch (error) {
        if (error?.kind === 'stale') {
          let fresh = null
          try {
            fresh = await fetchCurrentCard(card, { preview })
          } catch (refetchError) {
            console.warn('Flashcards V2: refetch after STALE_VERSION failed', refetchError?.name, refetchError?.message)
          }
          if (fresh) {
            handlers.current.onCardChanged?.(fresh)
            patch(rating.reviewId, { status: 'stale', message: 'Card updated — will reappear as new.' })
          } else {
            handlers.current.onCardGone?.(card.id)
            patch(rating.reviewId, { status: 'stale', message: 'Card no longer available — rating not needed.' })
          }
        } else if (error?.kind === 'not_found') {
          handlers.current.onCardGone?.(card.id)
          patch(rating.reviewId, { status: 'gone', message: 'Card no longer available — rating not needed.' })
        } else {
          console.warn('Flashcards V2: rating save failed', error?.name, error?.kind, error?.message)
          patch(rating.reviewId, { status: 'failed', message: error?.message || 'Could not save this rating.' })
        }
      }
    },
    [patch, preview],
  )

  const submit = useCallback(
    (card, confidence) => {
      const rating = createRating({ cardId: card.id, confidence, contentVersion: card.contentVersion })
      setEntries((list) => [...list, { rating, card, status: 'pending', message: null }])
      return send(rating, card)
    },
    [send],
  )

  const retry = useCallback(
    (reviewId) => {
      const entry = entries.find((e) => e.rating.reviewId === reviewId)
      if (entry && entry.status === 'failed') return send(entry.rating, entry.card)
      return Promise.resolve()
    },
    [entries, send],
  )

  const retryAll = useCallback(
    () => Promise.all(entries.filter((e) => e.status === 'failed').map((e) => send(e.rating, e.card))),
    [entries, send],
  )

  const discardFailed = useCallback(() => {
    setEntries((list) => list.map((e) => (e.status === 'failed' ? { ...e, status: 'discarded' } : e)))
  }, [])

  const counts = useMemo(() => {
    const c = { pending: 0, saved: 0, failed: 0, stale: 0, gone: 0, discarded: 0 }
    for (const e of entries) c[e.status] += 1
    return c
  }, [entries])

  return { entries, counts, submit, retry, retryAll, discardFailed }
}
