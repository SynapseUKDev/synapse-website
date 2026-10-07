import { resetAnalytics } from '../usage/client.js'

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

export function getRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    return null
  }
}

// Every sign-out path calls clearTokens, so it also forgets the analytics identity
// (a no-op when PostHog was never loaded) so the next person on this browser starts fresh.
export function clearTokens() {
  resetAnalytics()
  try {
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {}
}

export function authHeaders() {
  const token = getAccessToken()
  const refreshToken = getRefreshToken()
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(refreshToken ? { 'X-Refresh-Token': refreshToken } : {}),
  }
}

/**
 * Wraps fetch to automatically handle token refresh on 401 errors
 * @param {string} url - The URL to fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<Response>} - The fetch response
 */
// FormData bodies (file uploads) must not get a JSON content type: the browser
// sets multipart/form-data with the boundary itself.
function requestHeaders(options, withAuth) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData
  return {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(withAuth ? authHeaders() : {}),
    ...(options.headers || {}),
  }
}

export async function authenticatedFetch(url, options = {}) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  
  // Make initial request
  let response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: requestHeaders(options, true),
  })

  // If 401, try to refresh token and retry once
  if (response.status === 401) {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken, remember: true })
        })
        
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
          
          // Retry the original request with new token
          response = await fetch(url, {
            ...options,
            credentials: 'include',
            headers: requestHeaders(options, true),
          })
        } else if (refreshRes.status === 401) {
          // Refresh token is also invalid, clear tokens
          clearTokens()
          // Dispatch event to notify app of auth failure
          window.dispatchEvent(new Event('auth:changed'))
        }
      } catch (error) {
        console.error('Token refresh failed:', error)
        clearTokens()
        window.dispatchEvent(new Event('auth:changed'))
      }
    } else {
      // Cookie-only session: retry without Bearer header (middleware uses cookies).
      response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers: requestHeaders(options, false),
      })
      if (response.status !== 401) {
        return response
      }
      clearTokens()
      window.dispatchEvent(new Event('auth:changed'))
    }
  }

  return response
}


