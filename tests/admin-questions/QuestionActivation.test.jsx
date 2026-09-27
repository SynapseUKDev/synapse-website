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

function attestation(version = 4) {
  return screen.getByRole('checkbox', { name: new RegExp(`I have reviewed version ${version}`) })
}

describe('QuestionActivationPanel', () => {
  test('requires a source and an unticked-by-default attestation for the current version', async () => {
    const onChanged = vi.fn()
    vi.mocked(activateQuestion).mockResolvedValue({ question: active })
    render(<QuestionActivationPanel question={draft} onChanged={onChanged} />)

    const button = screen.getByRole('button', { name: 'Activate version 4' })
    expect(attestation()).not.toBeChecked()
    expect(button).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Clinical source/), { target: { value: '  NICE NG185  ' } })
    expect(button).toBeDisabled()
    fireEvent.click(attestation())
    expect(button).toBeEnabled()

    fireEvent.click(button)
    await waitFor(() => expect(onChanged).toHaveBeenCalledWith(active))
    expect(activateQuestion).toHaveBeenCalledWith('q1', { expectedVersion: 4, clinicalSourceReference: 'NICE NG185', attested: true })
  })

  test('clears the attestation when the version changes', () => {
    const { rerender } = render(<QuestionActivationPanel question={draft} />)
    fireEvent.click(attestation())
    expect(attestation()).toBeChecked()
    rerender(<QuestionActivationPanel question={{ ...draft, version: 5 }} />)
    expect(attestation(5)).not.toBeChecked()
  })

  test('is blocked while there are unsaved changes', () => {
    render(<QuestionActivationPanel question={draft} blockedReason="Save your changes first." />)
    expect(screen.getByText('Save your changes first.')).toBeInTheDocument()
    expect(attestation()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Activate version 4' })).toBeDisabled()
  })

  test('lists blocking problems such as missing image alt text', async () => {
    vi.mocked(activateQuestion).mockRejectedValue(
      new AdminQuestionApiError({
        status: 400,
        kind: 'validation',
        message: 'Invalid',
        issues: [{ code: 'image_alt_required', field: 'images.1.alt', message: 'Image 2 needs alternative text before activation.' }],
      }),
    )
    render(<QuestionActivationPanel question={draft} />)
    fireEvent.change(screen.getByLabelText(/Clinical source/), { target: { value: 'NICE' } })
    fireEvent.click(attestation())
    fireEvent.click(screen.getByRole('button', { name: 'Activate version 4' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Image 2 alt text: Image 2 needs alternative text before activation.')
  })

  test('deactivates an active question after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const onChanged = vi.fn()
    vi.mocked(deactivateQuestion).mockResolvedValue({ question: { ...draft, version: 6 } })
    render(<QuestionActivationPanel question={active} onChanged={onChanged} />)
    expect(screen.getByText(/Clinical source: NICE NG185/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate to edit' }))
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

  test('deactivate, edit, and the form becomes editable; activation is blocked while edits are unsaved', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(fetchQuestion).mockResolvedValue({ question: active })
    vi.mocked(deactivateQuestion).mockResolvedValue({ question: { ...draft, version: 6 } })
    renderEditor()

    expect(await screen.findByLabelText(/Question stem/)).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate to edit' }))
    await waitFor(() => expect(screen.getByLabelText(/Question stem/)).toBeEnabled())

    fireEvent.change(screen.getByLabelText(/Question stem/), { target: { value: 'Which dose?' } })
    expect(screen.getByText(/Save your changes first/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Activate version 6' })).toBeDisabled()
  })
})
