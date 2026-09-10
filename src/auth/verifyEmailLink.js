const EMAIL_OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])

/**
 * Exchange a token_hash from an email link for a session. The hash is verified
 * by our API so the browser never has to open *.supabase.co.
 */
export async function verifyEmailLink({ tokenHash, type }) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const otpType = EMAIL_OTP_TYPES.has(type) ? type : 'magiclink'
  const res = await fetch(`${API_BASE}/auth/verify-email-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token_hash: tokenHash, type: otpType }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.error || 'This link is invalid or has expired.')
  }
  return data
}
