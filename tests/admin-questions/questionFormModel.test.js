import { describe, expect, test } from 'vitest'
import {
  MAX_OPTIONS,
  MIN_OPTIONS,
  createEmptyForm,
  formFromQuestion,
  isFormDirty,
  mapServerIssues,
  normalizedSnapshot,
  questionFormReducer,
  toQuestionPayload,
} from '../../src/dashboard/admin/questions/questionFormModel'

const stored = {
  topic_id: 't1',
  type: 'MCQ',
  stem: 'Which drug?',
  options: ['Aspirin', 'Heparin', 'Warfarin'],
  correct_answer: 1,
  difficulty: 'hard',
  explanation_l2: 'Detailed.',
  explanation_eli5: null,
  explanation_points_by_option: { 0: ['Not first line.'], 1: ['Correct.', 'Also fast.'] },
}

function apply(form, ...actions) {
  return actions.reduce(questionFormReducer, form)
}

describe('question form model', () => {
  test('round-trips a stored question without changes', () => {
    const form = formFromQuestion(stored)
    expect(toQuestionPayload(form)).toEqual({
      ...stored,
      explanation_points_by_option: { 0: ['Not first line.'], 1: ['Correct.', 'Also fast.'] },
    })
  })

  test('starts a new question with five blank options and no answer', () => {
    const payload = toQuestionPayload(createEmptyForm())
    expect(payload.options).toEqual(['', '', '', '', ''])
    expect(payload.correct_answer).toBeNull()
    expect(payload.difficulty).toBeNull()
  })

  test('reordering keeps the answer and explanations attached to their option', () => {
    const form = formFromQuestion(stored)
    const heparin = form.options[1].key
    const moved = apply(form, { type: 'moveOption', key: heparin, offset: 1 })
    const payload = toQuestionPayload(moved)
    expect(payload.options).toEqual(['Aspirin', 'Warfarin', 'Heparin'])
    expect(payload.correct_answer).toBe(2)
    expect(payload.explanation_points_by_option).toEqual({ 0: ['Not first line.'], 2: ['Correct.', 'Also fast.'] })
  })

  test('deleting an earlier option re-indexes the answer and points', () => {
    const form = formFromQuestion(stored)
    const payload = toQuestionPayload(apply(form, { type: 'removeOption', key: form.options[0].key }))
    expect(payload.options).toEqual(['Heparin', 'Warfarin'])
    expect(payload.correct_answer).toBe(0)
    expect(payload.explanation_points_by_option).toEqual({ 0: ['Correct.', 'Also fast.'] })
  })

  test('deleting the correct option clears the answer instead of guessing one', () => {
    const form = formFromQuestion({ ...stored, options: ['A', 'B', 'C'], correct_answer: 2 })
    const payload = toQuestionPayload(apply(form, { type: 'removeOption', key: form.options[2].key }))
    expect(payload.correct_answer).toBeNull()
  })

  test('enforces the option count limits', () => {
    const two = formFromQuestion({ ...stored, options: ['A', 'B'], correct_answer: 0 })
    expect(apply(two, { type: 'removeOption', key: two.options[0].key }).options).toHaveLength(MIN_OPTIONS)
    let form = createEmptyForm()
    for (let i = 0; i < 10; i += 1) form = apply(form, { type: 'addOption' })
    expect(form.options).toHaveLength(MAX_OPTIONS)
  })

  test('ignores moves past either end', () => {
    const form = formFromQuestion(stored)
    expect(apply(form, { type: 'moveOption', key: form.options[0].key, offset: -1 })).toBe(form)
    expect(apply(form, { type: 'moveOption', key: form.options[2].key, offset: 1 })).toBe(form)
  })

  test('drops blank point lines and blank explanations', () => {
    const form = formFromQuestion(stored)
    const edited = apply(
      form,
      { type: 'setOption', key: form.options[2].key, patch: { pointsText: '\n  \nWrong drug.\n' } },
      { type: 'setField', field: 'explanation_l2', value: '   ' },
    )
    const payload = toQuestionPayload(edited)
    expect(payload.explanation_points_by_option['2']).toEqual(['Wrong drug.'])
    expect(payload.explanation_l2).toBeNull()
  })

  test('dirty checking ignores whitespace-only edits but not real ones', () => {
    const form = formFromQuestion(stored)
    const baseline = normalizedSnapshot(form)
    expect(isFormDirty(apply(form, { type: 'setField', field: 'stem', value: '  Which   drug? ' }), baseline)).toBe(false)
    expect(isFormDirty(apply(form, { type: 'setField', field: 'stem', value: 'Which dose?' }), baseline)).toBe(true)
    expect(isFormDirty(apply(form, { type: 'setCorrect', key: form.options[0].key }), baseline)).toBe(true)
  })

  test('attaches option-indexed server issues to the option currently at that index', () => {
    const form = formFromQuestion(stored)
    const mapped = mapServerIssues(
      [
        { code: 'too_small', field: 'stem', message: 'Question stem is required.' },
        { code: 'too_big', field: 'options.2', message: 'Too long.' },
        { code: 'unknown_option_reference', field: 'explanation_points_by_option.1', message: 'Bad key.' },
        { code: 'duplicate_option', field: 'options', message: 'Option 2 duplicates another option.' },
        { code: 'unknown_option_reference', field: 'explanation_points_by_option.7', message: 'Orphan.' },
      ],
      form,
    )
    expect(mapped.fields).toEqual({
      stem: ['Question stem is required.'],
      options: ['Option 2 duplicates another option.', 'Orphan.'],
    })
    expect(mapped.options).toEqual({ [form.options[2].key]: ['Too long.'], [form.options[1].key]: ['Bad key.'] })
  })
})
