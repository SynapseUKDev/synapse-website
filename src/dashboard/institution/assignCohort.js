import { authenticatedFetch } from '../../auth/token'

/** Matches the backend per-request cap. */
export const ASSIGN_COHORT_CHUNK = 200

export async function assignCohortChunks({ url, ids, cohortId, onProgress }) {
  let updated = 0
  for (let i = 0; i < ids.length; i += ASSIGN_COHORT_CHUNK) {
    const chunk = ids.slice(i, i + ASSIGN_COHORT_CHUNK)
    onProgress?.(Math.min(i + chunk.length, ids.length), ids.length)
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: chunk, cohort_id: cohortId }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to assign year group')
    }
    updated += body.updated ?? 0
  }
  return { updated }
}
