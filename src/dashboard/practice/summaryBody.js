// Generated summaries open with a line that repeats the title ("Peritonitis: investigations."
// under the title "Peritonitis investigations"). Drop that first line for display only; the
// stored text is unchanged. Only a short "<title start>: <words>." line is removed.
const ECHO = /^([^*\n]{1,150}?):\s+[^*\n]{1,80}\.$/
const squash = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

export function withoutTitleEcho(body, title) {
  const text = String(body || '')
  const trimmed = text.replace(/^\s+/, '')
  const end = trimmed.indexOf('\n')
  const first = (end === -1 ? trimmed : trimmed.slice(0, end)).trim()
  const match = ECHO.exec(first)
  if (!match) return text
  const lead = squash(match[1])
  if (!lead || !squash(title).startsWith(lead)) return text
  return end === -1 ? '' : trimmed.slice(end + 1).replace(/^\s+/, '')
}
