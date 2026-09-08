// Decorative page artwork for the dashboard shell.
//
// Each section gets its own variation so the app has some variety as you move
// around it, while a section stays visually stable as you navigate within it.
// Light and dark artwork is paired in DashboardBackground.css; only the
// variation name is chosen here.

const SECTION_BACKGROUNDS = [
  ['/dashboard/question-bank', 'glacier-blue'],
  ['/dashboard/study-sets', 'glacier-blue'],
  ['/dashboard/group-study', 'glacier-blue'],
  ['/dashboard/textbook', 'lavender-bloom'],
  ['/dashboard/mock-exams', 'champagne-dawn'],
  ['/dashboard/osce', 'perimeter-network'],
  ['/dashboard/analytics', 'flowing-signal'],
  ['/dashboard/admin', 'scattered-connections'],
  ['/dashboard/institution', 'scattered-connections'],
  ['/dashboard/settings', 'quiet-pearl'],
]

// Focused work deserves a plain page: anything that is a timed or single-task
// run keeps the flat app background so the artwork cannot compete with it.
const FOCUS_ROUTES = [
  '/dashboard/question-bank/practice',
  '/dashboard/question-bank/group-practice',
  '/dashboard/question-bank/flashcards',
  '/dashboard/mock-exams/practice',
  '/dashboard/mock-exams/review',
]

const FOCUS_PATTERNS = [/^\/dashboard\/osce\/station\/[^/]+\/practice/]

export function isFocusRoute(pathname = '') {
  return (
    FOCUS_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`)) ||
    FOCUS_PATTERNS.some((pattern) => pattern.test(pathname))
  )
}

// Returns null when the page should stay plain.
export function getBackgroundForPath(pathname = '') {
  if (isFocusRoute(pathname)) return null

  const match = SECTION_BACKGROUNDS.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
  // The home dashboard is the approved concept, and doubles as the fallback.
  return match ? match[1] : 'signature-aurora'
}
