export function pct(x) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—'
  return `${Math.round(x * 100)}%`
}

/** Delta for ratios (0..1) in percentage points, or for counts as a raw difference. */
export function delta(cur, prev, kind) {
  if (cur === null || cur === undefined || prev === null || prev === undefined) return null
  const diff = kind === 'ratio' ? Math.round((cur - prev) * 100) : Math.round(cur - prev)
  const dir = diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat'
  const sign = diff > 0 ? '+' : diff < 0 ? '−' : ''
  return { text: `${sign}${Math.abs(diff)}`, dir }
}

const BAND_LABELS = { untested: 'Untested', weak: 'Weak', developing: 'Developing', strong: 'Strong' }
export function bandLabel(band) {
  return BAND_LABELS[band] || 'Untested'
}

export function windowLabel(key) {
  if (key === '90') return 'Last 90 days'
  if (key === 'all') return 'All time'
  return 'Last 30 days'
}

export function trendArrow(trend) {
  if (trend === null || trend === undefined) return { glyph: '–', dir: 'none' }
  if (trend >= 0.03) return { glyph: '↑', dir: 'up' }
  if (trend <= -0.03) return { glyph: '↓', dir: 'down' }
  return { glyph: '→', dir: 'flat' }
}

export function practiceLink({ specialty_id, specialty_name, topic_id, name }, count = 20) {
  const p = new URLSearchParams({ specialty_id, specialty_name: specialty_name || '', topic_id, topic_name: name, count: String(count) })
  return `/dashboard/question-bank/setup?${p.toString()}`
}

export function specialtyPracticeLink({ specialty_id, name }) {
  const p = new URLSearchParams({ specialty_id, specialty_name: name || '' })
  return `/dashboard/question-bank/setup?${p.toString()}`
}

export function textbookLink(slug) {
  return `/dashboard/textbook/topic/${slug}`
}
