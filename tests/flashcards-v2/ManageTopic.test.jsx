import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import FlashcardsV2 from '../../src/dashboard/osce/FlashcardsV2'
import ManageTopic from '../../src/dashboard/flashcards-v2/ManageTopic'
import { mockFetch } from './fetchMock'
import { ADMIN, TOPIC, adminCard, image } from './adminFixtures'

vi.mock('../../src/usage/client.js', () => ({ track: vi.fn() }))

const CARDS = '/flashcards/v2/cards'
const LIVE = `${ADMIN}/cards/live`

const live = (id, key, extra = {}) => adminCard(id, key, { qaStatus: 'validated', isLive: true, isPublished: true, approvedAt: 'x', ...extra })
const approved = (id, key, extra = {}) => adminCard(id, key, { qaStatus: 'validated', approvedAt: 'x', ...extra })

function api(cards, routes = {}) {
  return mockFetch((url, init, call) => {
    const key = `${call.method} ${url.pathname}`
    if (routes[key]) return routes[key](url, call)
    if (url.pathname === CARDS) return [200, { cards: cards.current ?? cards, nextCursor: null }]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
}

const renderTopic = () => render(<ManageTopic topic={{ id: TOPIC, name: 'Gout' }} onBack={() => {}} />)
const rowOf = (key) => screen.getByRole('article', { name: `Card ${key}` })

afterEach(() => vi.restoreAllMocks())

describe('Manage topic', () => {
  test('loads the topic with the preview cards endpoint and filters All / Live / Not live', async () => {
    const m = api([live('c1', 'k1'), approved('c2', 'k2'), approved('c3', 'k3')])
    renderTopic()
    expect(await screen.findByRole('article', { name: 'Card k1' })).toBeInTheDocument()
    const call = m.callsTo(CARDS)[0].url.searchParams
    expect(call.get('preview')).toBe('1')
    expect(call.get('topic_id')).toBe(TOPIC)
    expect(screen.getAllByRole('article')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Live' }))
    expect(screen.getAllByRole('article')).toHaveLength(1)
    expect(rowOf('k1')).toHaveTextContent('Live')

    fireEvent.click(screen.getByRole('button', { name: 'Not live' }))
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Card k2', 'Card k3'])

    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  test('the answer is collapsed until expanded', async () => {
    api([approved('c2', 'k2')])
    renderTopic()
    await screen.findByRole('article', { name: 'Card k2' })
    expect(screen.queryByText('answer k2')).toBeNull()
    fireEvent.click(within(rowOf('k2')).getByRole('button', { name: 'Show answer' }))
    expect(screen.getByText('answer k2')).toBeInTheDocument()
  })

  test('Push live calls setCardsLive and the chip becomes Live; Take off live reverses it', async () => {
    const m = api([approved('c2', 'k2')], { [`POST ${LIVE}`]: () => [200, { changed: 1, skipped: [] }] })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k2' })
    expect(within(rowOf('k2')).getByText('Not live')).toBeInTheDocument()

    fireEvent.click(within(rowOf('k2')).getByRole('button', { name: 'Push live' }))
    await waitFor(() => expect(within(rowOf('k2')).getByRole('button', { name: 'Take off live' })).toBeInTheDocument())
    expect(m.callsTo(LIVE)[0].body).toEqual({ cardIds: ['c2'], live: true })
    expect(within(rowOf('k2')).getByText('Live')).toBeInTheDocument()

    fireEvent.click(within(rowOf('k2')).getByRole('button', { name: 'Take off live' }))
    await waitFor(() => expect(within(rowOf('k2')).getByText('Not live')).toBeInTheDocument())
    expect(m.callsTo(LIVE)[1].body).toEqual({ cardIds: ['c2'], live: false })
  })

  test('a skipped push explains why and leaves the chip alone', async () => {
    api([approved('c2', 'k2', { isMediaRequired: true })], {
      [`POST ${LIVE}`]: () => [200, { changed: 0, skipped: [{ id: 'c2', reason: 'needs_front_image' }] }],
    })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k2' })
    fireEvent.click(within(rowOf('k2')).getByRole('button', { name: 'Push live' }))
    expect(await within(rowOf('k2')).findByText(/needs a front image first/)).toBeInTheDocument()
    expect(within(rowOf('k2')).getByText('Not live')).toBeInTheDocument()
  })

  test('Push topic live reports changed / skipped and reloads the cards', async () => {
    const cards = { current: [approved('c2', 'k2'), approved('c3', 'k3')] }
    const m = api(cards, {
      [`POST ${ADMIN}/topics/${TOPIC}/live`]: () => {
        cards.current = [live('c2', 'k2'), approved('c3', 'k3')]
        return [200, { changed: 1, skipped: [{ id: 'c3', reason: 'needs_front_image' }] }]
      },
    })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k2' })
    fireEvent.click(screen.getByRole('button', { name: 'Push topic live' }))
    expect(await screen.findByText('1 card pushed live, 1 skipped')).toBeInTheDocument()
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/live`)[0].body).toEqual({ live: true })
    await waitFor(() => expect(within(rowOf('k2')).getByText('Live')).toBeInTheDocument())
    expect(within(rowOf('k3')).getByText('Not live')).toBeInTheDocument()
  })

  test('Take topic off live sends live:false', async () => {
    const m = api([live('c1', 'k1')], { [`POST ${ADMIN}/topics/${TOPIC}/live`]: () => [200, { changed: 1, skipped: [] }] })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k1' })
    fireEvent.click(screen.getByRole('button', { name: 'Take topic off live' }))
    await waitFor(() => expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/live`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/live`)[0].body).toEqual({ live: false })
  })

  test('Edit saves with the card version and the card keeps its Live chip', async () => {
    const m = api([live('c1', 'k1', { contentVersion: 4 })], {
      [`PATCH ${ADMIN}/cards/c1`]: (url, call) => [
        200,
        { ...live('c1', 'k1', { contentVersion: 5, answerMarkdown: call.body.answerMarkdown }), topicName: undefined },
      ],
    })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k1' })
    fireEvent.click(within(rowOf('k1')).getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/Answer/), { target: { value: '- better answer' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.callsTo(`${ADMIN}/cards/c1`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/cards/c1`)[0].body).toMatchObject({ expectedVersion: 4, answerMarkdown: '- better answer' })
    await waitFor(() => expect(within(rowOf('k1')).getByText('Live')).toBeInTheDocument())
  })

  test('removing the front image of a live media card flips its chip to Not live', async () => {
    api([live('c1', 'k1', { cardType: 'media', isMediaRequired: true, contentVersion: 4, media: { front: image(), back: null } })], {
      [`DELETE ${ADMIN}/cards/c1/media`]: () => [200, { cardId: 'c1', contentVersion: 5, qaStatus: 'media_pending' }],
    })
    renderTopic()
    await screen.findByRole('article', { name: 'Card k1' })
    expect(within(rowOf('k1')).getByText('Live')).toBeInTheDocument()
    fireEvent.click(within(rowOf('k1')).getByRole('button', { name: 'Images' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove front image' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(within(rowOf('k1')).getByText('Not live')).toBeInTheDocument())
    expect(within(rowOf('k1')).getByRole('button', { name: 'Push live' })).toBeInTheDocument()
  })

  test('Images opens the front / back image slots', async () => {
    api([approved('c2', 'k2')])
    renderTopic()
    await screen.findByRole('article', { name: 'Card k2' })
    fireEvent.click(within(rowOf('k2')).getByRole('button', { name: 'Images' }))
    expect(screen.getByRole('button', { name: 'Add front image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add back image' })).toBeInTheDocument()
  })
})

describe('Flashcards page admin controls', () => {
  const ADMIN_USER = { id: 'u1', capabilities: { can_manage_osce: true } }
  const TOPICS = { specialties: [{ id: 's1', name: 'Rheumatology', topics: [{ id: TOPIC, name: 'Gout', liveCount: 1, approvedCount: 1 }] }] }

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/fc']}>
        <Routes>
          <Route element={<Outlet context={{ user: ADMIN_USER }} />}>
            <Route path="/fc" element={<FlashcardsV2 />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  function pageApi(routes = {}) {
    return mockFetch((url, init, call) => {
      const key = `${call.method} ${url.pathname}`
      if (routes[key]) return routes[key](url, call)
      if (url.pathname === '/flashcards/v2/topics') return [200, TOPICS]
      if (url.pathname === '/flashcards/v2/srs/stats') return [200, { due_count: 0, seen_count: 0, next_due_at: null }]
      if (url.pathname === CARDS) return [200, { cards: [live('c1', 'k1'), approved('c2', 'k2')], nextCursor: null }]
      return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
    })
  }

  test('Manage on a topic opens its cards; All topics returns to the picker', async () => {
    pageApi()
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /Rheumatology/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Manage Gout' }))
    expect(await screen.findByRole('article', { name: 'Card k1' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /All topics/ }))
    expect(await screen.findByRole('button', { name: /Rheumatology/ })).toBeInTheDocument()
  })

  test('Push all approved live needs the typed phrase, then reports changed and skipped', async () => {
    const m = pageApi({ [`POST ${ADMIN}/live-all`]: () => [200, { changed: 7, skipped: [{ id: 'x', reason: 'hidden' }], skippedCount: 1 }] })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Push all approved live' }))
    const dialog = screen.getByRole('dialog')
    const submit = within(dialog).getByRole('button', { name: 'Push all live' })
    expect(submit).toBeDisabled()
    const input = within(dialog).getByLabelText(/Type PUSH ALL/)
    fireEvent.change(input, { target: { value: 'push all' } })
    expect(submit).toBeDisabled()
    fireEvent.change(input, { target: { value: 'PUSH ALL' } })
    expect(submit).toBeEnabled()
    fireEvent.click(submit)
    expect(await within(dialog).findByText('7 cards pushed live, 1 skipped')).toBeInTheDocument()
    expect(m.callsTo(`${ADMIN}/live-all`)[0].body).toEqual({ confirm: 'PUSH ALL' })
  })

  test('Push all approved live uses the singular for one card', async () => {
    pageApi({ [`POST ${ADMIN}/live-all`]: () => [200, { changed: 1, skipped: [], skippedCount: 0 }] })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Push all approved live' }))
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByLabelText(/Type PUSH ALL/), { target: { value: 'PUSH ALL' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Push all live' }))
    expect(await within(dialog).findByText('1 card pushed live, 0 skipped')).toBeInTheDocument()
  })
})
