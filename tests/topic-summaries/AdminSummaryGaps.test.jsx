import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminSummaryGaps from '../../src/dashboard/admin/summaries/AdminSummaryGaps'
import { fetchGaps, setQuestionCategory, setQuestionCondition } from '../../src/dashboard/admin/summaries/summaryAdminApi'
import { fetchTaxonomyCached } from '../../src/dashboard/admin/questions/questionAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchGaps: vi.fn(), setQuestionCategory: vi.fn(), setQuestionCondition: vi.fn() }
})
vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchTaxonomyCached: vi.fn() }
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
  test('changes a question’s condition in place and keeps its category', async () => {
    const T1 = 'aaaaaaaa-0000-4000-8000-000000000001'
    const T2 = 'aaaaaaaa-0000-4000-8000-000000000002'
    vi.mocked(fetchGaps).mockResolvedValue({
      total: 1,
      items: [{ id: Q1, stem: 'A 60-year-old with COPD', topic_id: T1, topic_name: 'Acid-Base Abnormality', question_category: 'management' }],
    })
    vi.mocked(fetchTaxonomyCached).mockResolvedValue({
      specialties: [{ id: 's1', name: 'Respiratory', topics: [{ id: T1, name: 'Acid-Base Abnormality' }, { id: T2, name: 'COPD' }] }],
    })
    vi.mocked(setQuestionCondition).mockResolvedValue({
      topic: { id: T2, name: 'COPD' },
      question_category: 'management',
      auto_linked: true,
      manual_choice: false,
      link: { automatic_summary: { subject_label: 'COPD', question_category: 'management', scope_label: 'General', topic: { name: 'COPD' } } },
    })
    renderAt('/dashboard/admin/summaries/gaps?kind=not_linked')
    fireEvent.click(await screen.findByRole('button', { name: 'Change condition (now Acid-Base Abnormality)' }))
    const input = await screen.findByRole('combobox', { name: 'Condition' })
    expect(screen.getByRole('button', { name: 'Save condition' })).toBeDisabled()
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'copd' } })
    fireEvent.click(screen.getByRole('option', { name: 'COPD' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save condition' }))
    await waitFor(() => expect(setQuestionCondition).toHaveBeenCalledWith(Q1, T2))
    expect(await screen.findByText(/Condition changed and linked automatically/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change condition (now COPD)' })).toBeInTheDocument()
    expect(screen.getByLabelText('Category')).toHaveValue('management')
    expect(screen.getByText('Linked')).toBeInTheDocument()
  })

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
