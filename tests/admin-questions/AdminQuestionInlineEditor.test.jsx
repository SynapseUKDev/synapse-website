import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { AdminQuestionInlineEditor } from '../../src/dashboard/admin/AdminEditors'
import {
  AdminQuestionApiError,
  fetchQuestion,
  fetchTaxonomyCached,
  updateQuestion,
} from '../../src/dashboard/admin/questions/questionAdminApi'
import { mergeAdminQuestionUpdate } from '../../src/dashboard/practice/questionPresentationUtils'

vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, fetchQuestion: vi.fn(), fetchTaxonomyCached: vi.fn(), updateQuestion: vi.fn() }
})

const saved = {
  id: 'q1',
  topic_id: 't1',
  type: 'MCQ',
  stem: 'Which drug?',
  options: ['Aspirin', 'Heparin'],
  correct_answer: 1,
  difficulty: 'easy',
  explanation_l2: 'Detailed.',
  explanation_eli5: null,
  explanation_points_by_option: null,
  is_active: false,
  version: 2,
  images: [{ id: 'img1', asset_type: 'image', asset_url: 'https://x/1.png', alt: 'ECG', position: 1 }],
}

function renderEditor(props = {}) {
  return render(
    <MemoryRouter>
      <AdminQuestionInlineEditor questionId="q1" {...props} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.mocked(fetchTaxonomyCached).mockResolvedValue({
    specialties: [{ id: 's1', name: 'Cardiology', topics: [{ id: 't1', name: 'ACS', slug: 'acs' }] }],
  })
  vi.mocked(fetchQuestion).mockResolvedValue({ question: saved })
})

afterEach(() => vi.clearAllMocks())

describe('AdminQuestionInlineEditor', () => {
  test('loads the question into the shared form with topic context and a full-editor link', async () => {
    renderEditor()
    expect(await screen.findByRole('combobox', { name: 'Topic' })).toHaveValue('Cardiology › ACS')
    expect(screen.getByLabelText('Difficulty')).toHaveValue('easy')
    expect(screen.getByRole('link', { name: 'Open in full editor' })).toHaveAttribute('href', '/dashboard/admin/questions/q1')
    expect(screen.getByText(/1 image attached/)).toBeInTheDocument()
  })

  test('saves with the loaded version, without images, and reports the saved question', async () => {
    const onSaved = vi.fn()
    vi.mocked(updateQuestion).mockResolvedValue({ question: { ...saved, stem: 'Which dose?', version: 3 } })
    renderEditor({ onSaved })
    fireEvent.change(await screen.findByLabelText(/Question stem/), { target: { value: 'Which dose?' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))

    await screen.findByText('Saved (version 3).')
    const [id, version, payload] = vi.mocked(updateQuestion).mock.calls[0]
    expect([id, version]).toEqual(['q1', 2])
    expect(payload).toMatchObject({ stem: 'Which dose?', options: ['Aspirin', 'Heparin'], correct_answer: 1, difficulty: 'easy' })
    expect(payload).not.toHaveProperty('assets')
    expect(payload).not.toHaveProperty('is_active')
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ version: 3 }))
  })

  test('keeps local edits on a version conflict', async () => {
    vi.mocked(updateQuestion).mockRejectedValue(
      new AdminQuestionApiError({ status: 409, kind: 'conflict', message: 'Changed elsewhere.', currentVersion: 4 }),
    )
    renderEditor()
    fireEvent.change(await screen.findByLabelText(/Question stem/), { target: { value: 'Mine' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save question' }))
    await screen.findByText(/The latest saved version is 4/)
    expect(screen.getByLabelText(/Question stem/)).toHaveValue('Mine')
  })

  test('an active question can be edited inline and says changes go live', async () => {
    vi.mocked(fetchQuestion).mockResolvedValue({ question: { ...saved, is_active: true } })
    renderEditor()
    const stem = await screen.findByLabelText(/Question stem/)
    expect(stem).toBeEnabled()
    expect(screen.getByText(/Saved changes are visible to learners immediately/)).toBeInTheDocument()
    fireEvent.change(stem, { target: { value: 'Fixed' } })
    expect(screen.getByRole('button', { name: 'Save question' })).toBeEnabled()
  })
})

describe('mergeAdminQuestionUpdate', () => {
  const sessionQuestion = {
    id: 'q1',
    topic_name: 'ACS',
    options: [{ id: 0, label: 'A', body: 'Old' }],
    assets: [{ id: 'old', url: 'https://x/old.png' }],
    explanations: { detailed: 'Old', textbook: 'kept' },
  }

  test('maps the save response into the learner shape, including images', () => {
    const merged = mergeAdminQuestionUpdate(sessionQuestion, saved)
    expect(merged.options).toEqual([
      { id: 0, label: 'A', body: 'Aspirin' },
      { id: 1, label: 'B', body: 'Heparin' },
    ])
    expect(merged.assets).toEqual([
      { id: 'img1', type: 'image', url: 'https://x/1.png', alt: 'ECG', caption: null, credit: null, position: 1 },
    ])
    expect(merged.explanations).toMatchObject({ detailed: 'Detailed.', eli5: '', textbook: 'kept' })
    expect(merged.topic_name).toBe('ACS')
  })

  test('keeps existing images when the response has none', () => {
    const { images: _images, ...withoutImages } = saved
    expect(mergeAdminQuestionUpdate(sessionQuestion, withoutImages).assets).toBe(sessionQuestion.assets)
  })
})
