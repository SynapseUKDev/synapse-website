// Shared by the specialty topic list (Textbook.jsx) and the reading page (TextbookTopic.jsx)
// so the two confidence controls can't drift apart.
export const CONFIDENCE_LEVELS = ['low', 'moderate', 'high']

export const CONFIDENCE_LABELS = {
  low: 'Low',
  moderate: 'Moderate',
  high: 'High',
}

// A topic with subtopics is a grouping: it isn't counted in progress and has no status/confidence
// control in the specialty list, so its reading page shouldn't offer them either.
export function isGroupingTopicFor(specialtyTopics, topic, isSubtopicPage) {
  if (isSubtopicPage || !topic) return false
  const match = (specialtyTopics || []).find(
    (t) => (topic.id != null && String(t.id) === String(topic.id)) || (topic.slug && t.slug === topic.slug)
  )
  return !!(match && match.has_subtopics && Array.isArray(match.subtopics) && match.subtopics.length > 0)
}
