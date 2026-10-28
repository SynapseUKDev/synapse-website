import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import QuestionSummaryControl from '../../src/dashboard/admin/summaries/QuestionSummaryControl'
import {
  clearQuestionLink,
  fetchQuestionLink,
  fetchSummary,
  listSummaries,
  setQuestionLink,
} from '../../src/dashboard/admin/summaries/summaryAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchQuestionLink: vi.fn(),
    setQuestionLink: vi.fn(),
    clearQuestionLink: vi.fn(),
    listSummaries: vi.fn(),
    fetchSummary: vi.fn(),
  }
})

const Q = 'q-misfiled'
const brief = (id, topic, overrides = {}) => ({
  id,
  kind: 'condition',
  question_category: 'management',
  subject_label: topic,
  scope_label: 'General',
  status: 'published',
  topic: { id: `t-${id}`, name: topic },
  ...overrides,
})
const epiglottitis = brief('s-epi', 'Epiglottitis')
const croup = brief('s-croup', 'Croup')
const learner = (id, title) => ({ summary_id: id, version_id: `v-${id}`, title, body_markdown: 'Body', sources: [] })
const automatic = {
  question_id: Q,
  mode: 'automatic',
  manual_summary: null,
  automatic_summary: epiglottitis,
  learning_summary: learner('s-epi', 'Epiglottitis management'),
}
const manual = {
  ...automatic,
  mode: 'manual',
  manual_summary: croup,
  set_at: '2026-10-28T10:00:00Z',
  learning_summary: learner('s-croup', 'Croup management'),
}

beforeEach(() => {
  vi.mocked(fetchQuestionLink).mockResolvedValue(automatic)
  vi.mocked(listSummaries).mockResolvedValue({ summaries: [croup, epiglottitis] })
  vi.mocked(fetchSummary).mockResolvedValue({
    summary: { ...croup, active_version_id: 'v-croup' },
    versions: [{ id: 'v-croup', version: 1, title: 'Croup management', body_markdown: 'Dexamethasone first.' }],
  })
})

afterEach(() => vi.clearAllMocks())

describe('QuestionSummaryControl', () => {
  test('a misfiled question can be given Croup → Management after a preview, then reset to automatic', async () => {
    const onChange = vi.fn()
    render(<QuestionSummaryControl questionId={Q} onChange={onChange} />)
    expect(await screen.findByText('Epiglottitis → Management')).toBeInTheDocument()
    expect(screen.getByText('Automatic')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Use automatic selection' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Change summary' }))
    fireEvent.change(screen.getByLabelText(/Search published summaries in any topic/), { target: { value: 'croup' } })
    await waitFor(() =>
      expect(listSummaries).toHaveBeenLastCalledWith(
        { status: 'published', q: 'croup', page_size: 20 },
        expect.objectContaining({ signal: expect.anything() }),
      ),
    )
    const save = screen.getByRole('button', { name: 'Save for this question' })
    expect(save).toBeDisabled()
    fireEvent.click(await screen.findByRole('button', { name: 'Croup → Management' }))
    expect(await screen.findByText('Dexamethasone first.')).toBeInTheDocument()

    vi.mocked(setQuestionLink).mockResolvedValue(manual)
    fireEvent.click(save)
    await waitFor(() => expect(setQuestionLink).toHaveBeenCalledWith(Q, 's-croup'))
    expect(onChange).toHaveBeenLastCalledWith(manual.learning_summary)
    expect(await screen.findByText(/Everyone viewing this question now sees Croup → Management/)).toBeInTheDocument()
    expect(screen.getByText(/Manual choice/)).toBeInTheDocument()
    expect(screen.getByText('Automatic match: Epiglottitis → Management')).toBeInTheDocument()

    vi.mocked(clearQuestionLink).mockResolvedValue(automatic)
    fireEvent.click(screen.getByRole('button', { name: 'Use automatic selection' }))
    await waitFor(() => expect(clearQuestionLink).toHaveBeenCalledWith(Q))
    expect(onChange).toHaveBeenLastCalledWith(automatic.learning_summary)
    expect(await screen.findByText(/Back to automatic matching: Epiglottitis → Management/)).toBeInTheDocument()
  })

  test('shows the server error and keeps the picker open when saving fails', async () => {
    render(<QuestionSummaryControl questionId={Q} onChange={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Change summary' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Croup → Management' }))
    await screen.findByText('Dexamethasone first.')
    vi.mocked(setQuestionLink).mockRejectedValue(new Error('Only a published summary can be chosen.'))
    fireEvent.click(screen.getByRole('button', { name: 'Save for this question' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Only a published summary can be chosen.')
    expect(screen.getByRole('button', { name: 'Save for this question' })).toBeInTheDocument()
  })
})
