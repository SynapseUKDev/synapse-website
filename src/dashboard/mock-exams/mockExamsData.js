/**
 * Placeholder catalog — replace with GET /mock-exams when the table API exists.
 * @typedef {'available' | 'attempted' | 'completed'} MockExamStatus
 */
export const MOCK_EXAMS = [
  {
    id: '1',
    title: 'UKMLA Mock Paper A',
    summary: 'Single-best-answer practice paper mixing clinical reasoning and data interpretation.',
    question_count: 90,
    duration_minutes: 120,
    label: 'Paper A',
    tags: ['UKMLA', 'SBA', 'Full paper'],
    status: 'available',
    last_score_pct: null,
    thumb_tint: 'violet',
  },
  {
    id: '2',
    title: 'UKMLA Mock Paper B',
    summary: 'Second full-length paper with fresh stems — same format as the live assessment.',
    question_count: 90,
    duration_minutes: 120,
    label: 'Paper B',
    tags: ['UKMLA', 'Clinical'],
    status: 'attempted',
    last_score_pct: 68,
    thumb_tint: 'cyan',
  },
  {
    id: '3',
    title: 'High-yield condensed mock',
    summary: 'Shorter timed run through high-yield themes when you have limited study time.',
    question_count: 40,
    duration_minutes: 50,
    label: 'Sprint',
    tags: ['High yield', 'Quick'],
    status: 'completed',
    last_score_pct: 74,
    thumb_tint: 'amber',
  },
]

export function getMockExamById(id) {
  if (id == null || id === '') return null
  return MOCK_EXAMS.find((e) => String(e.id) === String(id)) || null
}
