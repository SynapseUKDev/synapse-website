import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import QuestionPreview from '../../src/dashboard/admin/questions/QuestionPreview'
import { buildQuickPoints } from '../../src/dashboard/practice/questionPresentationUtils'

const question = {
  stem: 'A 60-year-old has **crushing** chest pain.',
  options: ['Aspirin', 'Heparin', 'Warfarin', 'Morphine', 'Oxygen', 'GTN', 'Clopidogrel'],
  correct_answer: 6,
  explanation_l2: 'Detailed reasoning.',
  explanation_eli5: 'Simple reasoning.',
  explanation_points_by_option: { 0: ['Give aspirin too.'], 6: ['Dual antiplatelet.', 'Second point.'] },
}

function optionLabels() {
  return screen.getAllByRole('radio', { name: /^[A-H]\./ }).map((radio) => radio.closest('label'))
}

describe('QuestionPreview', () => {
  test('question mode shows the stem and options in order without revealing the answer', () => {
    const { container } = render(<QuestionPreview question={question} />)
    expect(screen.getByText('crushing').tagName).toBe('STRONG')
    const labels = optionLabels()
    expect(labels.map((label) => label.textContent)).toEqual([
      'A.Aspirin',
      'B.Heparin',
      'C.Warfarin',
      'D.Morphine',
      'E.Oxygen',
      'F.GTN',
      'G.Clopidogrel',
    ])
    expect(container.querySelector('.option--correct')).toBeNull()
    expect(screen.queryByText('Correct Answer')).toBeNull()
    labels.forEach((label) => expect(within(label).getByRole('radio')).toBeDisabled())
  })

  test('answer mode marks the correct option in text and shows every explanation level', () => {
    render(<QuestionPreview question={question} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Answer and explanations' }))

    const correct = optionLabels()[6]
    expect(correct).toHaveClass('option--correct')
    expect(correct).toHaveTextContent('(correct answer)')
    expect(screen.getByText('G. Clopidogrel')).toBeInTheDocument()

    // Quick tab: first point per option, including options beyond E.
    expect(screen.getByText('Give aspirin too.')).toBeInTheDocument()
    expect(screen.getByText('Dual antiplatelet.')).toBeInTheDocument()
    expect(screen.queryByText('Second point.')).toBeNull()

    fireEvent.click(screen.getByRole('tab', { name: 'Detailed' }))
    expect(screen.getByText('Detailed reasoning.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'ELI5' }))
    expect(screen.getByText('Simple reasoning.')).toBeInTheDocument()
  })

  test('explains what is missing instead of guessing an answer', () => {
    render(<QuestionPreview question={{ ...question, stem: '  ', correct_answer: null }} initialMode="answer" />)
    expect(screen.getByText('No question stem entered yet.')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Choose a correct answer')
  })
})

describe('buildQuickPoints', () => {
  test('covers every option rather than only the first five', () => {
    const points = buildQuickPoints({ 7: ['Eighth.'] }, 7, 8)
    expect(points).toEqual([{ label: 'H', text: 'Eighth.', isCorrect: true }])
  })
})
