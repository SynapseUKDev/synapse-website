// Pure study-queue model. A session holds each card once (deduplicated by id); `order` is the queue of
// ids still to show. Re-queue rule (same as V1): easy = done, good = to the back, hard = two ahead.
// Progress is distinct cards done / distinct cards in the session, so a card rated several times is
// counted once, and a card that disappears mid-session leaves the denominator.

export function createQueue(cards) {
  const byId = new Map()
  for (const c of cards) if (c?.id && !byId.has(c.id)) byId.set(c.id, c)
  return { byId, order: [...byId.keys()], done: new Set(), removed: new Set() }
}

export function currentCard(q) {
  return q.order.length ? q.byId.get(q.order[0]) : null
}

/** Applies a rating to the card at the head of the queue. */
export function applyRating(q, confidence) {
  const [id, ...rest] = q.order
  if (!id) return q
  if (confidence === 'easy') return { ...q, order: rest, done: new Set(q.done).add(id) }
  if (confidence === 'good') return { ...q, order: [...rest, id] }
  const order = [...rest]
  order.splice(Math.min(2, order.length), 0, id)
  return { ...q, order }
}

/** Swaps in a refreshed copy of a card (e.g. a new content version); position and progress are kept. */
export function replaceCard(q, card) {
  if (!q.byId.has(card.id)) return q
  return { ...q, byId: new Map(q.byId).set(card.id, card) }
}

/** Drops a card that is no longer available from the queue and from the session total. */
export function removeCard(q, id) {
  if (!q.byId.has(id) || q.done.has(id)) return q
  return { ...q, order: q.order.filter((x) => x !== id), removed: new Set(q.removed).add(id) }
}

export function progressOf(q) {
  return { done: q.done.size, total: q.byId.size - q.removed.size }
}
