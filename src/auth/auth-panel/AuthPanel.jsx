import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AuthPanel.css'
import { setTokens } from '../token'

function AuthPanel() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('signin')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'check-email'

  return (
    <div className="auth-panel">
      <div className="auth-panel__tabs-container">
        <div className="auth-panel__tabs" role="tablist">
          <button
            className={`auth-panel__tab ${mode === 'signin' ? 'is-active' : ''}`}
            onClick={() => { setMode('signin'); setWarning(''); setError(''); setStep('form'); }}
            aria-selected={mode === 'signin'}
          >
            Sign In
          </button>
          <button
            className={`auth-panel__tab ${mode === 'signup' ? 'is-active' : ''}`}
            onClick={() => { setMode('signup'); setWarning(''); setError(''); }}
            aria-selected={mode === 'signup'}
          >
            Sign Up
          </button>
        </div>
      </div>

      <div className="auth-panel__header">
        <h2 className="auth-panel__title">
          {mode === 'signin' ? 'Welcome back!' : 'Create your account'}
        </h2>
        <p className="auth-panel__desc">
          {mode === 'signin'
            ? 'Enter your credentials to access your learning dashboard'
            : 'Join Synapse and start your learning journey today'}
        </p>
      </div>

      <form
        className="auth-panel__form"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          setWarning('')
          setStep('form')
          setLoading(true)
          try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
            console.log('API_BASE:', API_BASE)
            
            if (mode === 'signup') {
              if (password !== confirmPassword) {
                setError('Passwords do not match')
                return
              }
              console.log('Attempting signup...')
              const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, username })
              })
              console.log('Signup response status:', res.status)
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Signup error:', data)
                if (res.status === 409) {
                  setWarning(data?.error || 'An account with this email already exists. Please sign in instead.')
                  return
                }
                throw new Error(data?.error || `Sign up failed (${res.status})`)
              }
              setStep('check-email')
            } else {
              console.log('Attempting signin...')
              const res = await fetch(`${API_BASE}/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, remember })
              })
              console.log('Signin response status:', res.status)
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Signin error:', data)
                throw new Error(data?.error || `Sign in failed (${res.status})`)
              }
              const data = await res.json().catch(() => ({}))
              if (data?.access_token) {
                setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
              }
              console.log('Signin successful, navigating to dashboard')
              navigate('/dashboard')
            }
          } catch (err) {
            console.error('Auth error:', err)
            setError(err.message || 'Something went wrong')
          } finally {
            setLoading(false)
          }
        }}
      >
        
        {mode === 'signup' && (
          <>
            <label className="auth-panel__label">Username</label>
            <input 
              className="auth-panel__input" 
              type="text" 
              placeholder="Choose a username" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required 
            />
          </>
        )}

        <label className="auth-panel__label">Email address</label>
        <input 
          className="auth-panel__input" 
          type="email" 
          placeholder="Enter your email" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required 
        />

        <label className="auth-panel__label">Password</label>
        <div className="auth-panel__input-wrapper">
          <input 
            className="auth-panel__input" 
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password" 
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

        {mode === 'signup' && (
          <>
            <label className="auth-panel__label">Confirm password</label>
            <div className="auth-panel__input-wrapper">
              <input 
                className="auth-panel__input" 
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Re-enter your password" 
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
          </>
        )}

        {mode === 'signin' && (
          <div className="auth-panel__row">
            <label className="auth-panel__checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <a className="auth-panel__link" href="#">Forgot password?</a>
          </div>
        )}

        <button
          className="auth-panel__cta"
          type="submit"
          disabled={loading || (mode === 'signup' && step === 'check-email')}
        >
          {loading
            ? 'Please wait...'
            : mode === 'signin'
              ? 'Sign In'
              : step === 'check-email'
                ? 'Verification sent'
                : 'Create account'}
        </button>

        {warning && (
          <div className="auth-panel__notice auth-panel__notice--warning" role="status" style={{ marginTop: 8 }}>
            <div className="auth-panel__notice-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <h3>Account already exists</h3>
            </div>
            <p>{warning}</p>
          </div>
        )}
        {error && (
          <div className="auth-panel__notice auth-panel__notice--error" role="alert" style={{ marginTop: 8 }}>
            <div className="auth-panel__notice-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h3>There was a problem</h3>
            </div>
            <p>{error}</p>
          </div>
        )}
      </form>

      {step === 'check-email' && (
        <div className="auth-panel__notice">
          <div className="auth-panel__notice-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z"/><path d="M22 6l-10 7L2 6"/></svg>
            <h3>Check your email</h3>
          </div>
          <p>
            We’ve sent a verification link to <strong>{email}</strong>. Please verify your email to activate your account. Once verified, return here to sign in.
          </p>
        </div>
      )}
    </div>
  )
}

export default AuthPanel
