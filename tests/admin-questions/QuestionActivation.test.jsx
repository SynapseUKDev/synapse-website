import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import QuestionActivationPanel from '../../src/dashboard/admin/questions/QuestionActivationPanel'
import AdminQuestionEditorPage from '../../src/dashboard/admin/questions/AdminQuestionEditorPage'
import {
  AdminQuestionApiError,
  activateQuestion,
  deactivateQuestion,
  fetchQuestion,
  fetchTaxonomy,
} from '../../src/dashboard/admin/questions/questionAdminApi'

vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    activateQuestion: vi.fn(),
    deactivateQuestion: vi.fn(),
    fetchQuestion: vi.fn(),
    fetchTaxonomy: vi.fn(),
  }
})

const draft = {
  id: 'q1',
  topic_id: 't1',
  type: 'MCQ',
  stem: 'Which drug?',
  options: ['A', 'B'],
  correct_answer: 1,
  difficulty: null,
  explanation_l2: null,
  explanation_eli5: null,
  explanation_points_by_option: null,
  is_active: false,
  version: 4,
  updated_at: '2026-09-28T10:00:00Z',
  images: [],
}
const active = { ...draft, is_active: true, version: 5, activated_at: '2026-09-28T11:00:00Z', clinical_source_reference: 'NICE NG185' }

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})


describe('QuestionActivationPanel', () => {
  test('activates the saved version after a confirmation, with no source or checkbox', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onChanged = vi.fn()
    vi.mocked(activateQuestion).mockResolvedValue({ question: active })
    render(<QuestionActivationPanel question={draft} onChanged={onChanged} />)
    expect(screen.queryByLabelText(/Clinical source/)).toBeNull()
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(active))
    expect(activateQuestion).toHaveBeenCalledWith('q1', { expectedVersion: 4 })
  })

  test('does nothing if the confirmation is cancelled', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<QuestionActivationPanel question={draft} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))
    expect(activateQuestion).not.toHaveBeenCalled()
  })

  test('is blocked while there are unsaved changes', () => {
    render(<QuestionActivationPanel question={draft} blockedReason="Save your changes first." />)
    expect(screen.getByText('Save your changes first.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
  })

  test('lists blocking problems such as missing image alt text', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(activateQuestion).mockRejectedValue(
      new AdminQuestionApiError({
        status: 400,
        kind: 'validation',
        message: 'Invalid',
        issues: [{ code: 'image_alt_required', field: 'images.1.alt', message: 'Image 2 needs alternative text before activation.' }],
      }),
    )
    render(<QuestionActivationPanel question={draft} />)
    fireEvent.click(screen.getByRole('button', { name: 'Activate' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Image 2 alt text: Image 2 needs alternative text before activation.')
  })

  test('deactivates a live question after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onChanged = vi.fn()
    vi.mocked(deactivateQuestion).mockResolvedValue({ question: { ...draft, version: 6 } })
    render(<QuestionActivationPanel question={active} onChanged={onChanged} />)
    fireEvent.click(screen.getByRole('button', { name: /Deactivate \(hide from learners\)/ }))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
    expect(deactivateQuestion).toHaveBeenCalledWith('q1', 5)
  })
})

describe('editor activation flow', () => {
  beforeEach(() => {
    vi.mocked(fetchTaxonomy).mockResolvedValue({ specialties: [{ id: 's1', name: 'Cardio', slug: 'c', topics: [{ id: 't1', name: 'ACS', slug: 'acs' }] }] })
  })

  function renderEditor() {
    return render(
      <MemoryRouter initialEntries={['/dashboard/admin/questions/q1']}>
        <Routes>
          <Route path="/dashboard" element={<Outlet context={{ user: { capabilities: { can_manage_qbank: true } } }} />}>
            <Route path="admin/questions/:questionId" element={<AdminQuestionEditorPage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    )
  }

  test('a live question is editable, and activation is blocked only while edits are unsaved', async () => {
    vi.mocked(fetchQuestion).mockResolvedValue({ question: draft })
    renderEditor()
    const stem = await screen.findByLabelText(/Question stem/)
    expect(screen.getByRole('button', { name: 'Activate' })).toBeEnabled()
    fireEvent.change(stem, { target: { value: 'Which dose?' } })
    expect(screen.getByText(/Save your changes first/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate' })).toBeDisabled()
  })
})
