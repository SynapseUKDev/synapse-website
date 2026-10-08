import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import StudySession from '../../src/dashboard/flashcards-v2/StudySession'
import { applyRating, createQueue, progressOf } from '../../src/dashboard/flashcards-v2/sessionQueue'
import { card, mockFetch } from './fetchMock'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const OK = [200, { success: true, next_due_at: '2026-10-09T00:00:00Z', interval_days: 1, repetitions: 1 }]
const key = (k, target = document.body) => fireEvent.keyDown(target, { key: k })

function renderSession(cards, props = {}) {
  const onExit = vi.fn()
  const utils = render(<StudySession cards={cards} onExit={onExit} {...props} />)
  return { ...utils, onExit }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('sessionQueue', () => {
  test('progress = distinct cards completed / distinct cards in the session', () => {
    let q = createQueue([card('a'), card('b'), card('a')])
    expect(progressOf(q)).toEqual({ done: 0, total: 2 })
    q = applyRating(q, 'hard') // a re-queued
    expect(progressOf(q)).toEqual({ done: 0, total: 2 })
    q = applyRating(q, 'good') // b to the back
    expect(progressOf(q)).toEqual({ done: 0, total: 2 })
    q = applyRating(q, 'easy') // a done
    expect(progressOf(q)).toEqual({ done: 1, total: 2 })
    q = applyRating(q, 'easy') // b done
    expect(progressOf(q)).toEqual({ done: 2, total: 2 })
    expect(q.order).toEqual([])
  })
})

describe('keyboard flow', () => {
  test('Space reveals, 2 records Good with content_version and a review_id', async () => {
    const m = mockFetch(() => OK)
    renderSession([card('a', { contentVersion: 7 }), card('b')])
    expect(screen.queryByText('answer a')).toBeNull()
    key(' ')
    expect(await screen.findByText('answer a')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Answer' })).toHaveFocus()
    key('2')
    await waitFor(() => expect(m.callsTo('/flashcards/v2/srs/record')).toHaveLength(1))
    const sent = m.callsTo('/flashcards/v2/srs/record')[0]
    expect(sent.body).toEqual({ card_id: 'a', confidence: 'good', content_version: 7, review_id: expect.stringMatching(UUID_RE) })
    expect(await screen.findByText('Question b?')).toBeInTheDocument()
  })

  test('Enter reveals; 1 = hard and 3 = easy only once revealed', async () => {
    const m = mockFetch(() => OK)
    renderSession([card('a'), card('b')])
    key('3') // not revealed: ignored
    expect(m.calls).toHaveLength(0)
    key('Enter')
    await screen.findByText('answer a')
    key('1')
    await waitFor(() => expect(m.calls).toHaveLength(1))
    expect(m.calls[0].body.confidence).toBe('hard')
    key('Enter')
    await screen.findByText('answer b')
    key('3')
    await waitFor(() => expect(m.calls).toHaveLength(2))
    expect(m.calls[1].body.confidence).toBe('easy')
  })

  test('keys typed into an input are ignored', async () => {
    const m = mockFetch(() => OK)
    render(
      <div>
        <input aria-label="notes" />
        <StudySession cards={[card('a')]} onExit={() => {}} />
      </div>,
    )
    const input = screen.getByRole('textbox', { name: 'notes' })
    key(' ', input)
    key('Enter', input)
    expect(screen.queryByText('answer a')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
    key('2', input)
    expect(m.calls).toHaveLength(0)
  })

  test('rating buttons are labelled with their shortcut and focus moves on to the next card', async () => {
    mockFetch(() => OK)
    renderSession([card('a'), card('b')])
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
    const group = screen.getByRole('group', { name: /How well did you know this/ })
    expect(within(group).getByRole('button', { name: /Hard.*1/ })).toBeInTheDocument()
    expect(within(group).getByRole('button', { name: /Good.*2/ })).toBeInTheDocument()
    fireEvent.click(within(group).getByRole('button', { name: /Easy.*3/ }))
    await screen.findByText('Question b?')
    expect(screen.getByRole('button', { name: /Show answer/ })).toHaveFocus()
  })
})

describe('progress', () => {
  test('counts distinct cards and is announced politely', async () => {
    mockFetch(() => OK)
    renderSession([card('a'), card('b')])
    const live = screen.getByText('0 of 2 cards done')
    expect(live).toHaveAttribute('aria-live', 'polite')
    key(' ')
    key('1') // a hard → comes back
    await screen.findByText('Question b?')
    expect(screen.getByText('0 of 2 cards done')).toBeInTheDocument()
    key(' ')
    key('3') // b easy → done
    await screen.findByText('Question a?')
    expect(screen.getByText('1 of 2 cards done')).toBeInTheDocument()
    key(' ')
    key('3')
    expect(await screen.findByText(/Session complete/)).toBeInTheDocument()
    expect(screen.getByText(/2 of 2 cards/)).toBeInTheDocument()
  })
})

describe('saving', () => {
  test('a failed save is listed with Retry, and the retry reuses the same review_id', async () => {
    let fail = true
    const m = mockFetch(() => (fail ? [500, { error: 'Internal error', code: 'INTERNAL' }] : OK))
    renderSession([card('a'), card('b')])
    key(' ')
    key('2')
    const status = await screen.findByRole('region', { name: /Save status/ })
    await within(status).findByText(/1 rating not saved/)
    fail = false
    fireEvent.click(within(status).getByRole('button', { name: /^Retry/ }))
    await waitFor(() => expect(m.calls).toHaveLength(2))
    expect(m.calls[1].body).toEqual(m.calls[0].body)
    await waitFor(() => expect(screen.queryByText(/not saved/)).toBeNull())
  })

  test('"Retry all" resends every failed rating with its own review_id', async () => {
    let fail = true
    const m = mockFetch(() => (fail ? [503, { error: 'Unavailable', code: 'INTERNAL' }] : OK))
    renderSession([card('a'), card('b'), card('c')])
    key(' ')
    key('3')
    await screen.findByText('Question b?')
    key(' ')
    key('3')
    await screen.findByText(/2 ratings not saved/)
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /Retry all/ }))
    await waitFor(() => expect(m.calls).toHaveLength(4))
    const [a1, b1, ...retries] = m.calls.map((c) => c.body)
    expect(new Set(retries.map((r) => r.review_id))).toEqual(new Set([a1.review_id, b1.review_id]))
    expect(a1.review_id).not.toBe(b1.review_id)
  })

  test('409 STALE_VERSION refetches the card and marks it updated', async () => {
    const m = mockFetch((url) => {
      if (url.pathname === '/flashcards/v2/srs/record')
        return [409, { error: 'Card content has changed', code: 'STALE_VERSION', details: { currentVersion: 2 } }]
      if (url.pathname === '/flashcards/v2/cards')
        return [200, { cards: [card('a', { contentVersion: 2, question: 'Question a v2?' })], nextCursor: null }]
      return [404, {}]
    })
    renderSession([card('a'), card('b')], { preview: true })
    key(' ')
    key('1') // hard: a comes back later in this session
    expect(await screen.findByText(/updated — will reappear as new/)).toBeInTheDocument()
    const refetch = m.callsTo('/flashcards/v2/cards')[0]
    expect(refetch.url.searchParams.get('topic_id')).toBe('t1')
    expect(refetch.url.searchParams.get('preview')).toBe('1')
    expect(m.callsTo('/flashcards/v2/srs/record')[0].url.searchParams.get('preview')).toBe('1')
    // a stale rating is resolved, not a failure to retry
    expect(screen.queryByRole('button', { name: /^Retry/ })).toBeNull()
    // the re-queued copy now carries the new version
    key(' ')
    key('3') // b
    expect(await screen.findByText('Question a v2?')).toBeInTheDocument()
  })

  test('a card refreshed while its answer is open goes back to its (new) question', async () => {
    let release
    mockFetch((url) => {
      if (url.pathname === '/flashcards/v2/srs/record')
        return new Promise((r) => (release = () => r([409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 2 } }])))
      return [200, { cards: [card('a', { contentVersion: 2, question: 'Question a v2?', answerMarkdown: '- new answer' })], nextCursor: null }]
    })
    renderSession([card('a')])
    key(' ')
    key('1') // hard: the only card comes straight back
    key(' ')
    expect(await screen.findByText('answer a')).toBeInTheDocument()
    await act(async () => release())
    expect(await screen.findByText('Question a v2?')).toBeInTheDocument()
    expect(screen.queryByText('new answer')).toBeNull()
    expect(screen.getByRole('button', { name: /Show answer/ })).toBeInTheDocument()
  })

  test('the summary blocks Finish until failed saves are retried or discarded', async () => {
    mockFetch(() => [500, { error: 'Internal error', code: 'INTERNAL' }])
    const { onExit } = renderSession([card('a')])
    key(' ')
    key('3')
    expect(await screen.findByText(/Session complete/)).toBeInTheDocument()
    await screen.findByText(/1 rating not saved/)
    const finish = screen.getByRole('button', { name: /Finish/ })
    expect(finish).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /Discard unsaved/ }))
    expect(screen.getByRole('button', { name: /Finish/ })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(onExit).toHaveBeenCalled()
  })

  test('the summary waits for pending saves', async () => {
    let release
    mockFetch(() => new Promise((r) => (release = () => r(OK))))
    renderSession([card('a')])
    key(' ')
    key('3')
    await screen.findByText(/Session complete/)
    expect(screen.getByRole('button', { name: /Finish/ })).toBeDisabled()
    expect(screen.getByText(/Saving 1 rating/)).toBeInTheDocument()
    await act(async () => release())
    await waitFor(() => expect(screen.getByRole('button', { name: /Finish/ })).toBeEnabled())
  })

  test('ending early goes to the summary, which still guards unsaved ratings', async () => {
    mockFetch(() => [500, { error: 'x', code: 'INTERNAL' }])
    renderSession([card('a'), card('b')])
    key(' ')
    key('2')
    await screen.findByText(/1 rating not saved/)
    fireEvent.click(screen.getByRole('button', { name: /End session/ }))
    expect(await screen.findByText(/Session ended/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finish/ })).toBeDisabled()
  })

  test('409 whose refetch finds the card gone says "no longer available", not "reappear as new"', async () => {
    mockFetch((url) => {
      if (url.pathname === '/flashcards/v2/srs/record')
        return [409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 2 } }]
      return [200, { cards: [card('zzz')], nextCursor: null }] // 'a' is gone from the topic
    })
    renderSession([card('a'), card('b')])
    key(' ')
    key('1')
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument()
    expect(screen.queryByText(/reappear as new/)).toBeNull()
  })

  test('a save that never answers becomes failed after 20 s, retryable with the same review_id', async () => {
    vi.useFakeTimers()
    try {
      let hang = true
      const m = mockFetch(() => (hang ? new Promise(() => {}) : OK)) // ignores the abort signal on purpose
      renderSession([card('a'), card('b')])
      key(' ')
      key('2')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(19_000)
      })
      expect(screen.getByText(/Saving 1 rating/)).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(screen.getByText(/1 rating not saved/)).toBeInTheDocument()
      expect(m.calls[0].init.signal.aborted).toBe(true)
      hang = false
      fireEvent.click(screen.getByRole('button', { name: /^Retry/ }))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10)
      })
      expect(m.calls).toHaveLength(2)
      expect(m.calls[1].body.review_id).toBe(m.calls[0].body.review_id)
      expect(screen.queryByText(/not saved/)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  test('after the timeout the summary offers Discard, and Finish then works', async () => {
    vi.useFakeTimers()
    try {
      mockFetch(() => new Promise(() => {}))
      const { onExit } = renderSession([card('a')])
      key(' ')
      key('3')
      expect(screen.getByRole('button', { name: /Finish/ })).toBeDisabled()
      expect(screen.queryByRole('button', { name: /Discard unsaved/ })).toBeNull()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(20_500)
      })
      fireEvent.click(screen.getByRole('button', { name: /Discard unsaved/ }))
      fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
      expect(onExit).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})
