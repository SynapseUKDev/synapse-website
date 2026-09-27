import { authenticatedFetch } from '../../../auth/token'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const ADMIN_QUESTIONS_PATH = '/admin/questions'

export const VERSION_CONFLICT_CODE = 'QUESTION_VERSION_CONFLICT'
export const ACTIVE_EDIT_FORBIDDEN_CODE = 'QUESTION_ACTIVE_EDIT_FORBIDDEN'

export function adminQuestionUrl(path = '', query) {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return `${API_BASE}${ADMIN_QUESTIONS_PATH}${suffix}${search ? `?${search}` : ''}`
}

/**
 * One error type for every admin question screen. `kind` lets callers branch
 * without re-reading status codes: validation issues map to fields, conflicts
 * keep local edits, and auth failures stop further mutation.
 */
export class AdminQuestionApiError extends Error {
  constructor({ status, kind, message, code = null, issues = [], currentVersion = null }) {
    super(message)
    this.name = 'AdminQuestionApiError'
    this.status = status
    this.kind = kind
    this.code = code
    this.issues = issues
    this.currentVersion = currentVersion
  }
}

function errorKind(status, code) {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409 && code === VERSION_CONFLICT_CODE) return 'conflict'
  if (status === 409 && code === ACTIVE_EDIT_FORBIDDEN_CODE) return 'active_locked'
  if (status === 400 || status === 409 || status === 413 || status === 422) return 'validation'
  return 'server'
}

const DEFAULT_MESSAGES = {
  unauthorized: 'Your session has expired. Sign in again; your unsaved changes are still on this page.',
  forbidden: 'Your account no longer has question-bank admin access. Nothing was saved.',
  not_found: 'This item no longer exists.',
  active_locked: 'Active questions cannot be edited. Deactivate the question first.',
  conflict: 'Someone else saved this question after you opened it. Your changes have not been saved.',
  validation: 'Some fields need attention.',
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

export async function toAdminQuestionApiError(response) {
  const body = await readJson(response)
  const code = typeof body?.code === 'string' ? body.code : null
  const kind = errorKind(response.status, code)
  const issues = Array.isArray(body?.issues) ? body.issues : []
  const message = typeof body?.error === 'string' && body.error ? body.error : DEFAULT_MESSAGES[kind]
  return new AdminQuestionApiError({
    status: response.status,
    kind,
    message,
    code,
    issues,
    currentVersion: Number.isInteger(body?.current_version) ? body.current_version : null,
  })
}

export async function requestAdminQuestion(path = '', { method = 'GET', body, query, signal } = {}) {
  let response
  try {
    response = await authenticatedFetch(adminQuestionUrl(path, query), {
      method,
      signal,
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new AdminQuestionApiError({
      status: 0,
      kind: 'network',
      message: 'Could not reach the server. Check your connection; your changes are still on this page.',
    })
  }
  if (!response.ok) throw await toAdminQuestionApiError(response)
  return readJson(response)
}

/** Groups server field issues by field path, e.g. { stem: ['Required.'] }. */
export function fieldErrorsFromIssues(issues = []) {
  const byField = {}
  for (const issue of issues) {
    const field = issue?.field || 'question'
    if (!byField[field]) byField[field] = []
    byField[field].push(issue?.message || 'Invalid value.')
  }
  return byField
}

export function fetchTaxonomy(options) {
  return requestAdminQuestion('/taxonomy', options)
}

export function listQuestions(query, options) {
  return requestAdminQuestion('', { ...options, query })
}

export function fetchQuestion(questionId, options) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}`, options)
}

export function createQuestion(payload) {
  return requestAdminQuestion('', { method: 'POST', body: payload })
}

export function updateQuestion(questionId, expectedVersion, payload) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}`, {
    method: 'PATCH',
    body: { ...payload, expected_version: expectedVersion },
  })
}

let taxonomyPromise = null

/** Taxonomy changes rarely; inline editors opened repeatedly share one request per page load. */
export function fetchTaxonomyCached() {
  if (!taxonomyPromise) {
    taxonomyPromise = fetchTaxonomy().catch((error) => {
      taxonomyPromise = null
      throw error
    })
  }
  return taxonomyPromise
}

// ---- Bulk import ----

/** Sends the raw file text; the server parses, validates and hashes it. */
export function validateImportFile(filename, content) {
  return requestAdminQuestion('/imports/validate', { method: 'POST', body: { filename, content } })
}

export function listImportBatches(options) {
  return requestAdminQuestion('/imports', options)
}

export function fetchImportBatch(batchId, query, options) {
  return requestAdminQuestion(`/imports/${encodeURIComponent(batchId)}`, { ...options, query })
}

/**
 * Confirms decisions and processes records. A 207 (partial success) is a
 * normal outcome here, not an error.
 */
export function confirmImportBatch(batchId, decisions) {
  return requestAdminQuestion(`/imports/${encodeURIComponent(batchId)}/confirm`, {
    method: 'POST',
    body: { decisions },
  })
}

// ---- Images ----

export function uploadQuestionImage(questionId, { file, expectedVersion, alt, caption, credit, replaceImageId }) {
  const form = new FormData()
  form.append('expected_version', String(expectedVersion))
  if (alt) form.append('alt', alt)
  if (caption) form.append('caption', caption)
  if (credit) form.append('credit', credit)
  if (replaceImageId) form.append('replace_image_id', replaceImageId)
  form.append('file', file)
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}/images`, { method: 'POST', body: form })
}

export function updateQuestionImages(questionId, expectedVersion, images) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}/images`, {
    method: 'PUT',
    body: { expected_version: expectedVersion, images },
  })
}

export function removeQuestionImage(questionId, imageId, expectedVersion) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}/images/${encodeURIComponent(imageId)}`, {
    method: 'DELETE',
    query: { expected_version: expectedVersion },
  })
}

// ---- Activation ----

export function activateQuestion(questionId, { expectedVersion, clinicalSourceReference, attested }) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}/activate`, {
    method: 'POST',
    body: {
      expected_version: expectedVersion,
      clinical_source_reference: clinicalSourceReference,
      clinical_review_attested: attested,
    },
  })
}

export function deactivateQuestion(questionId, expectedVersion) {
  return requestAdminQuestion(`/${encodeURIComponent(questionId)}/deactivate`, {
    method: 'POST',
    body: { expected_version: expectedVersion },
  })
}
