import { authenticatedFetch } from '../../../auth/token'

// Client for the Flashcards V2 admin API (/flashcards/v2/admin/*, backend flashcardsV2AdminCardRoutes.ts,
// flashcardsV2AdminReviewRoutes.ts, flashcardsV2AdminRoutes.ts, flashcardsV2MediaRoutes.ts and
// flashcardsV2ReportRoutes.ts). Every error body is
// {error, code, details?}; it becomes a FlashcardsAdminApiError that keeps status, code and details
// verbatim and adds a `kind` so screens branch without re-reading status codes.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const ADMIN_PATH = '/flashcards/v2/admin'

const STALE_CODES = new Set(['STALE_VERSION', 'STALE_RUN', 'RETIRE_STALE_RUN', 'IMPORT_STALE_RUN'])

// The card workflow RPC codes come back with the code itself as `error`; these say it in words.
const CODE_MESSAGES = {
  APPROVE_NEEDS_FRONT_IMAGE: 'Add a front image first.',
  APPROVE_HIDDEN: 'This card is hidden after learner reports. Resolve its reports first.',
  APPROVE_ALREADY_APPROVED: 'This card is already approved.',
  APPROVE_CARD_NOT_FOUND: 'This card no longer exists or was discarded.',
  DISCARD_CARD_NOT_FOUND: 'This card no longer exists or was discarded.',
}

export class FlashcardsAdminApiError extends Error {
  constructor({ status, kind, message, code = null, details = null, cause }) {
    super(message, cause === undefined ? undefined : { cause })
    this.name = 'FlashcardsAdminApiError'
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
  if (status === 413) return 'too_large'
  if (status === 429) return 'rate_limited'
  if (status === 503) return 'unavailable'
  if (status === 409) {
    if (code === 'JOB_ALREADY_ACTIVE') return 'job_active'
    if (STALE_CODES.has(code)) return 'stale'
    return 'conflict'
  }
  if (status === 400) return 'validation'
  return 'server'
}

const DEFAULT_MESSAGES = {
  unauthorized: 'Your session has expired. Sign in again.',
  forbidden: 'Your account does not have Flashcards V2 admin access (OSCE admin permission required).',
  not_found: 'Not found.',
  too_large: 'Images must be 8 MB or smaller.',
  rate_limited: 'Too many requests; try again in a minute.',
  unavailable: 'The service is unavailable.',
  job_active: 'A job for this topic is already running.',
  stale: 'This changed since it was loaded; reload.',
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

const isFormData = (body) => typeof FormData !== 'undefined' && body instanceof FormData

export function adminUrl(path) {
  return `${API_BASE}${ADMIN_PATH}${path}`
}

async function request(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await authenticatedFetch(adminUrl(path), {
      method,
      signal,
      // FormData goes as is: authenticatedFetch leaves its Content-Type to the browser (multipart boundary).
      body: body === undefined || isFormData(body) ? body : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new FlashcardsAdminApiError({
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
    throw new FlashcardsAdminApiError({
      status: response.status,
      kind,
      code,
      details: json?.details ?? null,
      message: CODE_MESSAGES[code] ?? (typeof json?.error === 'string' && json.error ? json.error : DEFAULT_MESSAGES[kind]),
    })
  }
  return readJson(response)
}

const seg = encodeURIComponent

/** GET /topics → {topics: [{topicId, topicName, specialtyName, reviewStatus, counts, ...}]} */
export function listTopics({ signal } = {}) {
  return request('/topics', { signal })
}

/** PATCH /cards/:id → refreshed AdminCardDTO (no topicName). 409 STALE_VERSION details {currentVersion}. */
export function editCard(cardId, { expectedVersion, question, answerMarkdown }) {
  const body = { expectedVersion }
  if (question !== undefined) body.question = question
  if (answerMarkdown !== undefined) body.answerMarkdown = answerMarkdown
  return request(`/cards/${seg(cardId)}`, { method: 'PATCH', body })
}

/** POST /topics/:id/retire {runId, semanticKeys} → {topicId, runId, retired}. */
export function retireCards(topicId, { runId, semanticKeys }) {
  return request(`/topics/${seg(topicId)}/retire`, { method: 'POST', body: { runId, semanticKeys } })
}

/** POST /import with a parsed TopicRun artifact (sent as the JSON body object). */
export function importTopicRun(artifact) {
  return request('/import', { method: 'POST', body: artifact })
}

// ---- Per-card workflow (backend flashcardsV2AdminCardRoutes.ts, sql/105) ----

/**
 * GET /cards?state&kind&topicId&specialtyId&q&cursor&limit → {cards: AdminCardDto[] (+ topicName,
 * specialtyName, hiddenReason), nextCursor}. state: needs_action (server default) | approved | live |
 * all; kind: flagged | needs_image (omitted = both). `q` matches the question or the topic name.
 */
export function listAdminCards({ state, kind, topicId, specialtyId, q, cursor, limit, signal } = {}) {
  const params = new URLSearchParams()
  if (state) params.set('state', state)
  if (kind) params.set('kind', kind)
  if (topicId) params.set('topicId', topicId)
  if (specialtyId) params.set('specialtyId', specialtyId)
  const search = typeof q === 'string' ? q.trim() : ''
  if (search) params.set('q', search)
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  const qs = params.toString()
  return request(`/cards${qs ? `?${qs}` : ''}`, { signal })
}

/** GET /cards/counts → {needsAction, flagged, needsImage, approved, live}. */
export function getAdminCardCounts({ signal } = {}) {
  return request('/cards/counts', { signal })
}

/**
 * POST /cards/:id/approve {expectedVersion} → the approved AdminCardDto. 409 STALE_VERSION,
 * APPROVE_NEEDS_FRONT_IMAGE, APPROVE_HIDDEN, APPROVE_ALREADY_APPROVED; 404 APPROVE_CARD_NOT_FOUND.
 */
export function approveCard(cardId, { expectedVersion }) {
  return request(`/cards/${seg(cardId)}/approve`, { method: 'POST', body: { expectedVersion } })
}

/** POST /cards/:id/discard {expectedVersion} → {retired: 1}. The card is retired (deactivated). */
export function discardCard(cardId, { expectedVersion }) {
  return request(`/cards/${seg(cardId)}/discard`, { method: 'POST', body: { expectedVersion } })
}

/** POST /cards/live {cardIds, live} → {changed, skipped: [{id, reason}]}. Ineligible cards are skipped. */
export function setCardsLive(cardIds, live) {
  return request('/cards/live', { method: 'POST', body: { cardIds, live: !!live } })
}

/** POST /topics/:id/live {live} → {changed, skipped: [{id, reason}]}. */
export function setTopicLive(topicId, live) {
  return request(`/topics/${seg(topicId)}/live`, { method: 'POST', body: { live: !!live } })
}

/** POST /live-all {confirm: 'PUSH ALL'} → {changed, skipped, skippedCount}: every approved card goes live. */
export function pushAllLive() {
  return request('/live-all', { method: 'POST', body: { confirm: 'PUSH ALL' } })
}

/**
 * POST /cards/:id/media (multipart: file, expectedVersion, alt, side, attribution?, license?,
 * sourceUrl?) → 201 {cardId, side, asset: {id, url, alt, width, height, attribution, license,
 * sourceUrl}, contentVersion, qaStatus}. Attaching replaces that side's image. 409 STALE_VERSION;
 * 413 IMAGE_TOO_LARGE; 400 with an IMAGE_* / MEDIA_ARGS_INVALID code when refused. Blank optional
 * fields are left out (the server stores them as null).
 */
export function uploadCardMedia(cardId, { file, alt, side = 'front', attribution, license, sourceUrl, expectedVersion }) {
  const form = new FormData()
  form.append('expectedVersion', String(expectedVersion))
  form.append('side', side)
  form.append('alt', alt)
  const optional = { attribution, license, sourceUrl }
  for (const [key, value] of Object.entries(optional)) {
    if (typeof value === 'string' && value.trim()) form.append(key, value.trim())
  }
  form.append('file', file)
  return request(`/cards/${seg(cardId)}/media`, { method: 'POST', body: form })
}

/** DELETE /cards/:id/media?side=front|back {expectedVersion} → {cardId, contentVersion, qaStatus}. */
export function removeCardMedia(cardId, { side = 'front', expectedVersion }) {
  return request(`/cards/${seg(cardId)}/media?side=${seg(side)}`, { method: 'DELETE', body: { expectedVersion } })
}

// ---- Learner reports (backend flashcardsV2ReportRoutes.ts) ----

/**
 * GET /reports?status&cursor&limit → {reports, nextCursor}. Rows carry the distinct serious-reporter
 * count only — never a learner id. `cursor` is the opaque nextCursor of the previous page.
 */
export function listReports({ status, cursor, limit, signal } = {}) {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (cursor) params.set('cursor', cursor)
  if (limit) params.set('limit', String(limit))
  const search = params.toString()
  return request(`/reports${search ? `?${search}` : ''}`, { signal })
}

/** PATCH /reports/:id {status: resolved|dismissed, note?, unhide} → {reportId, status, unhidden, hidden}. */
export function resolveReport(reportId, { status, note, unhide = false }) {
  const body = { status, unhide: !!unhide }
  if (typeof note === 'string' && note.trim()) body.note = note.trim()
  return request(`/reports/${seg(reportId)}`, { method: 'PATCH', body })
}

/**
 * PATCH /cards/:id/reports/resolve-all {contentVersion, status, note?, unhide} — every open /
 * reassessing / confirmed report on that card version → {resolvedReportIds, unhidden, hidden, ...}.
 * 404 NO_OPEN_REPORTS when there is nothing left to resolve.
 */
export function resolveAllReports(cardId, { contentVersion, status, note, unhide = false }) {
  const body = { contentVersion, status, unhide: !!unhide }
  if (typeof note === 'string' && note.trim()) body.note = note.trim()
  return request(`/cards/${seg(cardId)}/reports/resolve-all`, { method: 'PATCH', body })
}
