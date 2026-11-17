import { describe, expect, it } from 'vitest'
import { getDashboardNavItems } from '../../src/dashboard/sidebar/dashboardNavConfig.js'

const ids = (user) => getDashboardNavItems(user).map((item) => item.id)

describe('getDashboardNavItems', () => {
  it('gives institution admins their Institution page plus the full study platform', () => {
    expect(ids({ capabilities: { is_institution_admin: true } })).toEqual([
      'institution',
      'dashboard',
      'question-bank',
      'textbook',
      'osce',
      'mock-exams',
      'analytics',
    ])
  })

  it('leaves the student nav unchanged', () => {
    expect(ids({ capabilities: {} })).toEqual([
      'dashboard',
      'question-bank',
      'textbook',
      'osce',
      'mock-exams',
      'analytics',
    ])
  })
})
