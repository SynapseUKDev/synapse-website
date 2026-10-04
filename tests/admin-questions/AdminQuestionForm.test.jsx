import React, { useReducer } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import AdminQuestionForm from '../../src/dashboard/admin/questions/AdminQuestionForm'
import { formFromQuestion, questionFormReducer, toQuestionPayload } from '../../src/dashboard/admin/questions/questionFormModel'

const taxonomy = [
  { id: 's1', name: 'Cardiology', slug: 'cardio', topics: [{ id: 't1', name: 'ACS', slug: 'acs' }] },
  { id: 's2', name: 'Renal', slug: 'renal', topics: [{ id: 't2', name: 'AKI', slug: 'aki' }] },
]

const stored = {
  topic_id: 't1',
  type: 'MCQ',
  stem: 'Which drug?',
  options: ['Aspirin', 'Heparin', 'Warfarin'],
  correct_answer: 1,
  difficulty: 'hard',
  explanation_points_by_option: { 1: ['Correct.'] },
}

let latestForm
function Harness({ initial = stored, errors, readOnly }) {
  const [form, dispatch] = useReducer(questionFormReducer, initial, formFromQuestion)
  latestForm = form
  return <AdminQuestionForm form={form} dispatch={dispatch} taxonomy={taxonomy} errors={errors} readOnly={readOnly} />
}

describe('AdminQuestionForm', () => {
  test('every control has an accessible name', () => {
    render(<Harness />)
    expect(screen.getByRole('combobox', { name: 'Topic' })).toHaveValue('Cardiology › ACS')
    expect(screen.getByLabelText('Difficulty')).toHaveValue('hard')
    expect(screen.getByLabelText(/Question stem/)).toHaveValue('Which drug?')
    expect(screen.getByLabelText('Option B text')).toHaveValue('Heparin')
    expect(screen.getByRole('radio', { name: 'Correct answer is option B' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Move option A up' })).toBeDisabled()
    expect(screen.getByLabelText(/Explanation points for option B/)).toHaveValue('Correct.')
  })

  test('the topic picker searches topics and specialties and selects with the keyboard', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Topic' })
    fireEvent.focus(input)
    expect(screen.getByRole('listbox', { name: 'Topics' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Cardiology' })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: 'renal' } })
    expect(screen.getByText('1 of 2 topics match')).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'ACS' })).toBeNull()
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input).toHaveValue('Renal › AKI')
    expect(toQuestionPayload(latestForm).topic_id).toBe('t2')
  })

  test('escape closes the topic picker without changing the topic', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Topic' })
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value: 'aki' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('Cardiology › ACS')
    expect(toQuestionPayload(latestForm).topic_id).toBe('t1')
  })

  test('moving the correct option keeps it selected and moves its explanation', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Move option B up' }))
    expect(screen.getByLabelText('Option A text')).toHaveValue('Heparin')
    expect(screen.getByRole('radio', { name: 'Correct answer is option A' })).toBeChecked()
    expect(screen.getByLabelText(/Explanation points for option A/)).toHaveValue('Correct.')
    expect(toQuestionPayload(latestForm)).toMatchObject({
      options: ['Heparin', 'Aspirin', 'Warfarin'],
      correct_answer: 0,
      explanation_points_by_option: { 0: ['Correct.'] },
    })
  })

  test('adds and removes options within the 2–8 limits', () => {
    render(<Harness initial={{ ...stored, options: ['A', 'B'], correct_answer: 0 }} />)
    expect(screen.getByRole('button', { name: 'Remove option A' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Add option' }))
    expect(screen.getByLabelText('Option C text')).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Remove option A' }))
    expect(screen.getByLabelText('Option A text')).toHaveValue('B')
    expect(toQuestionPayload(latestForm).correct_answer).toBeNull()
  })

  test('shows server errors beside the responsible field and option', () => {
    const form = formFromQuestion(stored)
    const errors = {
      fields: { stem: ['Question stem is required.'], correct_answer: ['Correct answer must reference an existing option.'] },
      options: {},
    }
    render(<Harness errors={errors} />)
    const stem = screen.getByLabelText(/Question stem/)
    expect(stem).toHaveAttribute('aria-invalid', 'true')
    expect(stem).toHaveAccessibleDescription('Question stem is required.')
    expect(screen.getByText('Correct answer must reference an existing option.')).toBeInTheDocument()
    expect(form).toBeTruthy()
  })

  test('read-only mode disables every input', () => {
    render(<Harness readOnly />)
    expect(screen.getByLabelText(/Question stem/)).toBeDisabled()
    expect(screen.getByLabelText('Option A text')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add option' })).toBeDisabled()
  })
})
