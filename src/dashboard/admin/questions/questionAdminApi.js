import { authenticatedFetch } from '../../../auth/token'

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/$/, '')
const ADMIN_QUESTIONS_PATH = '/admin/questions'

export function adminQuestionUrl(path = '') {
  const suffix = path ? (path.startsWith('/') ? path : `/${path}`) : ''
  return `${API_BASE}${ADMIN_QUESTIONS_PATH}${suffix}`
}

// Story-specific methods and structured error handling are added in T011–T013.
export function requestAdminQuestion(path = '', options = {}) {
  return authenticatedFetch(adminQuestionUrl(path), options)
}
