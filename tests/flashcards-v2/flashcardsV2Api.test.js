import { afterEach, describe, expect, test, vi } from 'vitest'
import {
  CARD_CAP,
  FlashcardsApiError,
  createRating,
  fetchCurrentCard,
  getAllCards,
  getCardsPage,
  getSeenAll,
  getStats,
  getTopics,
  recordReview,
} from '../../src/dashboard/flashcards-v2/flashcardsV2Api'
import { card, mockFetch } from './fetchMock'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

afterEach(() => {
  vi.restoreAllMocks()
})

describe('errors', () => {
  test('maps {error, code, details} onto FlashcardsApiError with a kind', async () => {
    mockFetch(() => [409, { error: 'Card content has changed', code: 'STALE_VERSION', details: { currentVersion: 3 } }])
    const err = await recordReview(createRating({ cardId: 'c1', confidence: 'good', contentVersion: 2 })).catch((e) => e)
    expect(err).toBeInstanceOf(FlashcardsApiError)
    expect(err).toMatchObject({ status: 409, code: 'STALE_VERSION', kind: 'stale', details: { currentVersion: 3 } })
    expect(err.message).toBe('Card content has changed')
  })

  test('403 is forbidden, 404 not_found, 500 server, network failure network', async () => {
    mockFetch(() => [403, { error: 'Forbidden', code: 'FORBIDDEN' }])
    expect(await getTopics().catch((e) => e.kind)).toBe('forbidden')
    mockFetch(() => [404, { error: 'Card not found', code: 'NOT_FOUND' }])
    expect(await getTopics().catch((e) => e.kind)).toBe('not_found')
    mockFetch(() => [500, { error: 'Internal error', code: 'INTERNAL' }])
    expect(await getTopics().catch((e) => e.kind)).toBe('server')
    mockFetch(() => {
      throw new TypeError('Failed to fetch')
    })
    const net = await getTopics().catch((e) => e)
    expect(net).toMatchObject({ status: 0, kind: 'network' })
    expect(net.cause).toBeInstanceOf(TypeError)
  })

  test('a non-JSON error body still yields a useful message', async () => {
    mockFetch(() => ({ ok: false, status: 502, text: async () => '<html>Bad gateway</html>' }))
    const err = await getTopics().catch((e) => e)
    expect(err).toMatchObject({ status: 502, kind: 'server', code: null })
    expect(err.message).toMatch(/server/i)
  })
})

describe('reads', () => {
  test('getTopics passes preview=1 only when asked', async () => {
    const m = mockFetch(() => [200, { specialties: [] }])
    await getTopics()
    await getTopics({ preview: true })
    expect(m.calls[0].url.pathname).toBe('/flashcards/v2/topics')
    expect(m.calls[0].url.searchParams.has('preview')).toBe(false)
    expect(m.calls[1].url.searchParams.get('preview')).toBe('1')
  })

  test('getAllCards follows nextCursor per topic until null', async () => {
    const m = mockFetch((url) => {
      const topic = url.searchParams.get('topic_id')
      const cursor = url.searchParams.get('cursor')
      if (topic === 't1' && !cursor) return [200, { cards: [card('a'), card('b')], nextCursor: 'p2' }]
      if (topic === 't1' && cursor === 'p2') return [200, { cards: [card('c')], nextCursor: null }]
      if (topic === 't2') return [200, { cards: [card('d', { topicId: 't2' })], nextCursor: null }]
      return [500, {}]
    })
    const cards = await getAllCards(['t1', 't2'], { preview: true })
    expect(cards.map((c) => c.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(m.calls).toHaveLength(3)
    expect(m.calls.every((c) => c.url.searchParams.get('preview') === '1')).toBe(true)
    expect(m.calls.every((c) => c.url.searchParams.get('limit') === '200')).toBe(true)
  })

  test(`getAllCards stops at the ${2000}-card cap`, async () => {
    expect(CARD_CAP).toBe(2000)
    let n = 0
    const m = mockFetch(() => {
      const cards = Array.from({ length: 200 }, () => card(`c${n++}`))
      return [200, { cards, nextCursor: 'more' }]
    })
    const cards = await getAllCards(['t1'])
    expect(cards).toHaveLength(2000)
    expect(m.calls).toHaveLength(10)
  })

  test('getSeenAll merges every page for every topic into a Set', async () => {
    mockFetch((url) => {
      const cursor = url.searchParams.get('cursor')
      if (url.searchParams.get('topic_id') === 't1')
        return cursor ? [200, { seen: ['b'], nextCursor: null }] : [200, { seen: ['a'], nextCursor: 'x' }]
      return [200, { seen: ['z'], nextCursor: null }]
    })
    const seen = await getSeenAll(['t1', 't2'])
    expect([...seen].sort()).toEqual(['a', 'b', 'z'])
  })

  test('getStats sends topic_id and preview', async () => {
    const m = mockFetch(() => [200, { due_count: 4, seen_count: 9, next_due_at: null }])
    expect(await getStats({ topicId: 't1', preview: true })).toEqual({ due_count: 4, seen_count: 9, next_due_at: null })
    expect(m.calls[0].url.pathname).toBe('/flashcards/v2/srs/stats')
    expect(m.calls[0].url.searchParams.get('topic_id')).toBe('t1')
    expect(m.calls[0].url.searchParams.get('preview')).toBe('1')
  })
})

describe('fetchCurrentCard', () => {
  test('requests with cache: no-store so a stale refetch never hits the browser cache', async () => {
    const m = mockFetch(() => [200, { cards: [card('c1')], nextCursor: null }])
    expect(await fetchCurrentCard(card('c1'), { preview: true })).toMatchObject({ id: 'c1' })
    expect(m.calls[0].init.cache).toBe('no-store')
  })

  test('ordinary page reads do not force no-store', async () => {
    const m = mockFetch(() => [200, { cards: [], nextCursor: null }])
    await getCardsPage({ topicId: 't1' })
    expect(m.calls[0].init.cache).toBeUndefined()
  })
})

describe('recordReview', () => {
  test('createRating generates one review_id; every send of that rating reuses it', async () => {
    const m = mockFetch(() => [200, { success: true, next_due_at: 'x', interval_days: 1, repetitions: 1 }])
    const rating = createRating({ cardId: 'c1', confidence: 'easy', contentVersion: 4 })
    expect(rating.reviewId).toMatch(UUID_RE)
    await recordReview(rating, { preview: true })
    await recordReview(rating, { preview: true })
    expect(m.calls).toHaveLength(2)
    expect(m.calls[0].method).toBe('POST')
    expect(m.calls[0].url.pathname).toBe('/flashcards/v2/srs/record')
    expect(m.calls[0].url.searchParams.get('preview')).toBe('1')
    expect(m.calls[0].body).toEqual({ card_id: 'c1', confidence: 'easy', content_version: 4, review_id: rating.reviewId })
    expect(m.calls[1].body.review_id).toBe(rating.reviewId)
    expect(createRating({ cardId: 'c1', confidence: 'easy', contentVersion: 4 }).reviewId).not.toBe(rating.reviewId)
  })

  test('rejects a rating without a review id instead of inventing one per attempt', async () => {
    mockFetch(() => [200, {}])
    await expect(recordReview({ cardId: 'c1', confidence: 'good', contentVersion: 1 })).rejects.toThrow(/createRating/)
  })
})
