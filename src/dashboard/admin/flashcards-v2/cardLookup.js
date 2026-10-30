import { listAdminCards } from './flashcardsV2AdminApi'

/** Page size when one card is looked up inside its topic (state=all; there is no GET /admin/cards/:id). */
export const LOOKUP_PAGE = 200

/** The active card with this id in its topic (AdminCardDto + topicName), or null when it is gone (discarded / retired). */
export async function findAdminCard(cardId, topicId, { signal } = {}) {
  const wanted = String(cardId).toLowerCase()
  let cursor = null
  do {
    const page = await listAdminCards({ state: 'all', topicId, cursor, limit: LOOKUP_PAGE, signal })
    const hit = (page?.cards ?? []).find((c) => String(c.id).toLowerCase() === wanted)
    if (hit) return hit
    cursor = page?.nextCursor ?? null
  } while (cursor)
  return null
}
