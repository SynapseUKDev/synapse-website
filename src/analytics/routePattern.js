import { matchPath } from 'react-router-dom'

// Every <Route path> in src/App.jsx, with nested dashboard routes written out in full.
// Static segments come before parameterised siblings so '/mock-exams/practice' is not read
// as '/mock-exams/:examId'. tests/usage-analytics/routePattern.test.js fails if a route in
// App.jsx is missing here.
export const ROUTE_PATTERNS = [
  '/',
  '/login',
  '/auth/callback',
  '/auth/reset-password',
  '/auth/setup-account',
  '/auth/link-expired',
  '/auth/change-password',
  '/subscribe',
  '/dashboard',
  '/dashboard/analytics',
  '/dashboard/analytics/report/:id',
  '/dashboard/question-bank',
  '/dashboard/question-bank/create-set',
  '/dashboard/question-bank/setup',
  '/dashboard/question-bank/group_setup',
  '/dashboard/question-bank/practice',
  '/dashboard/question-bank/group-practice',
  '/dashboard/question-bank/group-leaderboard',
  '/dashboard/question-bank/results',
  '/dashboard/question-bank/flashcards',
  '/dashboard/question-bank/flashcards-v2',
  '/dashboard/study-sets',
  '/dashboard/group-study',
  '/dashboard/mock-exams',
  '/dashboard/mock-exams/practice',
  '/dashboard/mock-exams/results',
  '/dashboard/mock-exams/review',
  '/dashboard/mock-exams/:examId',
  '/dashboard/textbook',
  '/dashboard/textbook/search',
  '/dashboard/textbook/specialty/:slug',
  '/dashboard/textbook/topic/:topicSlug',
  '/dashboard/admin',
  '/dashboard/admin/questions/new',
  '/dashboard/admin/questions/:questionId',
  '/dashboard/admin/question-imports/:batchId',
  '/dashboard/admin/osce',
  '/dashboard/admin/osce/station/:id',
  '/dashboard/institution',
  '/dashboard/osce',
  '/dashboard/osce/flashcards',
  '/dashboard/osce/station/:slug',
  '/dashboard/osce/station/:slug/practice',
  '/dashboard/osce/group',
  '/dashboard/osce/group/:roomCode',
  '/dashboard/osce/group/:roomCode/results',
  '/dashboard/settings',
  '/dashboard/settings/support',
]

/** The route pattern for a pathname (e.g. '/dashboard/textbook/topic/:topicSlug'), or '/other'. */
export function toRoutePattern(pathname) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return '/other'
  for (const pattern of ROUTE_PATTERNS) {
    if (matchPath(pattern, pathname)) return pattern
  }
  return '/other'
}
