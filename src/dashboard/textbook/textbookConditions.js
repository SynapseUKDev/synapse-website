import { authenticatedFetch } from '../../auth/token'

// A–Z of every readable topic/subtopic ({ name, slug, specialty_name, specialty_slug, parent_name }).
// Loaded once per session and shared by the condition search and the A–Z list.
let conditionsPromise = null

export function loadConditions(API_BASE) {
  if (!conditionsPromise) {
    conditionsPromise = authenticatedFetch(`${API_BASE}/textbook/conditions`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load conditions: ${res.status}`)
        const json = await res.json()
        return Array.isArray(json?.conditions) ? json.conditions : []
      })
      .catch((err) => {
        conditionsPromise = null // let the next caller retry
        throw err
      })
  }
  return conditionsPromise
}

/** Test hook: forget the cached list. */
export function resetConditionsCache() {
  conditionsPromise = null
}

export const normalizeText = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Conditions matching `query`, best first:
 * name starts with it → every query word starts a word in the name → name contains it →
 * the parent topic matches (e.g. "arrhythmia" finds Atrial fibrillation).
 * Ties keep the list's A–Z order.
 */
export function matchConditions(conditions, query, limit = 8) {
  const q = normalizeText(query)
  if (!q) return []
  const qWords = q.split(' ')
  const ranked = []
  conditions.forEach((c, i) => {
    const name = normalizeText(c.name)
    const words = name.split(' ')
    let rank = -1
    if (name.startsWith(q)) rank = 0
    else if (qWords.every((qw) => words.some((w) => w.startsWith(qw)))) rank = 1
    else if (name.includes(q)) rank = 2
    else if (c.parent_name && normalizeText(c.parent_name).includes(q)) rank = 3
    if (rank >= 0) ranked.push({ c, rank, i })
  })
  ranked.sort((a, b) => a.rank - b.rank || a.i - b.i)
  return ranked.slice(0, limit).map((r) => r.c)
}

/** First letter used for A–Z grouping; anything not A–Z goes under '#'. */
export const letterOf = (name) => {
  const ch = normalizeText(name).charAt(0).toUpperCase()
  return ch >= 'A' && ch <= 'Z' ? ch : '#'
}
