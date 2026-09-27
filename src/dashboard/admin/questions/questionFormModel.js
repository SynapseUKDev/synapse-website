/*
 * Pure editing model for the admin question form.
 *
 * Options carry a stable client `key` so the correct answer and each option's
 * explanation points stay attached to the same option through reordering and
 * deletion. Indices are only produced when serializing for the API/preview.
 */

export const MIN_OPTIONS = 2
export const MAX_OPTIONS = 8
export const DEFAULT_OPTION_COUNT = 5
export const DIFFICULTIES = ['easy', 'medium', 'hard']

let keyCounter = 0
function nextKey() {
  keyCounter += 1
  return `opt-${keyCounter}`
}

function newOption(text = '', pointsText = '') {
  return { key: nextKey(), text, pointsText }
}

export function createEmptyForm({ topicId = '' } = {}) {
  return {
    topic_id: topicId,
    type: 'MCQ',
    stem: '',
    options: Array.from({ length: DEFAULT_OPTION_COUNT }, () => newOption()),
    correctKey: null,
    difficulty: '',
    explanation_l2: '',
    explanation_eli5: '',
  }
}

function parseStoredOptions(value) {
  if (Array.isArray(value)) return value.map((option) => String(option ?? ''))
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed.map((option) => String(option ?? ''))
    } catch {
      // fall through
    }
  }
  return []
}

/** Builds form state from an API question (stored shape). */
export function formFromQuestion(question = {}) {
  const points = question.explanation_points_by_option || {}
  const options = parseStoredOptions(question.options).map((text, idx) => {
    const list = Array.isArray(points[String(idx)]) ? points[String(idx)] : []
    return newOption(text, list.join('\n'))
  })
  const correctIndex = Number.isInteger(question.correct_answer) ? question.correct_answer : null
  return {
    topic_id: question.topic_id || '',
    type: question.type || 'MCQ',
    stem: question.stem || '',
    options,
    correctKey: correctIndex !== null && options[correctIndex] ? options[correctIndex].key : null,
    difficulty: DIFFICULTIES.includes(question.difficulty) ? question.difficulty : '',
    explanation_l2: question.explanation_l2 || '',
    explanation_eli5: question.explanation_eli5 || '',
  }
}

function splitPoints(pointsText) {
  return String(pointsText || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/**
 * Serializes the form into the API's question shape. The correct answer and
 * option points are re-indexed from the options' final order.
 */
export function toQuestionPayload(form) {
  const correctIndex = form.options.findIndex((option) => option.key === form.correctKey)
  const pointsByOption = {}
  form.options.forEach((option, idx) => {
    const points = splitPoints(option.pointsText)
    if (points.length) pointsByOption[String(idx)] = points
  })
  return {
    topic_id: form.topic_id,
    type: form.type,
    stem: form.stem,
    options: form.options.map((option) => option.text),
    correct_answer: correctIndex === -1 ? null : correctIndex,
    difficulty: form.difficulty || null,
    explanation_l2: form.explanation_l2.trim() ? form.explanation_l2 : null,
    explanation_eli5: form.explanation_eli5.trim() ? form.explanation_eli5 : null,
    explanation_points_by_option: Object.keys(pointsByOption).length ? pointsByOption : null,
  }
}

/**
 * Comparison form of the payload: whitespace-only differences in text fields
 * are not treated as unsaved changes.
 */
export function normalizedSnapshot(form) {
  const payload = toQuestionPayload(form)
  const collapse = (value) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value)
  return JSON.stringify({
    ...payload,
    stem: collapse(payload.stem),
    options: payload.options.map(collapse),
    explanation_l2: collapse(payload.explanation_l2),
    explanation_eli5: collapse(payload.explanation_eli5),
  })
}

export function isFormDirty(form, baselineSnapshot) {
  return normalizedSnapshot(form) !== baselineSnapshot
}

function updateOptions(form, options, extra = {}) {
  return { ...form, options, ...extra }
}

export function questionFormReducer(form, action) {
  switch (action.type) {
    case 'reset':
      return action.form
    case 'setField':
      return { ...form, [action.field]: action.value }
    case 'setOption':
      return updateOptions(
        form,
        form.options.map((option) => (option.key === action.key ? { ...option, ...action.patch } : option)),
      )
    case 'addOption':
      if (form.options.length >= MAX_OPTIONS) return form
      return updateOptions(form, [...form.options, newOption()])
    case 'removeOption': {
      if (form.options.length <= MIN_OPTIONS) return form
      const options = form.options.filter((option) => option.key !== action.key)
      return updateOptions(form, options, form.correctKey === action.key ? { correctKey: null } : {})
    }
    case 'moveOption': {
      const from = form.options.findIndex((option) => option.key === action.key)
      const to = from + action.offset
      if (from === -1 || to < 0 || to >= form.options.length) return form
      const options = [...form.options]
      const [moved] = options.splice(from, 1)
      options.splice(to, 0, moved)
      return updateOptions(form, options)
    }
    case 'setCorrect':
      return form.options.some((option) => option.key === action.key) ? { ...form, correctKey: action.key } : form
    default:
      return form
  }
}

const OPTION_FIELD = /^options\.(\d+)$/
const POINTS_FIELD = /^explanation_points_by_option\.(\d+)/

/**
 * Maps server field issues onto the form: option-indexed issues are attached
 * to the option key currently at that index, so they follow the right row.
 */
export function mapServerIssues(issues = [], form) {
  const fields = {}
  const options = {}
  const push = (target, key, message) => {
    if (!target[key]) target[key] = []
    target[key].push(message)
  }
  for (const issue of issues) {
    const field = String(issue?.field || 'question')
    const message = issue?.message || 'Invalid value.'
    const optionMatch = field.match(OPTION_FIELD) || field.match(POINTS_FIELD)
    const option = optionMatch ? form.options[Number(optionMatch[1])] : null
    if (option) push(options, option.key, message)
    else push(fields, optionMatch ? 'options' : field, message)
  }
  return { fields, options }
}

/** DOM id of the input responsible for a form field, used by the error summary. */
export function fieldDomId(field, optionKey = null) {
  if (optionKey) return `aqf-option-${optionKey}`
  if (field === 'correct_answer' || field === 'options') return 'aqf-options'
  return `aqf-${field}`
}

export const FIELD_LABELS = {
  topic_id: 'Topic',
  type: 'Type',
  stem: 'Question stem',
  options: 'Answer options',
  correct_answer: 'Correct answer',
  difficulty: 'Difficulty',
  explanation_l2: 'Detailed explanation',
  explanation_eli5: 'Simplified explanation',
  question: 'Question',
}

/** Flattens mapped errors into summary entries that link to the responsible input. */
export function summaryEntries(mapped, form) {
  const entries = []
  for (const [field, messages] of Object.entries(mapped.fields)) {
    for (const message of messages) {
      entries.push({ id: fieldDomId(field), label: FIELD_LABELS[field] || field, message })
    }
  }
  form.options.forEach((option, idx) => {
    for (const message of mapped.options[option.key] || []) {
      entries.push({
        id: fieldDomId('options', option.key),
        label: `Option ${String.fromCharCode(65 + idx)}`,
        message,
      })
    }
  })
  return entries
}
