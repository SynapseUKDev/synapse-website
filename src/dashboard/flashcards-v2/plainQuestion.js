// Card questions are authored as plain text, but older rows can still carry Markdown markers. The front
// of a card is never Markdown-rendered, so the literal markers are removed instead of being shown.

const LEADING_MARKERS = /^\s*(?:#{1,6}\s*|[-*+]\s+|\d{1,3}[.)]\s+)/

/** Plain-text question: no ** __ ` markers, no leading heading or list markers, tidy whitespace. */
export function plainQuestion(text) {
  if (typeof text !== 'string') return ''
  return text
    .replace(/\*\*|__|`/g, '')
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_MARKERS, '').replace(/[ \t]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}
