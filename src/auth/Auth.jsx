import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Auth.css'
import { authHeaders, clearTokens, getRefreshToken, setTokens } from './token'
import AuthPanel from './auth-panel/AuthPanel.jsx'
import AuthShell from './AuthShell.jsx'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'

function Auth() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Don't check auth if we're on reset password page
    if (window.__isResettingPassword) {
      setChecking(false)
      return
    }

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      ; (async () => {
        try {
          const res = await fetch(`${API_BASE}/me`, {
            credentials: 'include',
            cache: 'no-store',
            headers: authHeaders(),
          })
          if (res.ok) {
            const data = await res.json()
            if (data?.user?.needs_password_change) {
              navigate('/auth/change-password', { replace: true })
              return
            }
            const hasAccess = !!data?.access?.has_active_access
            if (hasAccess) {
              navigate('/dashboard', { replace: true })
            } else {
              navigate('/subscribe', { replace: true })
            }
          } else if (res.status === 401) {
            // Try refreshing session using refresh token
            const refreshToken = getRefreshToken()
            if (refreshToken) {
              try {
                const r = await fetch(`${API_BASE}/auth/refresh`, {
                  method: 'POST',
                  credentials: 'include',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ refresh_token: refreshToken, remember: true })
                })
                if (r.ok) {
                  const data = await r.json()
                  setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
                  // Retry /me once
                  const retry = await fetch(`${API_BASE}/me`, {
                    credentials: 'include',
                    cache: 'no-store',
                    headers: authHeaders(),
                  })
                  if (retry.ok) {
                    const d2 = await retry.json()
                    if (d2?.user?.needs_password_change) {
                      navigate('/auth/change-password', { replace: true })
                      return
                    }
                    const ok2 = !!d2?.access?.has_active_access
                    if (ok2) {
                      navigate('/dashboard', { replace: true })
                    } else {
                      navigate('/subscribe', { replace: true })
                    }
                  } else if (retry.status === 401) {
                    clearTokens()
                  }
                } else if (r.status === 401) {
                  clearTokens()
                }
              } catch { }
            } else {
              clearTokens()
            }
          }
        } catch {
          // ignore
        } finally {
          setChecking(false)
        }
      })()
  }, [navigate])

  if (checking) {
    return <LoadingScreen message="Checking your session..." />
  }

  return (
    <AuthShell>
      <AuthPanel />
    </AuthShell>
  )
}

export default Auth


