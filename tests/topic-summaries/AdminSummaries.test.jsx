import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminSummaries from '../../src/dashboard/admin/summaries/AdminSummaries'
import { clearSummariesCache, dropFromSummariesCache } from '../../src/dashboard/admin/summaries/summariesListCache'
import { fetchCoverage, listAttention, listSummaries } from '../../src/dashboard/admin/summaries/summaryAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchCoverage: vi.fn(), listSummaries: vi.fn(), deleteSummary: vi.fn(), listAttention: vi.fn() }
})

const row = (id, subject) => ({
  id,
  kind: 'condition',
  question_category: 'management',
  subject_label: subject,
  scope_label: 'General',
  status: 'draft',
  row_version: 1,
  latest_version: null,
  linked_questions: 3,
  manual_questions: 0,
  open_reports: 0,
})
const page = (rows) => ({ summaries: rows, total: rows.length, page: 1, page_size: 25 })
const COVERAGE = { active_questions: 1234, with_category: 1000, linked: 800, linked_published: 700, unresolved_by_reason: { scope_unresolved: 12, source_missing: 7 } }

const renderList = () =>
  render(
    <MemoryRouter>
      <AdminSummaries />
    </MemoryRouter>,
  )

beforeEach(() => {
  clearSummariesCache()
  vi.mocked(fetchCoverage).mockResolvedValue(COVERAGE)
  vi.mocked(listSummaries).mockResolvedValue(page([row('s-1', 'Croup'), row('s-2', 'Asthma')]))
  vi.mocked(listAttention).mockResolvedValue({ items: [], total: 3, counts: { draft: 2, awaiting_content: 1 } })
})

afterEach(() => vi.clearAllMocks())

describe('AdminSummaries cache', () => {
  test('coming back shows the last results and filters at once, then refreshes in the background', async () => {
    const first = renderList()
    expect(await screen.findByText('Croup')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'draft' } })
    await waitFor(() => expect(listSummaries).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'draft' }), expect.anything()))
    await screen.findByText('Croup')
    first.unmount()

    let finish
    vi.mocked(listSummaries).mockReturnValue(new Promise((resolve) => { finish = resolve }))
    vi.mocked(fetchCoverage).mockReturnValue(new Promise(() => {}))
    renderList()
    // Before the new request answers: cached rows, cached coverage, remembered filter.
    expect(screen.getByText('Croup')).toBeInTheDocument()
    expect(screen.getByText('1,234')).toBeInTheDocument()
    expect(screen.getByLabelText('Status')).toHaveValue('draft')
    expect(screen.getByText(/Updating…/)).toBeInTheDocument()

    finish(page([row('s-3', 'Sepsis')]))
    expect(await screen.findByText('Sepsis')).toBeInTheDocument()
    expect(screen.queryByText('Croup')).toBeNull()
    expect(screen.queryByText(/Updating…/)).toBeNull()
  })

  test('a summary deleted on its own page is gone from the list straight away', async () => {
    const first = renderList()
    await screen.findByText('Asthma')
    first.unmount()
    dropFromSummariesCache('s-2')
    vi.mocked(listSummaries).mockReturnValue(new Promise(() => {}))
    renderList()
    expect(screen.getByText('Croup')).toBeInTheDocument()
    expect(screen.queryByText('Asthma')).toBeNull()
  })
})

describe('AdminSummaries review shortcuts', () => {
  test('Needs attention and the unresolved queue are buttons with their counts', async () => {
    renderList()
    const attention = await screen.findByRole('link', { name: /Needs attention/ })
    expect(attention).toHaveAttribute('href', '/dashboard/admin/summaries/attention')
    await waitFor(() => expect(attention).toHaveTextContent('3'))
    expect(attention).toHaveClass('asum-shortcut--attention')
    const queue = screen.getByRole('link', { name: /Unresolved queue/ })
    expect(queue).toHaveAttribute('href', '/dashboard/admin/summaries/queue')
    await waitFor(() => expect(queue).toHaveTextContent('19'))
    expect(listAttention).toHaveBeenCalledWith({ state: 'open', page_size: 1 }, expect.anything())
  })
})
