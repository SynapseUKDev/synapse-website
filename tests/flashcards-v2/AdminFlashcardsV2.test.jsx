import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminFlashcardsV2 from '../../src/dashboard/admin/flashcards-v2/AdminFlashcardsV2'
import { mockFetch } from './fetchMock'
import { ADMIN, REVIEW_PATH, TOPIC, reviewPayload, topicRow } from './adminFixtures'

const OTHER = '99999999-2222-4333-8444-555555555555'
const TOPICS = {
  topics: [
    topicRow(TOPIC, 'Gout', { counts: { active: 5, validated: 2, needsAttention: 1, mediaPending: 1, draft: 1, published: 0, legacyActive: 2 } }),
    topicRow(OTHER, 'Lupus', { reviewStatus: 'approved' }),
  ],
}

function api(routes = {}) {
  return mockFetch((url, init, call) => {
    const h = routes[url.pathname]
    if (h) return h(url, call)
    if (url.pathname === `${ADMIN}/topics`) return [200, TOPICS]
    if (url.pathname === REVIEW_PATH) return [200, reviewPayload()]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
}

afterEach(() => vi.restoreAllMocks())

describe('topic list', () => {
  test('lists topics with counts including legacyActive; filters by status and search', async () => {
    api()
    render(<AdminFlashcardsV2 />)
    const list = await screen.findByRole('list', { name: 'Flashcard topics' })
    const gout = within(list).getByRole('button', { name: /Gout/ })
    expect(gout).toHaveTextContent(/5 active/)
    expect(gout).toHaveTextContent(/2 legacy/)
    expect(gout).toHaveTextContent(/1 needs attention/)
    expect(gout).toHaveTextContent(/1 awaiting image/)
    expect(gout).toHaveTextContent(/1 draft/)

    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'approved' } })
    expect(within(list).queryByRole('button', { name: /Gout/ })).toBeNull()
    expect(within(list).getByRole('button', { name: /Lupus/ })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Review status'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Search topics'), { target: { value: 'gou' } })
    expect(within(list).getByRole('button', { name: /Gout/ })).toBeInTheDocument()
    expect(within(list).queryByRole('button', { name: /Lupus/ })).toBeNull()
  })

  test('selecting a topic opens its review panel', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    fireEvent.click(await screen.findByRole('button', { name: /Gout/ }))
    expect(await screen.findByRole('region', { name: 'Run summary' })).toBeInTheDocument()
    expect(m.callsTo(REVIEW_PATH)).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Gout/ })).toHaveAttribute('aria-pressed', 'true')
  })

  test('a 403 explains the permission needed', async () => {
    api({ [`${ADMIN}/topics`]: () => [403, { error: 'Forbidden', code: 'FORBIDDEN' }] })
    render(<AdminFlashcardsV2 />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/Forbidden|access/i)
  })

  test('importing a TopicRun JSON file posts the parsed artifact and refreshes the list', async () => {
    const m = api({
      [`${ADMIN}/import`]: () => [200, { runId: 'r', topicId: TOPIC, textDeckStatus: 'ready_for_admin', inserted: 3, changed: 1, unchanged: 0, reactivated: 0, retiredCandidates: ['old:x'], idempotent: false }],
    })
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('list', { name: 'Flashcard topics' })
    const artifact = { schemaVersion: 2, topicId: TOPIC, cards: [] }
    const file = new File([JSON.stringify(artifact)], 'run.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import TopicRun JSON'), { target: { files: [file] } })
    await waitFor(() => expect(m.callsTo(`${ADMIN}/import`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/import`)[0].body).toEqual(artifact)
    expect(await screen.findByText(/Imported: 3 inserted, 1 changed, 0 unchanged, 0 reactivated; 1 retire candidate/)).toBeInTheDocument()
    await waitFor(() => expect(m.callsTo(`${ADMIN}/topics`)).toHaveLength(2))
  })

  test('an invalid JSON file is rejected without calling the API', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('list', { name: 'Flashcard topics' })
    const file = new File(['{not json'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import TopicRun JSON'), { target: { files: [file] } })
    expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument()
    expect(m.callsTo(`${ADMIN}/import`)).toHaveLength(0)
  })
})
