import { describe, expect, it } from 'vitest'
import { formatPct, pct1 } from '../../src/utils/percent.js'

describe('pct1', () => {
  it('rounds to 1 d.p. like the API', () => {
    expect(pct1(2, 3)).toBe(66.7)
    expect(pct1(139, 200)).toBe(69.5)
    expect(pct1(0, 0)).toBeNull()
  })
})

describe('formatPct', () => {
  it('always shows one decimal place', () => {
    expect(formatPct(66.7)).toBe('66.7%')
    expect(formatPct(70)).toBe('70.0%')
    expect(formatPct('69.45')).toBe('69.5%')
  })

  it('falls back for missing values', () => {
    expect(formatPct(null)).toBe('N/A')
    expect(formatPct(undefined, '—')).toBe('—')
  })
})
