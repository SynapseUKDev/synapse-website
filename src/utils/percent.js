// Accuracy is shown to 1 decimal place everywhere (qbank, sessions, leaderboards) so
// the same figure never reads differently on two pages. Matches the API's pct1.

/** 2 of 3 → 66.7; null when there is nothing to divide by. */
export const pct1 = (part, whole) => (whole > 0 ? Math.round((1000 * part) / whole) / 10 : null)

/** 66.7 → "66.7%", 70 → "70.0%"; null/undefined → `fallback`. */
export const formatPct = (value, fallback = 'N/A') =>
  value == null || Number.isNaN(Number(value)) ? fallback : `${Number(value).toFixed(1)}%`
