import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import './Auth.css'
import './auth-panel/AuthPanel.css'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { clearTokens } from './token'
import logo from '../assets/logo/logo.png'

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
  const [isResetting, setIsResetting] = useState(false)
  // Store tokens in memory only - never in URL or localStorage
  const [recoveryTokens, setRecoveryTokens] = useState({ accessToken: null, refreshToken: null })
  const hasProcessedTokens = useRef(false)

  useEffect(() => {
    if (hasProcessedTokens.current) {
      return
    }
    // Set a flag to prevent any auth checks while on reset page
    window.__isResettingPassword = true
    
    // Clear tokens and cookies immediately when reset page loads
    clearTokens()
    
    // Clear cookies on backend to prevent old session from being used
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    fetch(`${API_BASE}/auth/clear-session`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {
      // Ignore errors - cookies might not exist
    })
    
    const location = window.location
    
    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    const search = location.search && location.search.startsWith('?') ? location.search.slice(1) : ''
    
    const hashParams = new URLSearchParams(hash)
    const searchParamsObj = new URLSearchParams(search)
    
    const accessToken = hashParams.get('access_token') || searchParamsObj.get('access_token')
    const refreshToken = hashParams.get('refresh_token') || searchParamsObj.get('refresh_token')
    const type = hashParams.get('type') || searchParamsObj.get('type')


    if (type === 'recovery' && accessToken && refreshToken) {
      setRecoveryTokens({ accessToken, refreshToken })
      
      hasProcessedTokens.current = true
      
      const cleanUrl = window.location.origin + window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      setCheckingToken(false)
      setIsResetting(true)
    } else {
      setError('Invalid or missing reset link. Please request a new password reset.')
      setCheckingToken(false)
      hasProcessedTokens.current = true
    }
    
    // Cleanup: remove flag when component unmounts
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

    // SECURITY: Verify we still have tokens in memory
    if (!recoveryTokens.accessToken || !recoveryTokens.refreshToken) {
      setError('Reset link has expired. Please request a new password reset.')
      return
    }

    setLoading(true)
    setIsResetting(true) // Ensure we stay in reset mode
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
      // SECURITY: Clear recovery tokens from memory after successful reset
      setRecoveryTokens({ accessToken: null, refreshToken: null })
      // Clear the reset flag before redirecting
      window.__isResettingPassword = false
      // Redirect to login after 3 seconds
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
      <section className="auth">
        <div className="auth__split auth__split--left">
          <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
            <div className="auth-panel">
              <div className="auth-panel__header">
                <h2 className="auth-panel__title">Invalid Reset Link</h2>
                <p className="auth-panel__desc">
                  {error}
                </p>
              </div>
              <button
                className="auth-panel__cta"
                onClick={() => navigate('/login', { replace: true })}
              >
                Back to Sign In
              </button>
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
              <div style={{ 
                marginTop: 20, 
                padding: '14px 18px', 
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                border: '2px solid #a7f3d0', 
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#059669' }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div>
                  <div style={{ fontWeight: 800, color: '#0e8a4b', fontSize: 15 }}>3-Week Free Trial</div>
                  <div style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>Then just £15 for 6 months • No card required</div>
                </div>
              </div>
            </div>

            <div className="auth__features">
              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">UKMLA-Focused</div>
                  <div className="auth__feature-desc">Questions crafted by UK medical professionals</div>
                </div>
              </div>

              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">Real-Time Analytics</div>
                  <div className="auth__feature-desc">Track your progress with advanced insights</div>
                </div>
              </div>

              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3l8-8"/>
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">Instant Feedback</div>
                  <div className="auth__feature-desc">Comprehensive explanations with visual aids</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    )
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
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  <h3>Password Reset Successful</h3>
                </div>
                <p>
                  Your password has been reset successfully. You will be redirected to the sign in page shortly.
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
              <div style={{ 
                marginTop: 20, 
                padding: '14px 18px', 
                background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                border: '2px solid #a7f3d0', 
                borderRadius: 12,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#059669' }}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                <div>
                  <div style={{ fontWeight: 800, color: '#0e8a4b', fontSize: 15 }}>3-Week Free Trial</div>
                  <div style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>Then just £15 for 6 months • No card required</div>
                </div>
              </div>
            </div>

            <div className="auth__features">
              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">UKMLA-Focused</div>
                  <div className="auth__feature-desc">Questions crafted by UK medical professionals</div>
                </div>
              </div>

              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">Real-Time Analytics</div>
                  <div className="auth__feature-desc">Track your progress with advanced insights</div>
                </div>
              </div>

              <div className="auth__feature">
                <div className="auth__feature-icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 11l3 3l8-8"/>
                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02"/>
                  </svg>
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">Instant Feedback</div>
                  <div className="auth__feature-desc">Comprehensive explanations with visual aids</div>
                </div>
              </div>
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
              <h2 className="auth-panel__title">Reset your password</h2>
              <p className="auth-panel__desc">
                Enter your new password below.
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
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
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>

              {error && (
                <div className="auth-panel__notice auth-panel__notice--error" role="alert" style={{ marginTop: 8 }}>
                  <div className="auth-panel__notice-header">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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
                {loading ? 'Resetting password...' : 'Reset Password'}
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
            <div style={{ 
              marginTop: 20, 
              padding: '14px 18px', 
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
              border: '2px solid #a7f3d0', 
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#059669' }}>
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <div>
                <div style={{ fontWeight: 800, color: '#0e8a4b', fontSize: 15 }}>3-Week Free Trial</div>
                <div style={{ color: '#059669', fontSize: 13, fontWeight: 600 }}>Then just £15 for 6 months • No card required</div>
              </div>
            </div>
          </div>

          <div className="auth__features">
            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">UKMLA-Focused</div>
                <div className="auth__feature-desc">Questions crafted by UK medical professionals</div>
              </div>
            </div>

            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">Real-Time Analytics</div>
                <div className="auth__feature-desc">Track your progress with advanced insights</div>
              </div>
            </div>

            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3l8-8"/>
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">Instant Feedback</div>
                <div className="auth__feature-desc">Comprehensive explanations with visual aids</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default ResetPassword

