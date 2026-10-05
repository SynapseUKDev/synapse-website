import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { ROUTE_PATTERNS, toRoutePattern } from '../../src/analytics/routePattern.js'

const here = path.dirname(fileURLToPath(import.meta.url))

describe('toRoutePattern', () => {
  test.each([
    ['/dashboard/textbook/topic/abc-def', '/dashboard/textbook/topic/:topicSlug'],
    ['/dashboard/osce/station/x/practice', '/dashboard/osce/station/:slug/practice'],
    ['/dashboard/osce/station/x', '/dashboard/osce/station/:slug'],
    ['/dashboard/mock-exams/123', '/dashboard/mock-exams/:examId'],
    ['/dashboard/mock-exams/practice', '/dashboard/mock-exams/practice'],
    ['/dashboard/question-bank/practice', '/dashboard/question-bank/practice'],
    ['/dashboard/analytics/report/9', '/dashboard/analytics/report/:id'],
    ['/dashboard', '/dashboard'],
    ['/dashboard/', '/dashboard'],
    ['/', '/'],
    ['/nope', '/other'],
    ['/dashboard/unknown/deep', '/other'],
  ])('%s → %s', (pathname, expected) => {
    expect(toRoutePattern(pathname)).toBe(expected)
  })

  test('never throws on bad input', () => {
    expect(toRoutePattern(undefined)).toBe('/other')
    expect(toRoutePattern('')).toBe('/other')
  })
})

describe('ROUTE_PATTERNS covers every route in App.jsx', () => {
  test('each <Route path> has a matching pattern', () => {
    const app = fs.readFileSync(path.resolve(here, '../../src/App.jsx'), 'utf8')
    const paths = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*')
    const expected = paths.map((p) => (p.startsWith('/') ? p : `/dashboard/${p}`))
    expect(expected.length).toBeGreaterThan(40)
    for (const p of expected) expect(ROUTE_PATTERNS, p).toContain(p)
  })
})
