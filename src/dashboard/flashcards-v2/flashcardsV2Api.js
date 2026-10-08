import { authenticatedFetch } from '../../auth/token'

// Client for the Flashcards V2 learner API (/flashcards/v2/*). Every error body from the server is
// {error, code, details?}; it becomes a FlashcardsApiError whose `kind` lets screens branch without
// re-reading status codes.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const V2_PATH = '/flashcards/v2'

/** Server page size maximum; asking for it keeps the number of round trips down. */
export const PAGE_LIMIT = 200
/** Upper bound on cards (and SRS ids) pulled into one session build. */
export const CARD_CAP = 2000

export const STALE_VERSION_CODE = 'STALE_VERSION'

export class FlashcardsApiError extends Error {
  constructor({ status, kind, message, code = null, details = null, cause }) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'FlashcardsApiError'
    this.status = status
    this.kind = kind
    this.code = code
    this.details = details
  }
}

function errorKind(status, code) {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 429) return 'rate_limited'
  if (status === 409 && code === STALE_VERSION_CODE) return 'stale'
  if (status === 409) return 'conflict'
  if (status === 400) return 'validation'
  return 'server'
}

const DEFAULT_MESSAGES = {
  unauthorized: 'Your session has expired. Sign in again.',
  forbidden: 'Your account does not have access to Flashcards V2.',
  not_found: 'This card is no longer available.',
  rate_limited: 'Too many requests; try again later.',
  stale: 'This card was updated since it was loaded.',
  conflict: 'The server rejected this request as a conflict.',
  validation: 'The server rejected the request as invalid.',
  server: 'The server could not complete the request. Try again.',
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export function flashcardsUrl(path, query) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '' && value !== false) params.set(key, String(value))
  }
  const search = params.toString()
  return `${API_BASE}${V2_PATH}${path}${search ? `?${search}` : ''}`
}

async function request(path, { method = 'GET', body, query, signal, cache } = {}) {
  let response
  try {
    response = await authenticatedFetch(flashcardsUrl(path, query), {
      method,
      signal,
      ...(cache ? { cache } : {}),
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new FlashcardsApiError({
      status: 0,
      kind: 'network',
      message: `Could not reach the server (${error?.name || 'Error'}: ${error?.message || 'unknown'}). Check your connection.`,
      cause: error,
    })
  }
  if (!response.ok) {
    const json = await readJson(response)
    const code = typeof json?.code === 'string' ? json.code : null
    const kind = errorKind(response.status, code)
    throw new FlashcardsApiError({
      status: response.status,
      kind,
      code,
      details: json?.details ?? null,
      message: typeof json?.error === 'string' && json.error ? json.error : DEFAULT_MESSAGES[kind],
    })
  }
  return readJson(response)
}

const previewQuery = (preview) => (preview ? { preview: 1 } : {})

// ---- Reads ----

export function getTopics({ preview, signal } = {}) {
  return request('/topics', { query: previewQuery(preview), signal })
}

export function getCardsPage({ topicId, cursor, limit = PAGE_LIMIT, preview, signal, cache } = {}) {
  return request('/cards', { query: { topic_id: topicId, cursor, limit, ...previewQuery(preview) }, signal, cache })
}

export function getDuePage({ topicId, cursor, limit = PAGE_LIMIT, preview, signal } = {}) {
  return request('/srs/due', { query: { topic_id: topicId, cursor, limit, ...previewQuery(preview) }, signal })
}

export function getSeenPage({ topicId, cursor, limit = PAGE_LIMIT, preview, signal } = {}) {
  return request('/srs/seen', { query: { topic_id: topicId, cursor, limit, ...previewQuery(preview) }, signal })
}

export function getStats({ topicId, preview, signal } = {}) {
  return request('/srs/stats', { query: { topic_id: topicId, ...previewQuery(preview) }, signal })
}

/**
 * Follows nextCursor for each topic in turn until it is null, collecting `pick(page)` items, and stops
 * once `cap` items are collected (the rest of the bank is never requested).
 */
async function collectPages(topicIds, fetchPage, pick, { cap = CARD_CAP, ...opts } = {}) {
  const out = []
  for (const topicId of topicIds) {
    let cursor
    do {
      const page = await fetchPage({ ...opts, topicId, cursor })
      for (const item of pick(page) ?? []) {
        if (out.length >= cap) return out
        out.push(item)
      }
      cursor = page?.nextCursor ?? null
    } while (cursor && out.length < cap)
    if (out.length >= cap) break
  }
  return out
}

/** Every card of the given topics (CardDTO, or AdminCardDTO with preview), capped at CARD_CAP. */
export function getAllCards(topicIds, opts) {
  return collectPages(topicIds, getCardsPage, (p) => p?.cards, opts)
}

/** Due rows ({card_id, next_due_at, ...}) for the given topics, most overdue first per topic. */
export function getDueAll(topicIds, opts) {
  return collectPages(topicIds, getDuePage, (p) => p?.due, opts)
}

/** Ids of cards the learner has seen at their current content version, for the given topics. */
export async function getSeenAll(topicIds, opts) {
  return new Set(await collectPages(topicIds, getSeenPage, (p) => p?.seen, opts))
}

/** The current server copy of one card (there is no single-card route), or null when it is gone. */
export async function fetchCurrentCard(card, opts) {
  // no-store: a post-409 / stale refetch must never be answered from the browser's cached page.
  const cards = await getAllCards([card.topicId], { ...opts, cache: 'no-store' })
  return cards.find((c) => c.id === card.id) ?? null
}

// ---- Ratings ----

function newReviewId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  // RFC 4122 v4 from getRandomValues (older Safari lacks randomUUID outside secure contexts).
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * One rating = one review_id, generated here exactly once. Retries send the same object, so the server
 * (idempotent on review_id) never advances the schedule twice for one press.
 */
export function createRating({ cardId, confidence, contentVersion }) {
  return Object.freeze({ cardId, confidence, contentVersion, reviewId: newReviewId() })
}

/** A save that gets no answer within this long becomes a retryable failure (same review_id). */
export const RECORD_TIMEOUT_MS = 20_000

/** POST /srs/record → {success, next_due_at, interval_days, repetitions}. 409 STALE_VERSION → kind 'stale'. */
export async function recordReview(rating, { preview, signal } = {}) {
  if (!rating?.reviewId) throw new Error('recordReview needs a rating from createRating() (it carries the review_id)')
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort()
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', onCallerAbort, { once: true })
  }
  let timer
  const timedOut = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(
        new FlashcardsApiError({
          status: 0,
          kind: 'timeout',
          message: 'Saving timed out. Check your connection and retry.',
        }),
      )
    }, RECORD_TIMEOUT_MS)
  })
  try {
    // Raced as well as aborted: a fetch that ignores its signal must still settle.
    return await Promise.race([
      request('/srs/record', {
        method: 'POST',
        query: previewQuery(preview),
        signal: controller.signal,
        body: {
          card_id: rating.cardId,
          confidence: rating.confidence,
          content_version: rating.contentVersion,
          review_id: rating.reviewId,
        },
      }),
      timedOut,
    ])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onCallerAbort)
  }
}

// ---- Reports ----

/**
 * POST /cards/:id/reports {category, details?, contentVersion} → {reportId, status} (201 new, 200 when
 * this learner already reported this version: same body). 409 STALE_VERSION → kind 'stale';
 * 404 → kind 'not_found'; 429 → kind 'rate_limited'. Blank details are not sent.
 */
export function submitReport(cardId, { category, details, contentVersion }, { signal } = {}) {
  const body = { category, contentVersion }
  const text = typeof details === 'string' ? details.trim() : ''
  if (text) body.details = text
  return request(`/cards/${encodeURIComponent(cardId)}/reports`, { method: 'POST', body, signal })
}
