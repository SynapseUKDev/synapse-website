// Usage analytics event catalogue: mirrors specs/002-platform-usage-analytics/contracts/event-catalog.md
// (tests/usage-analytics/catalogParity.test.js fails if the two drift). before_send drops any
// custom event not listed here and any prop not allowed for it, so never add answer content,
// scores, typed text, names, topic names or ids as props.

export const CATALOG_VERSION = 1

export const EVENTS = Object.freeze({
  ACCOUNT_SIGNED_IN: 'account.signed_in',
  ACCOUNT_SIGNED_UP: 'account.signed_up',
  ACCOUNT_INVITE_ACCEPTED: 'account.invite_accepted',
  QBANK_SESSION_STARTED: 'qbank.session_started',
  QBANK_SESSION_COMPLETED: 'qbank.session_completed',
  QBANK_SESSION_ABANDONED: 'qbank.session_abandoned',
  QBANK_STUDY_SET_CREATED: 'qbank.study_set_created',
  GROUP_SESSION_JOINED: 'group.session_joined',
  MOCK_STARTED: 'mock.started',
  MOCK_COMPLETED: 'mock.completed',
  OSCE_STATION_OPENED: 'osce.station_opened',
  OSCE_STATION_COMPLETED: 'osce.station_completed',
  TEXTBOOK_CHAPTER_OPENED: 'textbook.chapter_opened',
  FLASHCARDS_SESSION_STARTED: 'flashcards.session_started',
  FLASHCARDS_SESSION_COMPLETED: 'flashcards.session_completed',
  INSIGHTS_REPORT_VIEWED: 'insights.report_viewed',
  BILLING_UPGRADE_STARTED: 'billing.upgrade_started',
  BILLING_UPGRADE_COMPLETED: 'billing.upgrade_completed',
})

// Allowed props per event: 'string' | 'number' | 'boolean', or an array of allowed string values.
export const EVENT_PROPS = Object.freeze({
  'account.signed_in': { method: ['password', 'magic_link', 'oauth'] },
  'account.signed_up': { method: 'string' },
  'account.invite_accepted': {},
  'qbank.session_started': { mode: ['solo', 'study_set', 'incorrect_only'], question_count: 'number' },
  'qbank.session_completed': { question_count: 'number', duration_s: 'number' },
  'qbank.session_abandoned': { answered_count: 'number' },
  'qbank.study_set_created': { question_count: 'number' },
  'group.session_joined': { kind: ['qbank', 'osce'], role: ['host', 'participant'] },
  'mock.started': { timed: 'boolean' },
  'mock.completed': { duration_s: 'number' },
  'osce.station_opened': {},
  'osce.station_completed': { duration_s: 'number' },
  'textbook.chapter_opened': {},
  'flashcards.session_started': { card_count: 'number' },
  'flashcards.session_completed': { card_count: 'number' },
  'insights.report_viewed': {},
  'billing.upgrade_started': { plan: 'string' },
  'billing.upgrade_completed': { plan: 'string' },
})
