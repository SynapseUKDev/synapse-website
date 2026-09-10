/** In-app paths (`/dashboard`) or http(s) promo links. */
const DOMAIN_LIKE = /^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i

export function normalizeAnnouncementCtaUrl(value) {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/') || /^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/^HTTPS:\/\//i, 'https://').replace(/^HTTP:\/\//i, 'http://')
  }
  if (!trimmed.includes(' ') && DOMAIN_LIKE.test(trimmed)) return `https://${trimmed}`
  return trimmed
}

export function isAllowedAnnouncementCtaUrl(value) {
  if (typeof value !== 'string') return false
  const v = normalizeAnnouncementCtaUrl(value)
  if (!v) return false
  if (v.startsWith('/') && !v.startsWith('//') && !v.includes('\\')) return true
  try {
    const parsed = new URL(v)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

export function isExternalAnnouncementCtaUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(normalizeAnnouncementCtaUrl(value))
}

export function openAnnouncementCtaUrl(url, navigate) {
  const normalized = normalizeAnnouncementCtaUrl(url)
  if (!isAllowedAnnouncementCtaUrl(normalized)) return
  if (isExternalAnnouncementCtaUrl(normalized)) {
    window.open(normalized, '_blank', 'noopener,noreferrer')
    return
  }
  navigate?.(normalized)
}
