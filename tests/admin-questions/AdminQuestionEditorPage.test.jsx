import React from 'react'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminQuestionEditorPage from '../../src/dashboard/admin/questions/AdminQuestionEditorPage'
import { confirmNavigation } from '../../src/dashboard/navigationGuard'
import {
  AdminQuestionApiError,
  createQuestion,
  fetchQuestion,
  fetchTaxonomy,
  updateQuestion,
} from '../../src/dashboard/admin/questions/questionAdminApi'

vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchTaxonomy: vi.fn(),
    fetchQuestion: vi.fn(),
    createQuestion: vi.fn(),
    updateQuestion: vi.fn(),
  }
})

const QBANK_ADMIN = { id: 'u1', capabilities: { can_manage_qbank: true } }
const QUESTION_ID = 'q1'
const saved = {
  id: QUESTION_ID,
  topic_id: 't1',
  type: 'MCQ',
  stem: 'Which drug?',
  options: ['Aspirin', 'Heparin'],
  correct_answer: 1,
  difficulty: null,
  explanation_l2: null,
  explanation_eli5: null,
  explanation_points_by_option: null,
  is_active: false,
  version: 3,
  updated_at: '2026-09-27T10:00:00Z',
  images: [],
}

function renderAt(path, user = QBANK_ADMIN) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user }} />}>
          <Route path="admin" element={<p>Admin home</p>} />
          <Route path="admin/questions/new" element={<AdminQuestionEditorPage />} />
          <Route path="admin/questions/:questionId" element={<AdminQuestionEditorPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(fetchTaxonomy).mockResolvedValue({
    specialties: [{ id: 's1', name: 'Cardiology', slug: 'c', topics: [{ id: 't1', name: 'ACS', slug: 'acs' }] }],
  })
  vi.mocked(fetchQuestion).mockResolvedValue({ question: saved })
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

async function editStem(value) {
  const stem = await screen.findByLabelText(/Question stem/)
  fireEvent.change(stem, { target: { value } })
  return stem
}

describe('AdminQuestionEditorPage', () => {
  test('does not render the editor without QBank permission', () => {
    renderAt('/dashboard/admin/questions/new', { id: 'u2', capabilities: {} })
    expect(screen.getByText(/permission is required/)).toBeInTheDocument()
    expect(fetchTaxonomy).not.toHaveBeenCalled()
  })

  test('saves an edit with the loaded version and shows the new version', async () => {
    vi.mocked(updateQuestion).mockResolvedValue({ question: { ...saved, stem: 'Which dose?', version: 4 } })
    renderAt(`/dashboard/admin/questions/${QUESTION_ID}`)
    await editStem('Which dose?')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await screen.findByText('Saved as an inactive draft (version 4).')
    expect(updateQuestion).toHaveBeenCalledWith(QUESTION_ID, 3, expect.objectContaining({ stem: 'Which dose?', correct_answer: 1 }))
    expect(screen.queryByText('Unsaved changes')).toBeNull()
  })

  test('keeps entered content and links each validation error to its field', async () => {
    vi.mocked(createQuestion).mockRejectedValue(
      new AdminQuestionApiError({
        status: 400,
        kind: 'validation',
        message: 'Invalid',
        issues: [
          { code: 'too_small', field: 'topic_id', message: 'Choose an existing topic.' },
          { code: 'too_big', field: 'options.1', message: 'Too long.' },
        ],
      }),
    )
    renderAt('/dashboard/admin/questions/new')
    await editStem('My draft stem')
    fireEvent.click(screen.getByRole('button', { name: 'Save inactive draft' }))

    const summary = await screen.findByRole('alert')
    expect(summary).toHaveTextContent('Topic: Choose an existing topic.')
    expect(summary).toHaveTextContent('Option B: Too long.')
    expect(screen.getByLabelText(/Question stem/)).toHaveValue('My draft stem')

    fireEvent.click(screen.getByRole('link', { name: 'Option B: Too long.' }))
    expect(screen.getByLabelText('Option B text')).toHaveFocus()
  })

  test('on a version conflict it keeps local edits and offers the latest version', async () => {
    vi.mocked(updateQuestion).mockRejectedValue(
      new AdminQuestionApiError({ status: 409, kind: 'conflict', message: 'Changed elsewhere.', currentVersion: 5 }),
    )
    renderAt(`/dashboard/admin/questions/${QUESTION_ID}`)
    await editStem('My local edit')
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await screen.findByText(/The latest saved version is 5; you were editing version 3/)
    expect(screen.getByLabelText(/Question stem/)).toHaveValue('My local edit')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(fetchQuestion).mockResolvedValue({ question: { ...saved, stem: 'Their edit', version: 5 } })
    fireEvent.click(screen.getByRole('button', { name: 'Load latest version' }))
    await waitFor(() => expect(screen.getByLabelText(/Question stem/)).toHaveValue('Their edit'))
  })

  test('an active question is read-only', async () => {
    vi.mocked(fetchQuestion).mockResolvedValue({ question: { ...saved, is_active: true } })
    renderAt(`/dashboard/admin/questions/${QUESTION_ID}`)
    expect(await screen.findByLabelText(/Question stem/)).toBeDisabled()
    expect(screen.getByText(/Deactivate it before editing/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  test('warns before leaving only while there are unsaved changes', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(`/dashboard/admin/questions/${QUESTION_ID}`)
    await screen.findByLabelText(/Question stem/)

    // Clean form: back link navigates without asking.
    expect(confirmNavigation()).toBe(true)
    expect(confirm).not.toHaveBeenCalled()

    await editStem('Dirty')
    expect(confirmNavigation()).toBe(false)
    act(() => {
      fireEvent.click(screen.getByRole('link', { name: 'Cancel' }))
    })
    expect(confirm).toHaveBeenCalled()
    expect(screen.queryByText('Admin home')).toBeNull()
    expect(screen.getByLabelText(/Question stem/)).toHaveValue('Dirty')
  })

  test('the preview reflects unsaved content', async () => {
    renderAt(`/dashboard/admin/questions/${QUESTION_ID}`)
    await editStem('Preview this **bold** stem')
    expect(screen.getByText('bold').tagName).toBe('STRONG')
  })
})
