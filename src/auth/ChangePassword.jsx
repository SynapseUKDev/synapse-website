import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import './Auth.css'
import './auth-panel/AuthPanel.css'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { authHeaders, authenticatedFetch, setTokens } from './token'
import logo from '../assets/logo/logo.png'

function ChangePassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Verify user is authenticated and actually needs a password change
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    authenticatedFetch(`${API_BASE}/me`, {
      cache: 'no-store',
    })
      .then(async (res) => {
        if (!res.ok) {
          navigate('/login', { replace: true })
          return
        }
        const data = await res.json()
        if (!data?.user?.needs_password_change) {
          // If they don't need a password change, send them to dashboard
          navigate('/dashboard', { replace: true })
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => {
        navigate('/login', { replace: true })
      })
  }, [navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long')
      return
    }

    setLoading(true)
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const res = await authenticatedFetch(`${API_BASE}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.error || 'Failed to update password')
      }

      const data = await res.json().catch(() => ({}))
      if (data?.access_token && data?.refresh_token) {
        setTokens({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
        })
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/dashboard', { replace: true })
      }, 2000)
    } catch (err) {
      console.error('Change password error:', err)
      setError(err.message || 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (checkingSession) {
    return <LoadingScreen message="Verifying session..." />
  }

  if (success) {
    return (
      <section className="auth">
        <div className="auth__split auth__split--left">
          <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
            <div className="auth-panel">
              <div className="auth-panel__notice">
                <div className="auth-panel__notice-header">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <h3>Password Updated</h3>
                </div>
                <p>
                  Your password has been successfully updated. Redirecting to your dashboard...
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="auth__split auth__split--right">
          <div className="auth__leftContent">
            <div className="auth__brand">
              <img src={logo} alt="Synapse UK" className="auth__logo" />
            </div>

            <div className="auth__hero">
              <h1 className="auth__headline">
                Master <span className="auth__gradient-text">Medical Excellence</span> with Confidence
              </h1>
              <p className="auth__subtitle">
                Join thousands of medical students who trust Synapse UK for their learning journey.
                Advanced practice questions, real-time analytics, and expert guidance.
              </p>
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="auth">
      <div className="auth__split auth__split--left">
        <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
          <div className="auth-panel">
            <div className="auth-panel__header">
              <h2 className="auth-panel__title">Update your password</h2>
              <p className="auth-panel__desc">
                Please set a new secure password for your reviewer account.
              </p>
            </div>

            <form className="auth-panel__form" onSubmit={handleSubmit}>
              <label className="auth-panel__label">New Password</label>
              <div className="auth-panel__input-wrapper">
                <input
                  className="auth-panel__input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-panel__eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              <label className="auth-panel__label">Confirm Password</label>
              <div className="auth-panel__input-wrapper">
                <input
                  className="auth-panel__input"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-panel__eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>

              {error && (
                <div className="auth-panel__notice auth-panel__notice--error" role="alert" style={{ marginTop: 8 }}>
                  <div className="auth-panel__notice-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <h3>There was a problem</h3>
                  </div>
                  <p>{error}</p>
                </div>
              )}

              <button
                className="auth-panel__cta"
                type="submit"
                disabled={loading}
              >
                {loading ? 'Updating password...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="auth__split auth__split--right">
        <div className="auth__leftContent">
          <div className="auth__brand">
            <img src={logo} alt="Synapse UK" className="auth__logo" />
          </div>

          <div className="auth__hero">
            <h1 className="auth__headline">
              Master <span className="auth__gradient-text">Medical Excellence</span> with Confidence
            </h1>
            <p className="auth__subtitle">
              Join thousands of medical students who trust Synapse UK for their learning journey.
              Advanced practice questions, real-time analytics, and expert guidance.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ChangePassword
