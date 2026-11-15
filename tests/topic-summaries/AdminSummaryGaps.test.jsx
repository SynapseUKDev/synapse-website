import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminSummaryGaps from '../../src/dashboard/admin/summaries/AdminSummaryGaps'
import { fetchGaps, setQuestionCategory } from '../../src/dashboard/admin/summaries/summaryAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchGaps: vi.fn(), setQuestionCategory: vi.fn() }
})

const QBANK_ADMIN = { capabilities: { can_manage_qbank: true } }
const Q1 = '10000000-0000-4000-8000-000000000001'

function renderAt(url, user = QBANK_ADMIN) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user }} />}>
          <Route path="admin/summaries/gaps" element={<AdminSummaryGaps />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => vi.clearAllMocks())

describe('AdminSummaryGaps', () => {
  test('lists uncategorised questions and categorises one in place', async () => {
    vi.mocked(fetchGaps).mockResolvedValue({
      total: 1,
      items: [{ id: Q1, stem: 'A 30-year-old with wheeze', topic_name: 'Asthma', question_category: null }],
    })
    renderAt('/dashboard/admin/summaries/gaps?kind=no_category')
    expect(await screen.findByRole('link', { name: 'A 30-year-old with wheeze' })).toHaveAttribute('href', `/dashboard/admin/questions/${Q1}`)
    expect(fetchGaps).toHaveBeenCalledWith({ kind: 'no_category', page: 1, page_size: 25 }, expect.anything())
    expect(screen.getByRole('link', { name: 'Choose summary' })).toHaveAttribute('href', `/dashboard/admin/questions/${Q1}#summary`)

    vi.mocked(setQuestionCategory).mockResolvedValue({
      question_category: 'management',
      auto_linked: true,
      manual_choice: false,
      link: { automatic_summary: { subject_label: 'Asthma', question_category: 'management', scope_label: 'General', topic: { name: 'Asthma' } } },
    })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'management' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save category' }))
    await waitFor(() => expect(setQuestionCategory).toHaveBeenCalledWith(Q1, 'management'))
    expect(await screen.findByText(/Category saved and linked automatically/)).toBeInTheDocument()
    expect(screen.getByText('Linked')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Choose summary' })).toBeNull()
  })

  test('switches to questions with no summary', async () => {
    vi.mocked(fetchGaps).mockResolvedValue({ total: 0, items: [] })
    renderAt('/dashboard/admin/summaries/gaps?kind=no_category')
    expect(await screen.findByText('Nothing to fix here.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not linked' }))
    await waitFor(() =>
      expect(fetchGaps).toHaveBeenLastCalledWith({ kind: 'not_linked', page: 1, page_size: 25 }, expect.anything()),
    )
  })

  test('needs question-bank permission', () => {
    renderAt('/dashboard/admin/summaries/gaps', { capabilities: {} })
    expect(screen.getByText('Question-bank admin permission is required.')).toBeInTheDocument()
    expect(fetchGaps).not.toHaveBeenCalled()
  })
})
