/**
 * Heatmap intensity for one day, shared by the dashboard heatmap and the analytics
 * year grid so the same day can never show two different colours.
 *
 * Levels are a percentage of the user's OWN daily target, not absolute counts. The
 * old absolute thresholds (<=49, <=99, <=199, 200+) meant a student who hit a 30/day
 * target exactly landed on level 1 — red on the red-to-green ramp — so doing exactly
 * what was asked of them looked like failure.
 */
export const DEFAULT_DAILY_TARGET = 30

export function levelFor(count, dailyTarget = DEFAULT_DAILY_TARGET) {
  if (!count || count <= 0) return 0

  const target = Number(dailyTarget) > 0 ? Number(dailyTarget) : DEFAULT_DAILY_TARGET
  const share = count / target

  if (share < 0.5) return 1
  if (share < 1) return 2
  if (share < 1.5) return 3
  return 4
}

/**
 * "12 questions · 1 OSCE station · 1 mock paper", omitting anything at zero.
 * Shared by both heatmaps so the same day is never described two different ways.
 */
export function describeDay(entry) {
  if (!entry || entry.count <= 0) return 'No activity'
  const k = entry.byKind
  if (!k) return `${entry.count} ${entry.count === 1 ? 'activity' : 'activities'}`

  const parts = []
  if (k.question) parts.push(`${k.question} question${k.question === 1 ? '' : 's'}`)
  if (k.osce) parts.push(`${k.osce} OSCE station${k.osce === 1 ? '' : 's'}`)
  if (k.mock) parts.push(`${k.mock} mock paper${k.mock === 1 ? '' : 's'}`)
  return parts.join(' · ')
}
