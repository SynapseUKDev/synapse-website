import { getAllCards, getDueAll, getSeenAll } from './flashcardsV2Api'

// Turns a picker choice into the cards of one session.
//   due  – cards /srs/due returns for the selected topics (most overdue first)
//   new  – the selected topics' cards not in /srs/seen, at most MAX_NEW_CARDS
//   free – every card of the selected topics

export const MODES = { DUE: 'due', NEW: 'new', FREE: 'free' }
export const MAX_NEW_CARDS = 20

const EMPTY_MESSAGE = {
  [MODES.DUE]: 'No cards are due in the selected topics. Try New or Free study.',
  [MODES.NEW]: 'You have seen every card in the selected topics. Try Due or Free study.',
  [MODES.FREE]: 'The selected topics have no cards.',
}

export async function buildDeck(mode, topicIds, opts = {}) {
  let cards
  if (mode === MODES.DUE) {
    const [due, all] = await Promise.all([getDueAll(topicIds, opts), getAllCards(topicIds, opts)])
    const byId = new Map(all.map((c) => [c.id, c]))
    cards = due.map((d) => byId.get(d.card_id)).filter(Boolean)
  } else if (mode === MODES.NEW) {
    const [seen, all] = await Promise.all([getSeenAll(topicIds, opts), getAllCards(topicIds, opts)])
    cards = all.filter((c) => !seen.has(c.id)).slice(0, MAX_NEW_CARDS)
  } else {
    cards = await getAllCards(topicIds, opts)
  }
  return { cards, emptyMessage: cards.length ? null : EMPTY_MESSAGE[mode] }
}
