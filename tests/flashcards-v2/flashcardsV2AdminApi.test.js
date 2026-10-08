import { afterEach, describe, expect, test, vi } from 'vitest'
import * as api from '../../src/dashboard/admin/flashcards-v2/flashcardsV2AdminApi'
import { mockFetch } from './fetchMock'

const ADMIN = '/flashcards/v2/admin'
const TOPIC = '11111111-2222-4333-8444-555555555555'
const RUN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CARD = 'ABCDEF01-2345-4678-89AB-CDEF01234567'

afterEach(() => vi.restoreAllMocks())

describe('flashcardsV2AdminApi requests', () => {
  test('each function hits its route with the right method and body', async () => {
    const m = mockFetch(() => [200, { ok: true }])
    await api.listTopics()
    await api.getTopicReview(TOPIC)
    await api.editCard(CARD, { expectedVersion: 3, question: 'Q?' })
    await api.revalidateTopic(TOPIC, RUN)
    await api.getJob('job-1')
    await api.unpublishTopic(TOPIC, 'wrong dose')
    await api.retireCards(TOPIC, { runId: RUN, semanticKeys: ['a:b'] })
    await api.importTopicRun({ runId: RUN })
    await api.setTextbookIssue(RUN, 0, 2, { status: 'accepted', note: 'n' })

    const seen = m.calls.map((c) => [c.method, c.url.pathname, c.body])
    expect(seen).toEqual([
      ['GET', `${ADMIN}/topics`, undefined],
      ['GET', `${ADMIN}/topics/${TOPIC}/review`, undefined],
      ['PATCH', `${ADMIN}/cards/${CARD}`, { expectedVersion: 3, question: 'Q?' }],
      ['POST', `${ADMIN}/topics/${TOPIC}/revalidate`, { runId: RUN }],
      ['GET', `${ADMIN}/jobs/job-1`, undefined],
      ['POST', `${ADMIN}/topics/${TOPIC}/unpublish`, { reason: 'wrong dose' }],
      ['POST', `${ADMIN}/topics/${TOPIC}/retire`, { runId: RUN, semanticKeys: ['a:b'] }],
      ['POST', `${ADMIN}/import`, { runId: RUN }],
      ['PATCH', `${ADMIN}/runs/${RUN}/textbook-issues/0/2`, { status: 'accepted', note: 'n' }],
    ])
  })

  test('editCard sends only the fields given (never undefined keys)', async () => {
    const m = mockFetch(() => [200, {}])
    await api.editCard(CARD, { expectedVersion: 1, answerMarkdown: '- a' })
    expect(m.calls[0].body).toEqual({ expectedVersion: 1, answerMarkdown: '- a' })
  })

  test('publishTopic lowercases card ids in expectedVersions', async () => {
    const m = mockFetch(() => [200, { publishedIds: [] }])
    await api.publishTopic(TOPIC, { runId: RUN, expectedVersions: { [CARD]: 4 } })
    expect(m.calls[0].body).toEqual({ runId: RUN, expectedVersions: { [CARD.toLowerCase()]: 4 } })
  })

  test('expectedVersionsFor maps the run cards (not legacy) to lowercase id → contentVersion', () => {
    const cards = [
      { id: 'AAA', contentVersion: 2, legacy: false },
      { id: 'bbb', contentVersion: 5, legacy: true },
    ]
    expect(api.expectedVersionsFor(cards)).toEqual({ aaa: 2 })
  })
})

describe('flashcardsV2AdminApi errors keep status, code, details and kind', () => {
  const cases = [
    [409, { error: 'x', code: 'STALE_VERSION', details: { currentVersion: 4 } }, 'stale'],
    [409, { error: 'x', code: 'JOB_ALREADY_ACTIVE', details: { jobId: 'j1' } }, 'job_active'],
    [409, { error: 'x', code: 'PUBLISH_BLOCKED', details: { blockers: [], detail: 'd' } }, 'blocked'],
    [409, { error: 'x', code: 'PUBLISH_UNRESOLVED_CARDS', details: { blockers: [] } }, 'blocked'],
    [409, { error: 'x', code: 'PUBLISH_STALE_VERSION', details: 'id:3' }, 'stale'],
    [409, { error: 'x', code: 'STALE_RUN', details: { currentRunId: RUN } }, 'stale'],
    [503, { error: 'x', code: 'LLM_NOT_CONFIGURED' }, 'unavailable'],
    [404, { error: 'x', code: 'EDIT_CARD_NOT_FOUND', details: 'id' }, 'not_found'],
    [400, { error: 'x', code: 'INVALID_BODY', details: [{ path: 'a', message: 'b' }] }, 'validation'],
    [429, { error: 'x', code: 'RATE_LIMITED' }, 'rate_limited'],
    [403, { error: 'x', code: 'FORBIDDEN' }, 'forbidden'],
    [500, { error: 'Internal server error', code: 'PUBLISH_FAILED' }, 'server'],
  ]
  test.each(cases)('%i %o → kind %s', async (status, body, kind) => {
    mockFetch(() => [status, body])
    const err = await api.getJob('j').catch((e) => e)
    expect(err).toBeInstanceOf(api.FlashcardsAdminApiError)
    expect(err.status).toBe(status)
    expect(err.code).toBe(body.code)
    expect(err.details).toEqual(body.details ?? null)
    expect(err.kind).toBe(kind)
    expect(err.message).toBeTruthy()
  })

  test('a network failure becomes kind network and keeps the cause text', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    const err = await api.listTopics().catch((e) => e)
    expect(err.kind).toBe('network')
    expect(err.status).toBe(0)
    expect(err.message).toMatch(/TypeError: Failed to fetch/)
  })
})
