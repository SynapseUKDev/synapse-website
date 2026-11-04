/** The key call sites give TopicSummary: changes when any shown version changes. */
export function topicSummaryKey(summary, extras) {
  return [summary, ...(Array.isArray(extras) ? extras : [])].filter(Boolean).map((s) => s.version_id).join('|')
}
