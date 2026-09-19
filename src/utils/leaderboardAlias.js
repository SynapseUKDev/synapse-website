/**
 * Stable anonymised label for global / university leaderboards.
 * Must stay in sync with public.leaderboard_alias in sql/084_leaderboard_stats.sql.
 * There is no mapping table — this is a hash of users.id.
 */
export function anonymisedLeaderboardLabel(userId) {
  const id = String(userId || '')
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  }
  return `Student ${1000 + (hash % 9000)}`
}
