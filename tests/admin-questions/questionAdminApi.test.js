import { beforeEach, describe, expect, test, vi } from 'vitest'
import { authenticatedFetch } from '../../src/auth/token'
import {
  AdminQuestionApiError,
  adminQuestionUrl,
  fieldErrorsFromIssues,
  requestAdminQuestion,
} from '../../src/dashboard/admin/questions/questionAdminApi'

vi.mock('../../src/auth/token', () => ({ authenticatedFetch: vi.fn() }))

function jsonResponse(status, body) {
  return new Response(body === undefined ? '' : JSON.stringify(body), { status })
}

async function captureError(promise) {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('Expected request to fail')
}

beforeEach(() => {
  vi.mocked(authenticatedFetch).mockReset()
})

describe('adminQuestionUrl', () => {
  test('builds paths and drops empty query values', () => {
    expect(adminQuestionUrl('taxonomy')).toMatch(/\/admin\/questions\/taxonomy$/)
    expect(adminQuestionUrl('', { q: 'chest pain', topic_id: '', limit: 25 })).toMatch(
      /\/admin\/questions\?q=chest\+pain&limit=25$/,
    )
  })
})

describe('requestAdminQuestion', () => {
  test('serializes JSON bodies and returns parsed data', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(jsonResponse(201, { question: { id: 'q1' } }))
    const data = await requestAdminQuestion('', { method: 'POST', body: { stem: 'S' } })
    expect(data).toEqual({ question: { id: 'q1' } })
    const [, options] = vi.mocked(authenticatedFetch).mock.calls[0]
    expect(options).toMatchObject({ method: 'POST', body: '{"stem":"S"}' })
  })

  test('maps field validation issues', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      jsonResponse(400, {
        error: 'Question is invalid',
        issues: [
          { code: 'required', field: 'stem', message: 'Question stem is required.' },
          { code: 'duplicate', field: 'options', message: 'Option 2 duplicates another option.' },
        ],
      }),
    )
    const error = await captureError(requestAdminQuestion('', { method: 'POST', body: {} }))
    expect(error).toBeInstanceOf(AdminQuestionApiError)
    expect(error.kind).toBe('validation')
    expect(fieldErrorsFromIssues(error.issues)).toEqual({
      stem: ['Question stem is required.'],
      options: ['Option 2 duplicates another option.'],
    })
  })

  test('reports version conflicts with the current version', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      jsonResponse(409, { error: 'Changed', code: 'QUESTION_VERSION_CONFLICT', current_version: 4 }),
    )
    const error = await captureError(requestAdminQuestion('/q1', { method: 'PATCH', body: {} }))
    expect(error).toMatchObject({ kind: 'conflict', status: 409, currentVersion: 4 })
  })

  test('distinguishes an active-question lock from a version conflict', async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      jsonResponse(409, { error: 'Locked', code: 'QUESTION_ACTIVE_EDIT_FORBIDDEN' }),
    )
    const error = await captureError(requestAdminQuestion('/q1', { method: 'PATCH', body: {} }))
    expect(error.kind).toBe('active_locked')
  })

  test.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [500, 'server'],
  ])('classifies %s as %s even without a JSON body', async (status, kind) => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response('not json', { status }))
    const error = await captureError(requestAdminQuestion('/q1'))
    expect(error.kind).toBe(kind)
    expect(error.message).toBeTruthy()
  })

  test('turns fetch failures into a network error', async () => {
    vi.mocked(authenticatedFetch).mockRejectedValue(new TypeError('Failed to fetch'))
    const error = await captureError(requestAdminQuestion('/q1'))
    expect(error).toMatchObject({ kind: 'network', status: 0 })
  })
})
