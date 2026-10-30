import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminFlashcardsV2 from '../../src/dashboard/admin/flashcards-v2/AdminFlashcardsV2'
import ReportsQueue from '../../src/dashboard/admin/flashcards-v2/ReportsQueue'
import { mockFetch } from './fetchMock'
import { ADMIN, CARDS_PATH, COUNTS, COUNTS_PATH, TOPIC, adminCard, topicRow } from './adminFixtures'

const REPORTS = `${ADMIN}/reports`
const CARD = 'c1'
const TS = '2026-10-08T09:15:42.123456+00:00'

const reportRow = (reportId, extra = {}) => ({
  reportId,
  cardId: CARD,
  topicId: TOPIC,
  topicName: 'Gout',
  semanticKey: 'management:gout',
  questionExcerpt: 'First-line treatment of an acute gout flare?',
  category: 'clinical_error',
  details: 'Allopurinol is not started during a flare',
  status: 'open',
  reportVersion: 4,
  currentVersion: 4,
  isCurrentVersion: true,
  seriousReporters: 1,
  isPublished: true,
  isActive: true,
  hiddenReason: null,
  hiddenAt: null,
  reassessment: null,
  reassessmentJob: null,
  resolvedAt: null,
  resolutionNote: null,
  createdAt: TS,
  ...extra,
})

function api(reports, routes = {}) {
  return mockFetch((url, init, call) => {
    const key = `${call.method} ${url.pathname}`
    if (routes[key]) return routes[key](url, call)
    if (key === `GET ${REPORTS}`) return [200, { reports, nextCursor: null }]
    if (url.pathname === `${ADMIN}/topics`) return [200, { topics: [topicRow(TOPIC, 'Gout')] }]
    if (url.pathname === COUNTS_PATH) return [200, COUNTS]
    if (url.pathname === CARDS_PATH) return [200, { cards: [], nextCursor: null }]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
}

const rowOf = (reportId) => screen.getByRole('article', { name: `Report ${reportId}` })

afterEach(() => vi.restoreAllMocks())

describe('admin reports queue', () => {
  test('renders the stale marker, serious-reporter count, hidden badge and the AI verdict with correction', async () => {
    api([
      reportRow('r1', {
        status: 'confirmed',
        reportVersion: 3,
        currentVersion: 4,
        isCurrentVersion: false,
        seriousReporters: 2,
        isPublished: false,
        hiddenReason: 'ai_confirmed_error',
        hiddenAt: TS,
        reassessment: {
          verdict: 'material_error',
          reason: 'Colchicine or an NSAID is first line; allopurinol is not started in a flare.',
          suggestedCorrection: 'Answer:\n- **NSAID or colchicine**',
          correction: { answerMarkdown: '- **NSAID or colchicine**' },
        },
      }),
    ])
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    const row = rowOf('r1')
    expect(within(row).getByText('Clinically incorrect')).toBeInTheDocument()
    expect(within(row).getByText('Allopurinol is not started during a flare')).toBeInTheDocument()
    expect(within(row).getByText('First-line treatment of an acute gout flare?')).toBeInTheDocument()
    expect(within(row).getByText(/Stale: reported v3, card is now v4/)).toBeInTheDocument()
    expect(within(row).getByText(/2 distinct learners/)).toBeInTheDocument()
    expect(within(row).getByText(/Hidden from learners/)).toHaveTextContent(/AI-confirmed material error/)
    expect(within(row).getByText('Material error')).toBeInTheDocument()
    expect(within(row).getByText(/Colchicine or an NSAID is first line/)).toBeInTheDocument()
    expect(within(row).getByText('- **NSAID or colchicine**')).toBeInTheDocument()
  })

  test('a current-version report has no stale marker; reassessing shows progress or failure clearly', async () => {
    api([
      reportRow('r1'),
      reportRow('r2', { status: 'reassessing', reassessmentJob: { id: 'j1', status: 'running', attempts: 1, error: null } }),
      reportRow('r3', {
        status: 'reassessing',
        reassessmentJob: { id: 'j2', status: 'failed', attempts: 3, error: 'JOB_ATTEMPTS_EXHAUSTED' },
      }),
      reportRow('r4', { status: 'reassessing', reassessmentJob: null }),
      reportRow('r5', {
        status: 'reassessing',
        isCurrentVersion: false,
        reassessmentJob: { id: 'j3', status: 'succeeded', attempts: 1, error: null },
      }),
    ])
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    expect(within(rowOf('r1')).queryByText(/Stale/)).toBeNull()
    expect(within(rowOf('r2')).getByText(/AI reassessment in progress/)).toBeInTheDocument()
    expect(within(rowOf('r3')).getByText(/AI reassessment failed/)).toHaveTextContent('JOB_ATTEMPTS_EXHAUSTED')
    expect(within(rowOf('r3')).getByText(/AI reassessment failed/)).toHaveTextContent(/decide this report yourself/)
    expect(within(rowOf('r4')).getByText(/AI reassessment failed/)).toBeInTheDocument()
    expect(within(rowOf('r5')).getByText(/AI reassessment skipped: the card changed/)).toBeInTheDocument()
  })

  test('never shows a learner id (only the count)', async () => {
    api([reportRow('r1', { userId: 'LEARNER-SECRET', reporterId: 'LEARNER-SECRET' })])
    const { container } = render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    expect(container.textContent).not.toContain('LEARNER-SECRET')
  })

  test('the status filter queries the API and "Load more" follows nextCursor', async () => {
    const m = api([], {
      [`GET ${REPORTS}`]: (url) =>
        url.searchParams.get('cursor')
          ? [200, { reports: [reportRow('r2')], nextCursor: null }]
          : [200, { reports: [reportRow('r1')], nextCursor: 'CUR1' }],
    })
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    await screen.findByRole('article', { name: 'Report r2' })
    expect(screen.getByRole('article', { name: 'Report r1' })).toBeInTheDocument()
    expect(m.callsTo(REPORTS)[1].url.searchParams.get('cursor')).toBe('CUR1')

    fireEvent.change(screen.getByLabelText('Report status'), { target: { value: 'confirmed' } })
    await waitFor(() => expect(m.callsTo(REPORTS).at(-1).url.searchParams.get('status')).toBe('confirmed'))
    expect(m.callsTo(REPORTS).at(-1).url.searchParams.get('cursor')).toBeNull()
  })

  test('resolve with unhide calls the API with status, note and unhide, then reloads', async () => {
    const m = api([reportRow('r1', { hiddenReason: 'reports_threshold', hiddenAt: TS, isPublished: false, seriousReporters: 2 })], {
      [`PATCH ${REPORTS}/r1`]: () => [200, { reportId: 'r1', status: 'resolved', unhidden: true, hidden: false }],
    })
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    const row = rowOf('r1')
    fireEvent.change(within(row).getByLabelText('Resolution note'), { target: { value: 'Card corrected' } })
    fireEvent.click(within(row).getByLabelText(/Unhide the card/))
    fireEvent.click(within(row).getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(m.callsTo(`${REPORTS}/r1`)).toHaveLength(1))
    const sent = m.callsTo(`${REPORTS}/r1`)[0]
    expect(sent.method).toBe('PATCH')
    expect(sent.body).toEqual({ status: 'resolved', note: 'Card corrected', unhide: true })
    await waitFor(() => expect(m.callsTo(REPORTS).length).toBe(2))
    expect(await screen.findByText(/Report resolved; the card is no longer hidden but not live — use Push live/)).toBeInTheDocument()
  })

  test('fix 1: no unhide checkbox on a stale-version report of a hidden card; resolve sends unhide false', async () => {
    const m = api(
      [reportRow('r1', { hiddenReason: 'reports_threshold', hiddenAt: TS, isPublished: false, reportVersion: 3, currentVersion: 4, isCurrentVersion: false })],
      { [`PATCH ${REPORTS}/r1`]: () => [200, { reportId: 'r1', status: 'resolved', unhidden: false, hidden: true }] },
    )
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    expect(within(rowOf('r1')).queryByLabelText(/Unhide the card/)).toBeNull()
    fireEvent.click(within(rowOf('r1')).getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(m.callsTo(`${REPORTS}/r1`)).toHaveLength(1))
    expect(m.callsTo(`${REPORTS}/r1`)[0].body).toEqual({ status: 'resolved', unhide: false })
  })

  test('dismiss sends unhide false; no unhide checkbox when the card is not hidden', async () => {
    const m = api([reportRow('r1')], {
      [`PATCH ${REPORTS}/r1`]: () => [200, { reportId: 'r1', status: 'dismissed', unhidden: false, hidden: false }],
    })
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    expect(within(rowOf('r1')).queryByLabelText(/Unhide the card/)).toBeNull()
    fireEvent.click(within(rowOf('r1')).getByRole('button', { name: 'Dismiss' }))
    await waitFor(() => expect(m.callsTo(`${REPORTS}/r1`)).toHaveLength(1))
    expect(m.callsTo(`${REPORTS}/r1`)[0].body).toEqual({ status: 'dismissed', unhide: false })
  })

  test('"Resolve all for this version" resolves every open report of the card version', async () => {
    const path = `${ADMIN}/cards/${CARD}/reports/resolve-all`
    const m = api([reportRow('r1', { hiddenReason: 'reports_threshold', hiddenAt: TS, isPublished: false })], {
      [`PATCH ${path}`]: () => [
        200,
        { cardId: CARD, contentVersion: 4, status: 'resolved', resolvedReportIds: ['r1', 'r9'], unhidden: true, hidden: false },
      ],
    })
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    const row = rowOf('r1')
    fireEvent.click(within(row).getByLabelText(/Unhide the card/))
    fireEvent.click(within(row).getByRole('button', { name: 'Resolve all for this version' }))
    await waitFor(() => expect(m.callsTo(path)).toHaveLength(1))
    expect(m.callsTo(path)[0].body).toEqual({ contentVersion: 4, status: 'resolved', unhide: true })
    expect(await screen.findByText(/Resolved 2 reports on version 4; the card is no longer hidden/)).toBeInTheDocument()
  })

  test('decided reports show the decision and offer no actions', async () => {
    api([reportRow('r1', { status: 'dismissed', resolvedAt: TS, resolutionNote: 'Not an error' })])
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    expect(within(rowOf('r1')).getByText(/Not an error/)).toBeInTheDocument()
    expect(within(rowOf('r1')).queryByRole('button', { name: 'Resolve' })).toBeNull()
  })

  test('an action error is shown with its message', async () => {
    api([reportRow('r1')], {
      [`PATCH ${REPORTS}/r1`]: () => [404, { error: 'Report not found', code: 'REPORT_NOT_FOUND' }],
    })
    render(<ReportsQueue onOpenCard={() => {}} />)
    await screen.findByRole('article', { name: 'Report r1' })
    fireEvent.click(within(rowOf('r1')).getByRole('button', { name: 'Resolve' }))
    expect(await within(rowOf('r1')).findByRole('alert')).toHaveTextContent('Report not found (REPORT_NOT_FOUND)')
  })
})

describe('admin screen integration', () => {
  const liveCard = adminCard(CARD, 'management:gout', { qaStatus: 'validated', isLive: true, isPublished: true, contentVersion: 4, topicName: 'Gout' })

  test('"Open card" on a report loads that card (state=all in its topic) with Live state, editor and images', async () => {
    const m = api([reportRow('r1')], {
      [`GET ${CARDS_PATH}`]: (url) =>
        url.searchParams.get('state') === 'all'
          ? url.searchParams.get('cursor') === 'P2'
            ? [200, { cards: [liveCard], nextCursor: null }]
            : [200, { cards: [adminCard('other', 'gout:other')], nextCursor: 'P2' }]
          : [200, { cards: [], nextCursor: null }],
      [`PATCH ${CARDS_PATH}/${CARD}`]: (url, call) => {
        const { topicName: _t, specialtyName: _s, ...dto } = liveCard
        return [200, { ...dto, answerMarkdown: call.body.answerMarkdown, contentVersion: 5 }]
      },
    })
    render(<AdminFlashcardsV2 />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Learner reports' }))
    await screen.findByRole('article', { name: 'Report r1' })
    fireEvent.click(within(rowOf('r1')).getByRole('button', { name: 'Open card' }))

    const dialog = await screen.findByRole('dialog', { name: 'Reported card — Gout' })
    const section = await within(dialog).findByRole('region', { name: 'Card management:gout' })
    const lookups = m.callsTo(CARDS_PATH).filter((c) => c.url.searchParams.get('state') === 'all')
    expect(lookups.map((c) => c.url.searchParams.get('topicId'))).toEqual([TOPIC, TOPIC])
    expect(within(section).getByText('Live')).toBeInTheDocument()
    expect(within(section).getByRole('region', { name: 'Front image management:gout' })).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Take off live' })).toBeInTheDocument()

    fireEvent.click(within(section).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(section).getByLabelText('Answer (Markdown)'), { target: { value: '- **NSAID or colchicine**' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(within(section).getByRole('region', { name: 'Back' })).toHaveTextContent('NSAID or colchicine'))
    expect(m.callsTo(`${CARDS_PATH}/${CARD}`)[0].body).toEqual({ expectedVersion: 4, answerMarkdown: '- **NSAID or colchicine**' })
    expect(within(section).getByText('Live')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('Push live on an opened hidden card reports why it was skipped', async () => {
    const hidden = { ...liveCard, isLive: false, isPublished: false, hiddenReason: 'reports_threshold' }
    const m = api([reportRow('r1')], {
      [`GET ${CARDS_PATH}`]: () => [200, { cards: [hidden], nextCursor: null }],
      [`POST ${CARDS_PATH}/live`]: () => [200, { changed: 0, skipped: [{ id: CARD, reason: 'hidden' }] }],
    })
    render(<AdminFlashcardsV2 />)
    fireEvent.click(await screen.findByRole('tab', { name: 'Learner reports' }))
    await screen.findByRole('article', { name: 'Report r1' })
    fireEvent.click(within(rowOf('r1')).getByRole('button', { name: 'Open card' }))
    const section = await screen.findByRole('region', { name: 'Card management:gout' })
    expect(within(section).getByText('Not live')).toBeInTheDocument()
    fireEvent.click(within(section).getByRole('button', { name: 'Push live' }))
    expect(await within(section).findByText(/Not pushed live: it is hidden after learner reports/)).toBeInTheDocument()
    expect(m.callsTo(`${CARDS_PATH}/live`)[0].body).toEqual({ cardIds: [CARD], live: true })
  })
})
