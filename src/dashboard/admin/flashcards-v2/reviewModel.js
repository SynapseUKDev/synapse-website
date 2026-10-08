// Pure helpers for the admin review screen.

export const REVIEW_STATUSES = ['pending_review', 'needs_attention', 'approved', 'changes_requested']

/** Topic list filter: status "" = all, "none" = topics without a review; query matches topic or specialty. */
export function filterTopics(topics, { query, status }) {
  const q = query.trim().toLowerCase()
  return topics.filter((t) => {
    if (status === 'none' ? t.reviewStatus : status && t.reviewStatus !== status) return false
    if (!q) return true
    return `${t.topicName} ${t.specialtyName}`.toLowerCase().includes(q)
  })
}

export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

/** The final (last) review's verdict per semanticKey: {verdict, reason, correctedQuestion, correctedAnswerMarkdown}. */
export function finalVerdicts(run) {
  const reviews = Array.isArray(run?.reviews) ? run.reviews : []
  const last = reviews[reviews.length - 1]
  const map = new Map()
  for (const v of last?.cardVerdicts ?? []) if (v?.semanticKey) map.set(v.semanticKey, v)
  return map
}

const awaitsImage = (c) => c.qaStatus === 'media_pending' || (c.isMediaRequired && !c.media?.url)

/**
 * What the publish RPC will do with the current run's cards (mirrors flashcard_approve_and_publish):
 * validated cards that are not waiting for an image get published; media_pending cards, and media
 * cards without an attached image, stay unpublished until their image is attached.
 */
export function publishPlan(cards) {
  const run = (cards ?? []).filter((c) => !c.legacy)
  return {
    willPublish: run.filter((c) => c.qaStatus === 'validated' && !c.isPublished && !awaitsImage(c)),
    alreadyPublished: run.filter((c) => c.isPublished),
    awaitingImage: run.filter(awaitsImage),
  }
}

export function needsMediaPlaceholder(card) {
  return (card.isMediaRequired || !!card.mediaRequirement) && !card.media?.url
}

/** A short readable form of a review list entry (missingCards / lowYield / needsHumanVerification). */
export function entryText(entry) {
  if (entry == null) return ''
  if (typeof entry === 'string') return entry
  if (typeof entry !== 'object') return String(entry)
  const head = entry.semanticKey || entry.title || entry.topic || entry.question || ''
  const tail = entry.reason || entry.message || entry.why || ''
  if (head || tail) return [head, tail].filter(Boolean).join(': ')
  return JSON.stringify(entry)
}

export function formatTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString('en-GB')
}
