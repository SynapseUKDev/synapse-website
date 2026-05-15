/** In-memory store for study-set question id prefetch (setup → practice in same SPA session). */

const map = new Map()

export function clearStudySetQuestionIdsPrefetch(setId) {
  if (setId == null) return
  map.delete(String(setId))
}

/** @param {string} setId @param {string[]} ids */
export function setStudySetQuestionIdsPrefetch(setId, ids) {
  if (setId == null) return
  map.set(String(setId), { ids: [...ids], ready: true })
}

/** @returns {{ ids: string[], ready: boolean } | null} */
export function getStudySetQuestionIdsPrefetch(setId) {
  if (setId == null) return null
  return map.get(String(setId)) || null
}
