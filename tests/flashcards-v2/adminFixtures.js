// Fixtures for the Flashcards V2 admin tests (shapes from flashcardsV2AdminCardRoutes.ts / flashcardsV2Dto.ts).

export const TOPIC = '11111111-2222-4333-8444-555555555555'
export const RUN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
export const SPECIALTY = '22222222-3333-4444-8555-666666666666'
export const ADMIN = '/flashcards/v2/admin'
export const CARDS_PATH = `${ADMIN}/cards`
export const COUNTS_PATH = `${ADMIN}/cards/counts`
export const TOPICS_PATH = `${ADMIN}/topics`

/** AdminCardDto as GET /cards returns it (with topicName / specialtyName). */
export const adminCard = (id, semanticKey, extra = {}) => ({
  id,
  topicId: TOPIC,
  specialtyId: SPECIALTY,
  question: `Question ${semanticKey}?`,
  answerMarkdown: `- answer ${semanticKey}`,
  cardType: 'recall',
  contentVersion: 1,
  media: null,
  semanticKey,
  qaStatus: 'needs_attention',
  isPublished: false,
  isLive: false,
  approvedAt: null,
  guidelineSensitive: false,
  mediaRequirement: null,
  isMediaRequired: false,
  findings: [],
  latestRunId: RUN,
  hiddenReason: null,
  hiddenAt: null,
  topicName: 'Gout',
  specialtyName: 'Rheumatology',
  ...extra,
})

export const image = (extra = {}) => ({
  id: 'm1',
  url: 'https://cdn.example/flashcards/c1/a.png',
  alt: 'AP radiograph of the right foot',
  attribution: null,
  license: null,
  sourceUrl: null,
  ...extra,
})

export const COUNTS = { needsAction: 3, flagged: 2, needsImage: 1, approved: 10, live: 4 }

export const topicRow = (topicId, topicName, extra = {}) => ({
  topicId,
  topicName,
  specialtyId: SPECIALTY,
  specialtyName: 'Rheumatology',
  reviewStatus: 'pending_review',
  currentRunId: RUN,
  textDeckStatus: 'ready_for_admin',
  counts: { active: 2, validated: 2, needsAttention: 0, mediaPending: 0, draft: 0, published: 0, legacyActive: 0 },
  ...extra,
})
