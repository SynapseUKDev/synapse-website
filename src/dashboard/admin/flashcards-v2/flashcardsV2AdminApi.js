import { authenticatedFetch } from '../../../auth/token'

// Client for the Flashcards V2 admin review API (/flashcards/v2/admin/*, backend
// flashcardsV2AdminReviewRoutes.ts + flashcardsV2AdminRoutes.ts). Every error body is
// {error, code, details?}; it becomes a FlashcardsAdminApiError that keeps status, code and details
// verbatim and adds a `kind` so screens branch without re-reading status codes.

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const ADMIN_PATH = '/flashcards/v2/admin'

const PUBLISH_BLOCKER_CODES = new Set(['PUBLISH_RUN_NOT_READY', 'PUBLISH_UNRESOLVED_CARDS', 'PUBLISH_BLOCKED'])
const STALE_CODES = new Set(['STALE_VERSION', 'STALE_RUN', 'PUBLISH_STALE_RUN', 'PUBLISH_STALE_VERSION', 'RETIRE_STALE_RUN', 'IMPORT_STALE_RUN'])

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
    if (PUBLISH_BLOCKER_CODES.has(code)) return 'blocked'
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
  blocked: 'Publishing is blocked.',
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
      message: typeof json?.error === 'string' && json.error ? json.error : DEFAULT_MESSAGES[kind],
    })
  }
  return readJson(response)
}

const seg = encodeURIComponent

/** GET /topics → {topics: [{topicId, topicName, specialtyName, reviewStatus, counts, ...}]} */
export function listTopics({ signal } = {}) {
  return request('/topics', { signal })
}

/** GET /topics/:id/review → {review, run, cards, blockers, diff}. 404 when the topic has no review. */
export function getTopicReview(topicId, { signal } = {}) {
  return request(`/topics/${seg(topicId)}/review`, { signal })
}

/** PATCH /cards/:id → refreshed AdminCardDTO. 409 STALE_VERSION {currentVersion}. */
export function editCard(cardId, { expectedVersion, question, answerMarkdown }) {
  const body = { expectedVersion }
  if (question !== undefined) body.question = question
  if (answerMarkdown !== undefined) body.answerMarkdown = answerMarkdown
  return request(`/cards/${seg(cardId)}`, { method: 'PATCH', body })
}

/** POST /topics/:id/revalidate → 202 {jobId}; 409 JOB_ALREADY_ACTIVE {jobId}; 503 LLM_NOT_CONFIGURED. */
export function revalidateTopic(topicId, runId) {
  return request(`/topics/${seg(topicId)}/revalidate`, { method: 'POST', body: { runId } })
}

/** GET /jobs/:id → {id, kind, status, attempts, result?, error?, createdAt, finishedAt}. */
export function getJob(jobId, { signal } = {}) {
  return request(`/jobs/${seg(jobId)}`, { signal })
}

/** Card ids lowercased: the RPC compares text keys, so upper case would read as a stale version. */
function lowercaseKeys(versions) {
  return Object.fromEntries(Object.entries(versions || {}).map(([k, v]) => [String(k).toLowerCase(), v]))
}

/**
 * expectedVersions for publish: exactly the current run's active cards (legacy cards are not part of
 * the run; the RPC requires the set to match), id lowercase → contentVersion.
 */
export function expectedVersionsFor(cards) {
  return lowercaseKeys(Object.fromEntries((cards || []).filter((c) => !c.legacy).map((c) => [c.id, c.contentVersion])))
}

/** POST /topics/:id/publish → {publishedIds, alreadyPublishedIds, mediaPendingIds, ...}. */
export function publishTopic(topicId, { runId, expectedVersions }) {
  return request(`/topics/${seg(topicId)}/publish`, {
    method: 'POST',
    body: { runId, expectedVersions: lowercaseKeys(expectedVersions) },
  })
}

/** POST /topics/:id/unpublish {reason} → {topicId, unpublishedIds}. */
export function unpublishTopic(topicId, reason) {
  return request(`/topics/${seg(topicId)}/unpublish`, { method: 'POST', body: { reason } })
}

/** POST /topics/:id/retire {runId, semanticKeys} → {topicId, runId, retired}. */
export function retireCards(topicId, { runId, semanticKeys }) {
  return request(`/topics/${seg(topicId)}/retire`, { method: 'POST', body: { runId, semanticKeys } })
}

/** POST /import with a parsed TopicRun artifact (sent as the JSON body object). */
export function importTopicRun(artifact) {
  return request('/import', { method: 'POST', body: artifact })
}

/** PATCH /runs/:runId/textbook-issues/:reviewIndex/:issueIndex {status, note}. Never edits the textbook. */
export function setTextbookIssue(runId, reviewIndex, issueIndex, { status, note }) {
  return request(`/runs/${seg(runId)}/textbook-issues/${seg(reviewIndex)}/${seg(issueIndex)}`, {
    method: 'PATCH',
    body: { status, note },
  })
}

/**
 * POST /cards/:id/media (multipart: file, alt, expectedVersion) → 201 {cardId, asset: {id, url, alt,
 * width, height}, contentVersion, qaStatus}. Attaching replaces any current image. 409 STALE_VERSION
 * {currentVersion}; 413 IMAGE_TOO_LARGE; 400 with an IMAGE_* code when the file is refused.
 */
export function uploadCardMedia(cardId, { file, alt, expectedVersion }) {
  const form = new FormData()
  form.append('expectedVersion', String(expectedVersion))
  form.append('alt', alt)
  form.append('file', file)
  return request(`/cards/${seg(cardId)}/media`, { method: 'POST', body: form })
}

/** DELETE /cards/:id/media {expectedVersion} → {cardId, contentVersion, qaStatus}. */
export function removeCardMedia(cardId, expectedVersion) {
  return request(`/cards/${seg(cardId)}/media`, { method: 'DELETE', body: { expectedVersion } })
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
