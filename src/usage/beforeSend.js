import { EVENT_PROPS } from './catalog.js'
import { toRoutePattern } from './routePattern.js'

// PostHog `before_send` hook: the last check on every event before it leaves the browser.
// Policy: specs/002-platform-usage-analytics/contracts/capture-policy.md.
//  - drops everything on admin and institution-management pages (they show other people's data)
//  - strips query strings and fragments from every URL property (they can carry tokens or ids)
//  - drops custom events that are not in the catalogue, and props they are not allowed to carry

const EXCLUDED_PATH_PREFIXES = ['/dashboard/admin', '/dashboard/institution']

/** Registered on every event by analytics.js; produced server-side by GET /me. */
export const SUPER_PROPERTY_KEYS = [
  'user_type',
  'institution_id',
  'institution_name',
  'cohort_id',
  'cohort_name',
  'is_internal',
  'signup_month',
  'catalog_version',
]

// Non-$ keys PostHog itself puts on every event.
const POSTHOG_KEYS = ['token', 'distinct_id']

const URL_KEYS = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$pathname',
  '$prev_pageview_pathname',
  '$initial_pathname',
]

const MAX_STRING = 64

function stripQueryAndFragment(value) {
  return typeof value === 'string' ? value.split(/[?#]/)[0] : value
}

function scrubUrls(props) {
  if (!props || typeof props !== 'object') return props
  const out = { ...props }
  for (const key of URL_KEYS) {
    if (key in out) out[key] = stripQueryAndFragment(out[key])
  }
  return out
}

function pathOf(props) {
  if (typeof props.$pathname === 'string') return stripQueryAndFragment(props.$pathname)
  if (typeof props.$current_url === 'string') {
    try {
      return new URL(props.$current_url).pathname
    } catch {
      return null
    }
  }
  return null
}

function isExcludedPath(path) {
  return EXCLUDED_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

function isAllowedValue(rule, value) {
  if (Array.isArray(rule)) return rule.includes(value)
  if (rule === 'string') return typeof value === 'string' && value.length <= MAX_STRING
  if (rule === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (rule === 'boolean') return typeof value === 'boolean'
  return false
}

/** Only the catalogue props for `name` with valid values; null when `name` is not in the catalogue. */
export function sanitizeEventProps(name, props) {
  const rules = EVENT_PROPS[name]
  if (!rules) return null
  const out = {}
  for (const [key, rule] of Object.entries(rules)) {
    if (props && key in props && isAllowedValue(rule, props[key])) out[key] = props[key]
  }
  return out
}

export function beforeSend(event) {
  try {
    if (!event || typeof event.event !== 'string' || !event.properties || typeof event.properties !== 'object') {
      return null
    }

    const path = pathOf(event.properties) ?? window.location.pathname
    if (isExcludedPath(path)) return null

    let properties = scrubUrls(event.properties)
    properties.$route_pattern = toRoutePattern(path)

    if (!event.event.startsWith('$')) {
      const allowed = sanitizeEventProps(event.event, properties)
      if (!allowed) return null
      const kept = {}
      for (const [key, value] of Object.entries(properties)) {
        if (key.startsWith('$') || POSTHOG_KEYS.includes(key) || SUPER_PROPERTY_KEYS.includes(key)) kept[key] = value
      }
      properties = { ...kept, ...allowed }
    }

    const out = { ...event, properties }
    if (event.$set) out.$set = scrubUrls(event.$set)
    if (event.$set_once) out.$set_once = scrubUrls(event.$set_once)
    return out
  } catch {
    return null
  }
}
