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
    await api.editCard(CARD, { expectedVersion: 3, question: 'Q?' })
    await api.retireCards(TOPIC, { runId: RUN, semanticKeys: ['a:b'] })
    await api.importTopicRun({ runId: RUN })
    await api.getAdminCardCounts()
    await api.approveCard(CARD, { expectedVersion: 2 })
    await api.discardCard(CARD, { expectedVersion: 5 })
    await api.setCardsLive([CARD], true)
    await api.setTopicLive(TOPIC, false)
    await api.pushAllLive()
    await api.removeCardMedia(CARD, { side: 'back', expectedVersion: 7 })

    const seen = m.calls.map((c) => [c.method, c.url.pathname + c.url.search, c.body])
    expect(seen).toEqual([
      ['GET', `${ADMIN}/topics`, undefined],
      ['PATCH', `${ADMIN}/cards/${CARD}`, { expectedVersion: 3, question: 'Q?' }],
      ['POST', `${ADMIN}/topics/${TOPIC}/retire`, { runId: RUN, semanticKeys: ['a:b'] }],
      ['POST', `${ADMIN}/import`, { runId: RUN }],
      ['GET', `${ADMIN}/cards/counts`, undefined],
      ['POST', `${ADMIN}/cards/${CARD}/approve`, { expectedVersion: 2 }],
      ['POST', `${ADMIN}/cards/${CARD}/discard`, { expectedVersion: 5 }],
      ['POST', `${ADMIN}/cards/live`, { cardIds: [CARD], live: true }],
      ['POST', `${ADMIN}/topics/${TOPIC}/live`, { live: false }],
      ['POST', `${ADMIN}/live-all`, { confirm: 'PUSH ALL' }],
      ['DELETE', `${ADMIN}/cards/${CARD}/media?side=back`, { expectedVersion: 7 }],
    ])
  })

  test('editCard sends only the fields given (never undefined keys)', async () => {
    const m = mockFetch(() => [200, {}])
    await api.editCard(CARD, { expectedVersion: 1, answerMarkdown: '- a' })
    expect(m.calls[0].body).toEqual({ expectedVersion: 1, answerMarkdown: '- a' })
  })

  test('listAdminCards builds the query from the filters given (blank q and empty filters left out)', async () => {
    const m = mockFetch(() => [200, { cards: [], nextCursor: null }])
    await api.listAdminCards({ state: 'needs_action', kind: 'needs_image', specialtyId: 's1', q: '  gout ', cursor: 'abc', limit: 50 })
    await api.listAdminCards({ q: '   ' })
    await api.listAdminCards({ state: 'all', topicId: TOPIC })
    const [a, b, c] = m.calls.map((x) => x.url)
    expect(a.pathname).toBe(`${ADMIN}/cards`)
    expect(Object.fromEntries(a.searchParams)).toEqual({ state: 'needs_action', kind: 'needs_image', specialtyId: 's1', q: 'gout', cursor: 'abc', limit: '50' })
    expect(b.search).toBe('')
    expect(Object.fromEntries(c.searchParams)).toEqual({ state: 'all', topicId: TOPIC })
  })

  test('uploadCardMedia sends multipart file, expectedVersion, alt, side and the optional credit fields', async () => {
    const m = mockFetch(() => [201, { cardId: CARD, side: 'back', asset: { id: 'a' }, contentVersion: 5, qaStatus: 'validated' }])
    const file = new File([new Uint8Array([1])], 'x.png', { type: 'image/png' })
    await api.uploadCardMedia(CARD, { file, alt: 'An ECG', side: 'back', attribution: ' Wikimedia ', license: 'CC BY 4.0', sourceUrl: 'https://x.org/a', expectedVersion: 4 })
    await api.uploadCardMedia(CARD, { file, alt: 'An ECG', expectedVersion: 4, attribution: '  ' })
    const [full, bare] = m.calls
    expect(full.method).toBe('POST')
    expect(full.url.pathname).toBe(`${ADMIN}/cards/${CARD}/media`)
    const form = full.init.body
    expect(form).toBeInstanceOf(FormData)
    expect(Object.fromEntries([...form.entries()].filter(([k]) => k !== 'file'))).toEqual({
      expectedVersion: '4',
      side: 'back',
      alt: 'An ECG',
      attribution: 'Wikimedia',
      license: 'CC BY 4.0',
      sourceUrl: 'https://x.org/a',
    })
    expect(form.get('file')).toBe(file)
    expect(new Headers(full.init.headers).get('Content-Type')).toBeNull()
    expect(bare.init.body.get('side')).toBe('front')
    expect(bare.init.body.has('attribution')).toBe(false)
  })

  test('workflow RPC codes get plain messages; STALE_VERSION keeps details.currentVersion', async () => {
    mockFetch(() => [409, { error: 'APPROVE_NEEDS_FRONT_IMAGE', code: 'APPROVE_NEEDS_FRONT_IMAGE' }])
    await expect(api.approveCard(CARD, { expectedVersion: 1 })).rejects.toMatchObject({ kind: 'conflict', message: 'Add a front image first.' })
    mockFetch(() => [409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 9 } }])
    await expect(api.discardCard(CARD, { expectedVersion: 1 })).rejects.toMatchObject({ kind: 'stale', details: { currentVersion: 9 } })
  })

  test('the removed per-topic publish / review / textbook-issue clients are gone', () => {
    for (const name of ['publishTopic', 'unpublishTopic', 'setTextbookIssue', 'getTopicReview', 'revalidateTopic', 'getJob', 'expectedVersionsFor']) {
      expect(api[name]).toBeUndefined()
    }
  })
})

describe('flashcardsV2AdminApi errors keep status, code, details and kind', () => {
  const cases = [
    [409, { error: 'x', code: 'STALE_VERSION', details: { currentVersion: 4 } }, 'stale'],
    [409, { error: 'x', code: 'JOB_ALREADY_ACTIVE', details: { jobId: 'j1' } }, 'job_active'],
    [409, { error: 'x', code: 'APPROVE_HIDDEN' }, 'conflict'],
    [409, { error: 'x', code: 'STALE_RUN', details: { currentRunId: RUN } }, 'stale'],
    [503, { error: 'x', code: 'LLM_NOT_CONFIGURED' }, 'unavailable'],
    [404, { error: 'x', code: 'EDIT_CARD_NOT_FOUND', details: 'id' }, 'not_found'],
    [400, { error: 'x', code: 'INVALID_BODY', details: [{ path: 'a', message: 'b' }] }, 'validation'],
    [429, { error: 'x', code: 'RATE_LIMITED' }, 'rate_limited'],
    [403, { error: 'x', code: 'FORBIDDEN' }, 'forbidden'],
    [500, { error: 'Internal server error', code: 'APPROVE_FAILED' }, 'server'],
  ]
  test.each(cases)('%i %o → kind %s', async (status, body, kind) => {
    mockFetch(() => [status, body])
    const err = await api.getAdminCardCounts().catch((e) => e)
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
