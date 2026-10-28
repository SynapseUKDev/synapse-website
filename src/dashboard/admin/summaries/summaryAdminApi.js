import { authenticatedFetch } from '../../../auth/token'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const ADMIN_SUMMARIES_PATH = '/admin/summaries'

export const SUMMARIES_PAGE_PATH = '/dashboard/admin/summaries'
export const ROW_VERSION_CONFLICT_CODE = 'ROW_VERSION_CONFLICT'

export const CATEGORY_LABELS = {
  diagnosis: 'Diagnosis',
  investigations: 'Investigations',
  management: 'Management',
  pathophysiology: 'Pathophysiology',
  clinical_features: 'Clinical features',
  epidemiology_risk_factors: 'Epidemiology and risk factors',
  complications: 'Complications',
  prognosis: 'Prognosis',
  prevention_screening: 'Prevention and screening',
  interpretation: 'Interpretation',
  professional_practice: 'Professional practice',
  overview: 'Overview',
  drugs: 'Drugs',
}

export const REASON_LABELS = {
  unclassified: 'Not classified',
  needs_classification_review: 'Classification needs review',
  scope_unresolved: 'Scope unresolved',
  source_missing: 'Textbook source missing',
  source_ambiguous: 'Textbook source ambiguous',
  validation_failed: 'Failed validation',
  question_conflict: 'Conflicts with a question key',
  api_error: 'Generation error',
}

export function summaryAdminUrl(path = '', query) {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return `${API_BASE}${ADMIN_SUMMARIES_PATH}${suffix}${search ? `?${search}` : ''}`
}

/** kind: unauthorized | forbidden | not_found | conflict | validation | network | server. */
export class SummaryAdminApiError extends Error {
  constructor({ status, kind, message, code = null, fields = [] }) {
    super(message)
    this.name = 'SummaryAdminApiError'
    this.status = status
    this.kind = kind
    this.code = code
    this.fields = fields
  }
}

const DEFAULT_MESSAGES = {
  unauthorized: 'Your session has expired. Sign in again; your unsaved changes are still on this page.',
  forbidden: 'Your account no longer has question-bank admin access. Nothing was saved.',
  not_found: 'This summary no longer exists.',
  conflict: 'This summary was changed by someone else after you opened it. Reload to see the latest version. Your text has been kept.',
  validation: 'Some fields need attention.',
  server: 'The server could not complete the request. Try again.',
}

function errorKind(status, code) {
  if (status === 401) return 'unauthorized'
  if (status === 403) return 'forbidden'
  if (status === 404) return 'not_found'
  if (status === 409 && code === ROW_VERSION_CONFLICT_CODE) return 'conflict'
  if (status === 400 || status === 409) return 'validation'
  return 'server'
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

async function requestSummaries(path = '', { method = 'GET', body, query, signal } = {}) {
  let response
  try {
    response = await authenticatedFetch(summaryAdminUrl(path, query), {
      method,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new SummaryAdminApiError({
      status: 0,
      kind: 'network',
      message: 'Could not reach the server. Check your connection; your changes are still on this page.',
    })
  }
  if (!response.ok) {
    const data = await readJson(response)
    const code = typeof data?.code === 'string' ? data.code : null
    const kind = errorKind(response.status, code)
    throw new SummaryAdminApiError({
      status: response.status,
      kind,
      code,
      fields: Array.isArray(data?.fields) ? data.fields : [],
      message: kind === 'conflict' ? DEFAULT_MESSAGES.conflict : data?.error || DEFAULT_MESSAGES[kind],
    })
  }
  return readJson(response)
}

const id = (value) => `/${encodeURIComponent(value)}`

export const listSummaries = (query, options) => requestSummaries('', { ...options, query })
export const fetchCoverage = (options) => requestSummaries('/coverage', options)
export const fetchQueue = (query, options) => requestSummaries('/queue', { ...options, query })
export const fetchSummary = (summaryId, options) => requestSummaries(id(summaryId), options)
/** Linked questions in the practice payload shape, each carrying the given version (admin preview). */
export const fetchPracticePreview = (summaryId, versionId, options) =>
  requestSummaries(`${id(summaryId)}/preview`, { ...options, query: { version_id: versionId } })

export function createVersion(summaryId, { title, bodyMarkdown, baseVersionId, expectedRowVersion }) {
  return requestSummaries(`${id(summaryId)}/versions`, {
    method: 'POST',
    body: { title, body_markdown: bodyMarkdown, base_version_id: baseVersionId, expected_row_version: expectedRowVersion },
  })
}

export function publishVersion(summaryId, versionId, expectedRowVersion) {
  return requestSummaries(`${id(summaryId)}/publish`, {
    method: 'POST',
    body: { version_id: versionId, expected_row_version: expectedRowVersion },
  })
}

export function withdrawSummary(summaryId, expectedRowVersion) {
  return requestSummaries(`${id(summaryId)}/withdraw`, {
    method: 'POST',
    body: { expected_row_version: expectedRowVersion },
  })
}

/** Permanent: the summary, its versions, manual selections of it and learner reports about it. */
export function deleteSummary(summaryId, expectedRowVersion) {
  return requestSummaries(id(summaryId), { method: 'DELETE', query: { expected_row_version: expectedRowVersion } })
}

/** A question's summary: { mode: 'automatic' | 'manual', manual_summary, automatic_summary, learning_summary, … }. */
export const fetchQuestionLink = (questionId, options) => requestSummaries(`/questions${id(questionId)}/link`, options)
export const setQuestionLink = (questionId, summaryId) =>
  requestSummaries(`/questions${id(questionId)}/link`, { method: 'PUT', body: { summary_id: summaryId } })
export const clearQuestionLink = (questionId) => requestSummaries(`/questions${id(questionId)}/link`, { method: 'DELETE' })

/** "Croup → Management", or "Croup → Management (Pregnancy)" for a narrower scope. */
export function summaryLabel(summary) {
  if (!summary) return ''
  const subject = summary.kind === 'drug' ? summary.subject_label : summary.topic?.name || summary.subject_label
  const scope = summary.scope_label && summary.scope_label !== 'General' ? ` (${summary.scope_label})` : ''
  return `${subject} → ${CATEGORY_LABELS[summary.question_category] || summary.question_category}${scope}`
}

export function redraftSummary(summaryId, expectedRowVersion) {
  return requestSummaries(`${id(summaryId)}/redraft`, {
    method: 'POST',
    body: { expected_row_version: expectedRowVersion },
  })
}

function textbookHref(slug, anchor) {
  if (!slug) return null
  const base = `/dashboard/textbook/topic/${encodeURIComponent(slug)}`
  return anchor ? `${base}#sec-${encodeURIComponent(anchor)}` : base
}

/**
 * The learner payload shape (contracts/learner-summary.md) for one version, so the admin
 * preview renders through the same TopicSummary component learners see.
 */
export function toPreviewSummary(summary, version) {
  if (!summary || !version) return null
  const href = textbookHref(version.textbook_slug, version.textbook_anchor)
  const section = version.textbook_anchor
    ? version.textbook_anchor.replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase())
    : ''
  const sources = []
  if (href) sources.push({ kind: 'textbook', label: section ? `${summary.subject_label} — ${section}` : summary.subject_label, href })
  for (const ref of Array.isArray(version.external_references) ? version.external_references : []) {
    if (!ref?.label) continue
    sources.push({
      kind: 'reference',
      label: ref.label,
      url: typeof ref.url === 'string' && /^https:\/\//i.test(ref.url) ? ref.url : null,
      version: ref.version ?? null,
      accessed_on: ref.accessed_on ?? null,
    })
  }
  return {
    summary_id: summary.id,
    version_id: version.id,
    version: version.version,
    title: version.title,
    body_markdown: version.body_markdown,
    question_category: summary.question_category,
    subject_label: summary.subject_label,
    scope_label: summary.scope_label,
    sources,
    reviewed_at: version.reviewed_at,
    textbook_href: href,
  }
}
