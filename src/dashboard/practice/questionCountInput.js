/** Digits-only string while typing; empty and "0" are allowed until blur or submit. */
export function sanitizeQuestionCountTyping(raw) {
  if (raw === '') return ''
  return /^\d+$/.test(raw) ? raw : null
}

export function clampQuestionCount(value, min, max) {
  if (max <= 0) return 0
  return Math.max(min, Math.min(max, value))
}

/** Final count for API calls and steppers after resolving empty / 0. */
export function resolveQuestionCountInput(input, min, max) {
  if (max <= 0) return 0
  if (input === '' || input === '0') return min
  const v = parseInt(input, 10)
  if (Number.isNaN(v)) return min
  return clampQuestionCount(v, min, max)
}

export function isValidQuestionCountInput(input, min, max) {
  if (max <= 0) return false
  if (input === '' || input === '0') return false
  const v = parseInt(input, 10)
  if (Number.isNaN(v)) return false
  return v >= min && v <= max
}

export function formatQuestionCountOnBlur(input, min, max) {
  if (max <= 0) return '0'
  return String(resolveQuestionCountInput(input, min, max))
}

/** Keep count in range when pool size or toggles change. */
export function adjustQuestionCountInput(
  input,
  { max, previousMax, min, snapToMaxIfWasMax = false, defaultWhenEmpty = 'max' }
) {
  if (max <= 0) return '0'
  const n = input === '' || input === '0' ? 0 : parseInt(input, 10)
  if (Number.isNaN(n) || n === 0) {
    return defaultWhenEmpty === 'min25' ? String(Math.min(25, max)) : String(max)
  }
  if (n > max) return String(max)
  if (snapToMaxIfWasMax && previousMax != null && n === previousMax) return String(max)
  return String(Math.min(n, max))
}

export function questionCountSummaryLabel(input) {
  if (input === '') return '—'
  return input
}
