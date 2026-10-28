// Kept until a full page reload: coming back to this page shows the last coverage, filters and
// results at once while fresh data loads in the background.
export const cache = { coverage: null, lists: new Map(), view: null }
export const listKey = (filters, page) => JSON.stringify({ ...filters, page })

/** After a delete elsewhere: hide the row at once instead of until the background refresh. */
export function dropFromSummariesCache(summaryId) {
  for (const [key, data] of cache.lists) {
    if (!data.summaries.some((s) => s.id === summaryId)) continue
    cache.lists.set(key, { ...data, summaries: data.summaries.filter((s) => s.id !== summaryId), total: data.total - 1 })
  }
  cache.coverage = null
}

/** Test hook: forget everything cached. */
export function clearSummariesCache() {
  cache.coverage = null
  cache.lists.clear()
  cache.view = null
}
