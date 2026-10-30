import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminFlashcardsV2 from '../../src/dashboard/admin/flashcards-v2/AdminFlashcardsV2'
import { mockFetch } from './fetchMock'
import { ADMIN, CARDS_PATH, COUNTS, COUNTS_PATH, TOPIC, TOPICS_PATH, adminCard, topicRow } from './adminFixtures'

function api(routes = {}) {
  return mockFetch((url, init, call) => {
    const h = routes[url.pathname]
    if (h) return h(url, call)
    if (url.pathname === COUNTS_PATH) return [200, COUNTS]
    if (url.pathname === CARDS_PATH) return [200, { cards: [adminCard('c1', 'gout:a')], nextCursor: null }]
    if (url.pathname === TOPICS_PATH) return [200, { topics: [topicRow(TOPIC, 'Gout')] }]
    if (url.pathname === `${ADMIN}/reports`) return [200, { reports: [], nextCursor: null }]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
}

afterEach(() => vi.restoreAllMocks())

describe('admin tab', () => {
  test('sub-tabs: "Needs attention (N)" from the counts, then "Learner reports"; counts summary shown', async () => {
    api()
    render(<AdminFlashcardsV2 />)
    const tabs = await screen.findAllByRole('tab')
    await waitFor(() => expect(tabs.map((t) => t.textContent)).toEqual(['Needs attention (3)', 'Learner reports']))
    expect(screen.getByText('2 flagged · 1 need an image · 10 approved, not live · 4 live')).toBeInTheDocument()
    expect(screen.getByLabelText('Import TopicRun JSON')).toBeInTheDocument()
  })

  test('the Learner reports tab renders the reports queue; arrow keys move between tabs', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    const queueTab = await screen.findByRole('tab', { name: /Needs attention/ })
    fireEvent.keyDown(queueTab, { key: 'ArrowRight' })
    expect(screen.getByRole('tab', { name: 'Learner reports' })).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByText(/No reports/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Import TopicRun JSON')).toBeNull()
    await waitFor(() => expect(m.callsTo(`${ADMIN}/reports`)).toHaveLength(1))
  })

  test('a counts failure is shown with its code; the queue still loads', async () => {
    api({ [COUNTS_PATH]: () => [500, { error: 'Internal server error', code: 'INTERNAL' }] })
    render(<AdminFlashcardsV2 />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Counts unavailable: Internal server error (INTERNAL)')
    expect(screen.getByRole('tab', { name: 'Needs attention' })).toBeInTheDocument()
    expect(await screen.findByRole('article', { name: 'Card gout:a' })).toBeInTheDocument()
  })

  test('importing a TopicRun JSON file posts the parsed artifact and reloads the queue and counts', async () => {
    const m = api({
      [`${ADMIN}/import`]: () => [200, { runId: 'r', topicId: TOPIC, textDeckStatus: 'ready_for_admin', inserted: 3, changed: 1, unchanged: 0, reactivated: 0, retiredCandidates: ['old:x'], idempotent: false }],
    })
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('article', { name: 'Card gout:a' })
    const artifact = { schemaVersion: 2, topicId: TOPIC, cards: [] }
    const file = new File([JSON.stringify(artifact)], 'run.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import TopicRun JSON'), { target: { files: [file] } })
    await waitFor(() => expect(m.callsTo(`${ADMIN}/import`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/import`)[0].body).toEqual(artifact)
    expect(await screen.findByText(/Imported: 3 inserted, 1 changed, 0 unchanged, 0 reactivated; 1 retire candidate/)).toBeInTheDocument()
    await waitFor(() => expect(m.callsTo(CARDS_PATH)).toHaveLength(2))
    await waitFor(() => expect(m.callsTo(COUNTS_PATH)).toHaveLength(2))
  })

  test('an invalid JSON file is rejected without calling the API', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('article', { name: 'Card gout:a' })
    const file = new File(['{not json'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import TopicRun JSON'), { target: { files: [file] } })
    expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument()
    expect(m.callsTo(`${ADMIN}/import`)).toHaveLength(0)
  })
})
