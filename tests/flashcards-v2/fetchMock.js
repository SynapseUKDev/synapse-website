import { vi } from 'vitest'

/** A minimal fetch Response stand-in (the client only uses ok, status and text()). */
export function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body,
  }
}

/**
 * Installs a fetch mock whose answers come from `handler(url: URL, init, call)`. The handler returns
 * `[status, body]`, a response object, or a Promise of either. Every call is recorded with its parsed
 * JSON body so tests can assert exactly what was sent.
 */
export function mockFetch(handler) {
  const calls = []
  const fn = vi.fn(async (input, init = {}) => {
    const url = new URL(String(input))
    let body
    try {
      body = init.body ? JSON.parse(init.body) : undefined
    } catch {
      body = init.body
    }
    const call = { url, method: init.method || 'GET', body, init }
    calls.push(call)
    const out = await handler(url, init, call)
    if (Array.isArray(out)) return jsonResponse(out[1], out[0])
    return out
  })
  globalThis.fetch = fn
  return { fn, calls, callsTo: (path) => calls.filter((c) => c.url.pathname === path) }
}

export const card = (id, extra = {}) => ({
  id,
  topicId: 't1',
  specialtyId: 's1',
  question: `Question ${id}?`,
  answerMarkdown: `- answer ${id}`,
  cardType: 'recall',
  contentVersion: 1,
  media: null,
  ...extra,
})

/** Lets pending promise chains (fetch → state update) settle inside act(). */
export const flush = () => new Promise((r) => setTimeout(r, 0))
