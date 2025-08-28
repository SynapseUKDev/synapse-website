// Simple token utilities to work around iOS cookie restrictions
export const ACCESS_TOKEN_KEY = 'sb_access_token'
export const REFRESH_TOKEN_KEY = 'sb_refresh_token'

export function setTokens({ accessToken, refreshToken }) {
  try {
    if (accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken)
    if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken)
  } catch {}
}

export function getAccessToken() {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearTokens() {
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {}
}

export function authHeaders() {
  const token = getAccessToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}


