// Fixtures for the Flashcards V2 admin review tests (shapes from the Task 14b routes).

export const TOPIC = '11111111-2222-4333-8444-555555555555'
export const RUN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
export const ADMIN = '/flashcards/v2/admin'
export const REVIEW_PATH = `${ADMIN}/topics/${TOPIC}/review`

export const adminCard = (id, semanticKey, extra = {}) => ({
  id,
  topicId: TOPIC,
  specialtyId: 's1',
  question: `Question ${semanticKey}?`,
  answerMarkdown: `- answer ${semanticKey}`,
  cardType: 'recall',
  contentVersion: 1,
  media: null,
  semanticKey,
  qaStatus: 'validated',
  isPublished: false,
  guidelineSensitive: false,
  mediaRequirement: null,
  isMediaRequired: false,
  findings: [],
  latestRunId: RUN,
  legacy: false,
  ...extra,
})

export const verdict = (semanticKey, extra = {}) => ({
  semanticKey,
  verdict: 'PASS',
  reason: `Fine: ${semanticKey}`,
  correctedQuestion: null,
  correctedAnswerMarkdown: null,
  ...extra,
})

export function reviewPayload({ cards, verdicts = [], blockers = [], textbookIssues = [], retiredCandidates = [], review = {}, run = {} } = {}) {
  return {
    review: { status: 'pending_review', currentRunId: RUN, approvedRunId: null, approvedAt: null, ...review },
    run: {
      id: RUN,
      textDeckStatus: 'ready_for_admin',
      model: 'gpt-5.2',
      promptVersion: 'v2.2-ts-review',
      importedAt: '2026-10-01T10:00:00Z',
      errors: [],
      warnings: [],
      reviews: [{ index: 0, cardVerdicts: verdicts, missingCards: [], lowYield: [], needsHumanVerification: [] }],
      textbookIssues,
      ...run,
    },
    cards: cards ?? [adminCard('c1', 'gout:a'), adminCard('c2', 'gout:b')],
    blockers,
    diff: { retiredCandidates },
  }
}

export const topicRow = (topicId, topicName, extra = {}) => ({
  topicId,
  topicName,
  specialtyId: 's1',
  specialtyName: 'Rheumatology',
  reviewStatus: 'pending_review',
  currentRunId: RUN,
  textDeckStatus: 'ready_for_admin',
  counts: { active: 2, validated: 2, needsAttention: 0, mediaPending: 0, draft: 0, published: 0, legacyActive: 0 },
  ...extra,
})
