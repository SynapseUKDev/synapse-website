import { authenticatedFetch } from '../../auth/token'

/** Matches the backend per-request cap (and Resend's comfort zone). */
export const RESEND_CHUNK = 50

export function bulkResendNotice(body) {
  const sent = body.sent ?? 0
  const skipped = body.skipped ?? 0
  const failed = body.failed ?? 0
  const parts = [`Resent ${sent} invite${sent === 1 ? '' : 's'}.`]
  if (skipped) parts.push(`${skipped} already set up.`)
  if (failed) parts.push(`${failed} failed.`)
  return parts.join(' ')
}

export async function resendInviteChunks({ url, ids, onProgress }) {
  let sent = 0
  let skipped = 0
  let failed = 0
  for (let i = 0; i < ids.length; i += RESEND_CHUNK) {
    const chunk = ids.slice(i, i + RESEND_CHUNK)
    onProgress?.(Math.min(i + chunk.length, ids.length), ids.length)
    const res = await authenticatedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: chunk }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to resend invites')
    }
    sent += body.sent ?? 0
    skipped += body.skipped ?? 0
    failed += body.failed ?? 0
  }
  return { sent, skipped, failed }
}
