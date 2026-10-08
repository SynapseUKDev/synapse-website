import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import FlashcardsV2 from '../../src/dashboard/osce/FlashcardsV2'
import { track } from '../../src/usage/client.js'
import { EVENTS } from '../../src/usage/catalog.js'
import { card, mockFetch } from './fetchMock'

vi.mock('../../src/usage/client.js', () => ({ track: vi.fn() }))

const ADMIN = { id: 'u1', capabilities: { can_manage_osce: true } }
const LEARNER = { id: 'u2', capabilities: {} }

const TOPICS = {
  specialties: [
    {
      id: 's1',
      name: 'Rheumatology',
      topics: [
        { id: 't1', name: 'Gout', cardCount: 3, draftCount: 2 },
        { id: 't2', name: 'Lupus', cardCount: 1, draftCount: 0 },
      ],
    },
  ],
}

function renderPage(user) {
  return render(
    <MemoryRouter initialEntries={['/fc']}>
      <Routes>
        <Route element={<Outlet context={{ user }} />}>
          <Route path="/fc" element={<FlashcardsV2 />} />
          <Route path="/dashboard/question-bank" element={<div>QUESTION BANK HOME</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

/** Default API: topics + stats; per-test overrides by pathname. */
function api(overrides = {}) {
  return mockFetch((url, init, call) => {
    const h = overrides[url.pathname]
    if (h) return h(url, call)
    if (url.pathname === '/flashcards/v2/topics') return [200, TOPICS]
    if (url.pathname === '/flashcards/v2/srs/stats') return [200, { due_count: 1, seen_count: 1, next_due_at: null }]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
}

async function selectGout() {
  fireEvent.click(await screen.findByRole('button', { name: /Rheumatology/ }))
  fireEvent.click(screen.getByRole('checkbox', { name: /Gout/ }))
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('access', () => {
  test('a learner who gets 403 sees the coming-soon message, not an empty deck', async () => {
    const m = api({ '/flashcards/v2/topics': () => [403, { error: 'Forbidden', code: 'FORBIDDEN' }] })
    renderPage(LEARNER)
    expect(await screen.findByText(/new flashcards are coming soon/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Start/ })).toBeNull()
    expect(m.callsTo('/flashcards/v2/topics')[0].url.searchParams.has('preview')).toBe(false)
  })

  test('admins call with preview=1 and see draft counts; learners do not', async () => {
    const m = api()
    const { unmount } = renderPage(ADMIN)
    fireEvent.click(await screen.findByRole('button', { name: /Rheumatology/ }))
    expect(screen.getByText(/2 drafts/)).toBeInTheDocument()
    expect(m.callsTo('/flashcards/v2/topics')[0].url.searchParams.get('preview')).toBe('1')
    unmount()

    const m2 = api({
      '/flashcards/v2/topics': () => [200, { specialties: [{ ...TOPICS.specialties[0], topics: [{ id: 't1', name: 'Gout', cardCount: 3 }] }] }],
    })
    renderPage(LEARNER)
    fireEvent.click(await screen.findByRole('button', { name: /Rheumatology/ }))
    expect(screen.getByRole('checkbox', { name: /Gout/ })).toBeInTheDocument()
    expect(screen.queryByText(/draft/i)).toBeNull()
    expect(m2.callsTo('/flashcards/v2/topics')[0].url.searchParams.has('preview')).toBe(false)
  })
})

describe('picker states', () => {
  test('shows a loading state while topics load', async () => {
    let release
    api({ '/flashcards/v2/topics': () => new Promise((r) => (release = () => r([200, TOPICS]))) })
    renderPage(LEARNER)
    expect(await screen.findByText(/Loading topics/)).toBeInTheDocument()
    await act(async () => release())
    expect(await screen.findByRole('button', { name: /Rheumatology/ })).toBeInTheDocument()
  })

  test('shows an empty state when no topics have cards', async () => {
    api({ '/flashcards/v2/topics': () => [200, { specialties: [] }] })
    renderPage(LEARNER)
    expect(await screen.findByText(/No flashcards are available yet/)).toBeInTheDocument()
  })

  test('shows an error with retry, and retry reloads the topics', async () => {
    let fail = true
    const m = api({
      '/flashcards/v2/topics': () => (fail ? [500, { error: 'Internal error', code: 'INTERNAL' }] : [200, TOPICS]),
    })
    renderPage(LEARNER)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/could not load/i)
    fail = false
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }))
    expect(await screen.findByRole('button', { name: /Rheumatology/ })).toBeInTheDocument()
    expect(m.callsTo('/flashcards/v2/topics')).toHaveLength(2)
  })
})

describe('modes', () => {
  const cardsHandler = (url) =>
    url.searchParams.get('topic_id') === 't1'
      ? [200, { cards: [card('a'), card('b'), card('c')], nextCursor: null }]
      : [200, { cards: [], nextCursor: null }]

  test('Free studies every card of the selected topics', async () => {
    const m = api({ '/flashcards/v2/cards': cardsHandler })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Free/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(await screen.findByText('Question a?')).toBeInTheDocument()
    expect(screen.getByText('0 of 3 cards done')).toBeInTheDocument()
    expect(m.callsTo('/flashcards/v2/cards')[0].url.searchParams.get('topic_id')).toBe('t1')
  })

  test('New excludes cards in /srs/seen', async () => {
    api({
      '/flashcards/v2/cards': cardsHandler,
      '/flashcards/v2/srs/seen': () => [200, { seen: ['a', 'c'], nextCursor: null }],
    })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /New/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(await screen.findByText('Question b?')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 cards done')).toBeInTheDocument()
  })

  test('New is capped at 20 cards', async () => {
    const many = Array.from({ length: 30 }, (_, i) => card(`n${i}`))
    api({
      '/flashcards/v2/cards': () => [200, { cards: many, nextCursor: null }],
      '/flashcards/v2/srs/seen': () => [200, { seen: [], nextCursor: null }],
    })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /New/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(await screen.findByText('0 of 20 cards done')).toBeInTheDocument()
  })

  test('Due studies only the cards /srs/due returns for the selected topics', async () => {
    const m = api({
      '/flashcards/v2/cards': cardsHandler,
      '/flashcards/v2/srs/due': () => [200, { due: [{ card_id: 'c', next_due_at: '2026-01-01' }], nextCursor: null }],
    })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Due/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(await screen.findByText('Question c?')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 cards done')).toBeInTheDocument()
    expect(m.callsTo('/flashcards/v2/srs/due')[0].url.searchParams.get('topic_id')).toBe('t1')
  })

  test('an empty deck explains itself instead of starting', async () => {
    api({
      '/flashcards/v2/cards': cardsHandler,
      '/flashcards/v2/srs/due': () => [200, { due: [], nextCursor: null }],
    })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Due/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    expect(await screen.findByText(/No cards are due/)).toBeInTheDocument()
  })

  test('a failed start shows the error and keeps the picker', async () => {
    api({ '/flashcards/v2/cards': () => [500, { error: 'Internal error', code: 'INTERNAL' }] })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Free/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/could not start/i))
    expect(screen.getByRole('checkbox', { name: /Gout/ })).toBeChecked()
  })
})

describe('access (the server decides who may study)', () => {
  test('a non-admin blocked by the server sees the coming-soon message, not an error', async () => {
    api({ '/flashcards/v2/topics': () => [403, { error: 'Forbidden', code: 'FORBIDDEN' }] })
    renderPage(LEARNER)
    expect(await screen.findByText(/new flashcards are coming soon/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Retry/ })).toBeNull()
  })

  test('a non-admin the server allows loads the picker without any admin label or preview', async () => {
    const m = api()
    renderPage(LEARNER)
    expect(await screen.findByRole('button', { name: /Rheumatology/ })).toBeInTheDocument()
    expect(screen.queryByText(/admin preview/i)).toBeNull()
    expect(screen.queryByText(/beta/i)).toBeNull()
    expect(m.callsTo('/flashcards/v2/topics')[0].url.searchParams.has('preview')).toBe(false)
  })

  test('admins get preview and draft counts with the admin preview label (no beta wording)', async () => {
    const m = api()
    renderPage(ADMIN)
    fireEvent.click(await screen.findByRole('button', { name: /Rheumatology/ }))
    expect(screen.getByText(/2 drafts/)).toBeInTheDocument()
    expect(m.callsTo('/flashcards/v2/topics')[0].url.searchParams.get('preview')).toBe('1')
    expect(screen.getByText(/admin preview \(drafts included\)/i)).toBeInTheDocument()
    expect(screen.queryByText(/beta/i)).toBeNull()
  })
})

describe('leaving mid-session', () => {
  const cardsHandler = () => [200, { cards: [card('a'), card('b')], nextCursor: null }]
  async function startAndRateFirst(record) {
    api({ '/flashcards/v2/cards': cardsHandler, '/flashcards/v2/srs/record': record })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Free/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await screen.findByText('Question a?')
    fireEvent.keyDown(document.body, { key: ' ' })
    fireEvent.keyDown(document.body, { key: '2' })
  }

  test('back with a failed rating routes to the summary instead of dropping it', async () => {
    await startAndRateFirst(() => [500, { error: 'x', code: 'INTERNAL' }])
    await screen.findByText(/1 rating not saved/)
    fireEvent.click(screen.getByRole('button', { name: /Question Bank/ }))
    expect(await screen.findByText(/Session ended/)).toBeInTheDocument()
    expect(screen.queryByText('QUESTION BANK HOME')).toBeNull()
    expect(screen.getByText(/1 rating not saved/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Finish/ })).toBeDisabled()
  })

  test('back with a pending rating routes to the summary', async () => {
    await startAndRateFirst(() => new Promise(() => {}))
    await screen.findByText(/Saving 1 rating/)
    fireEvent.click(screen.getByRole('button', { name: /Question Bank/ }))
    expect(await screen.findByText(/Session ended/)).toBeInTheDocument()
    expect(screen.queryByText('QUESTION BANK HOME')).toBeNull()
  })

  test('back with everything saved leaves normally', async () => {
    await startAndRateFirst(() => [200, { success: true, next_due_at: 'x', interval_days: 1, repetitions: 1 }])
    await screen.findByText('Question b?')
    await waitFor(() => expect(screen.queryByText(/Saving/)).toBeNull())
    fireEvent.click(screen.getByRole('button', { name: /Question Bank/ }))
    expect(await screen.findByText('QUESTION BANK HOME')).toBeInTheDocument()
  })
})

describe('usage analytics', () => {
  afterEach(() => track.mockClear())

  test('tracks session started with the deck size and completed once the deck is finished', async () => {
    const saved = () => [200, { success: true, next_due_at: 'x', interval_days: 3, repetitions: 1 }]
    api({ '/flashcards/v2/cards': () => [200, { cards: [card('a'), card('b')], nextCursor: null }], '/flashcards/v2/srs/record': saved })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Free/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await screen.findByText('Question a?')
    expect(track).toHaveBeenCalledWith(EVENTS.FLASHCARDS_SESSION_STARTED, { card_count: 2 })
    expect(track).not.toHaveBeenCalledWith(EVENTS.FLASHCARDS_SESSION_COMPLETED, expect.anything())

    for (const id of ['a', 'b']) {
      await screen.findByText(`Question ${id}?`)
      fireEvent.keyDown(document.body, { key: ' ' })
      fireEvent.keyDown(document.body, { key: '3' })
    }
    await waitFor(() =>
      expect(track).toHaveBeenCalledWith(EVENTS.FLASHCARDS_SESSION_COMPLETED, { card_count: 2 }),
    )
    expect(track.mock.calls.filter(([name]) => name === EVENTS.FLASHCARDS_SESSION_COMPLETED)).toHaveLength(1)
  })

  test('an abandoned session is not tracked as completed', async () => {
    const saved = () => [200, { success: true, next_due_at: 'x', interval_days: 3, repetitions: 1 }]
    api({ '/flashcards/v2/cards': () => [200, { cards: [card('a'), card('b')], nextCursor: null }], '/flashcards/v2/srs/record': saved })
    renderPage(LEARNER)
    await selectGout()
    fireEvent.click(screen.getByRole('tab', { name: /Free/ }))
    fireEvent.click(screen.getByRole('button', { name: /Start/ }))
    await screen.findByText('Question a?')
    fireEvent.click(screen.getByRole('button', { name: /Question Bank/ }))
    expect(await screen.findByText('QUESTION BANK HOME')).toBeInTheDocument()
    expect(track).not.toHaveBeenCalledWith(EVENTS.FLASHCARDS_SESSION_COMPLETED, expect.anything())
  })
})
