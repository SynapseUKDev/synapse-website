import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './auth-panel/AuthPanel.css'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { clearTokens } from './token'
import { verifyEmailLink } from './verifyEmailLink'
import AuthShell from './AuthShell.jsx'

function EyeIcon({ off }) {
  return off ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [checkingToken, setCheckingToken] = useState(true)
  const [, setIsResetting] = useState(false)
  const [recoveryTokens, setRecoveryTokens] = useState({ accessToken: null, refreshToken: null })
  const hasProcessedTokens = useRef(false)

  useEffect(() => {
    if (hasProcessedTokens.current) {
      return
    }
    window.__isResettingPassword = true

    clearTokens()

    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    fetch(`${API_BASE}/auth/clear-session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})

    const location = window.location

    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    const search = location.search && location.search.startsWith('?') ? location.search.slice(1) : ''

    const hashParams = new URLSearchParams(hash)
    const searchParamsObj = new URLSearchParams(search)

    const accessToken = hashParams.get('access_token') || searchParamsObj.get('access_token')
    const refreshToken = hashParams.get('refresh_token') || searchParamsObj.get('refresh_token')
    const type = hashParams.get('type') || searchParamsObj.get('type')
    const tokenHash = searchParamsObj.get('token_hash') || hashParams.get('token_hash')

    const applyRecoveryTokens = (nextAccess, nextRefresh) => {
      setRecoveryTokens({ accessToken: nextAccess, refreshToken: nextRefresh })
      hasProcessedTokens.current = true
      const cleanUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      setCheckingToken(false)
      setIsResetting(true)
    }

    if (tokenHash) {
      hasProcessedTokens.current = true
      verifyEmailLink({ tokenHash, type: type || 'recovery' })
        .then((session) => {
          applyRecoveryTokens(session.access_token, session.refresh_token)
        })
        .catch(() => {
          setError('Invalid or missing reset link. Please request a new password reset.')
          setCheckingToken(false)
        })
    } else if (type === 'recovery' && accessToken && refreshToken) {
      applyRecoveryTokens(accessToken, refreshToken)
    } else {
      setError('Invalid or missing reset link. Please request a new password reset.')
      setCheckingToken(false)
      hasProcessedTokens.current = true
    }

    return () => {
      window.__isResettingPassword = false
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    if (!recoveryTokens.accessToken || !recoveryTokens.refreshToken) {
      setError('Reset link has expired. Please request a new password reset.')
      return
    }

    setLoading(true)
    setIsResetting(true)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          password,
          access_token: recoveryTokens.accessToken,
          refresh_token: recoveryTokens.refreshToken,
        })
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to reset password')
      }

      setSuccess(true)
      clearTokens()
      setRecoveryTokens({ accessToken: null, refreshToken: null })
      window.__isResettingPassword = false
      setTimeout(() => {
        navigate('/login', { replace: true })
      }, 3000)
    } catch (err) {
      console.error('Reset password error:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checkingToken) {
    return <LoadingScreen message="Verifying reset link..." />
  }

  if (error && !password) {
    return (
      <AuthShell>
        <div className="auth-panel">
          <div className="auth-panel__header">
            <h2 className="auth-panel__title">Invalid reset link</h2>
            <p className="auth-panel__desc">{error}</p>
          </div>
          <button className="auth-panel__cta" onClick={() => navigate('/login', { replace: true })}>
            Back to Sign In
          </button>
        </div>
      </AuthShell>
    )
  }

  if (success) {
    return (
      <AuthShell>
        <div className="auth-panel">
          <div className="auth-panel__notice">
            <div className="auth-panel__notice-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <h3>Password reset successful</h3>
            </div>
            <p>Your password has been reset successfully. You will be redirected to the sign in page shortly.</p>
          </div>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <div className="auth-panel">
        <div className="auth-panel__header">
          <h2 className="auth-panel__title">Reset your password</h2>
          <p className="auth-panel__desc">Enter your new password below.</p>
        </div>

        <form className="auth-panel__form" onSubmit={handleSubmit}>
          <label className="auth-panel__label">New Password</label>
          <div className="auth-panel__input-wrapper">
            <input
              className="auth-panel__input"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-panel__eye-btn"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>

          <label className="auth-panel__label">Confirm Password</label>
          <div className="auth-panel__input-wrapper">
            <input
              className="auth-panel__input"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Re-enter your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-panel__eye-btn"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            >
              <EyeIcon off={showConfirmPassword} />
            </button>
          </div>

          {error && (
            <div className="auth-panel__notice auth-panel__notice--error" role="alert">
              <div className="auth-panel__notice-header">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <h3>There was a problem</h3>
              </div>
              <p>{error}</p>
            </div>
          )}

          <button className="auth-panel__cta" type="submit" disabled={loading}>
            {loading ? 'Resetting password...' : 'Reset Password'}
          </button>
        </form>
      </div>
    </AuthShell>
  )
}

export default ResetPassword
