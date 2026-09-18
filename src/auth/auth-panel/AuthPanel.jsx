import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import './AuthPanel.css'
import { setTokens } from '../token'
import AuthCaptcha from './AuthCaptcha.jsx'

const swapTransition = { duration: 0.28, ease: [0.22, 1, 0.36, 1] }

function AuthPanel() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState(() => (
    new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'
  ))
  const [direction, setDirection] = useState(1)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')
  const [remember, setRemember] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [signupAttempted, setSignupAttempted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [warning, setWarning] = useState('')
  const [step, setStep] = useState('form') // 'form' | 'check-email'
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const turnstileRef = useRef(null)

  useEffect(() => {
    const next = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin'
    setMode(next)
  }, [location.search])

  const setAuthMode = (next) => {
    if (next === mode && !forgotPasswordMode) return
    setDirection(next === 'signup' ? 1 : -1)
    setMode(next)
    setWarning('')
    setError('')
    setStep('form')
    setSignupAttempted(false)
    setForgotPasswordMode(false)
    setCaptchaToken(null)
    const params = new URLSearchParams(location.search)
    if (next === 'signup') params.set('mode', 'signup')
    else params.delete('mode')
    const search = params.toString()
    navigate({ pathname: '/login', search: search ? `?${search}` : '' }, { replace: true })
  }

  const panelKey = forgotPasswordMode ? 'forgot' : mode
  const variants = reduce
    ? {
        enter: { opacity: 1, x: 0 },
        center: { opacity: 1, x: 0 },
        exit: { opacity: 1, x: 0 },
      }
    : {
        enter: (dir) => ({ opacity: 0, x: dir * 28 }),
        center: { opacity: 1, x: 0 },
        exit: (dir) => ({ opacity: 0, x: dir * -28 }),
      }

  return (
    <div className="auth-panel">
      {!forgotPasswordMode && (
        <div className="auth-panel__tabs-container">
          <div className="auth-panel__tabs" role="tablist">
            <motion.span
              className="auth-panel__tab-pill"
              animate={{ x: mode === 'signin' ? 0 : '100%' }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
              aria-hidden
            />
            <button
              type="button"
              className={`auth-panel__tab ${mode === 'signin' ? 'is-active' : ''}`}
              onClick={() => setAuthMode('signin')}
              aria-selected={mode === 'signin'}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-panel__tab ${mode === 'signup' ? 'is-active' : ''}`}
              onClick={() => setAuthMode('signup')}
              aria-selected={mode === 'signup'}
            >
              Sign Up
            </button>
          </div>
        </div>
      )}

      <div className="auth-panel__swap">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={panelKey}
            className="auth-panel__swap-inner"
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={reduce ? { duration: 0 } : swapTransition}
          >
      {mode === 'signup' && !forgotPasswordMode && (
        <div className="auth-panel__trial-banner">
          <div className="auth-panel__trial-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="10" />
            </svg>
          </div>
          <div className="auth-panel__trial-content">
            <div className="auth-panel__trial-title">Just £15 for 6 Months</div>
            <div className="auth-panel__trial-text">
              Full access to all features. Cancel anytime.
            </div>
          </div>
        </div>
      )}

      {!forgotPasswordMode && (
        <div className="auth-panel__header">
          <h2 className="auth-panel__title">
            {mode === 'signin' ? 'Welcome back!' : 'Create your account'}
          </h2>
          <p className="auth-panel__desc">
            {mode === 'signin'
              ? 'Enter your credentials to access your learning dashboard'
              : 'Join EduSynapse and start your UKMLA learning journey'}
          </p>
        </div>
      )}

      <form
        className="auth-panel__form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (forgotPasswordMode) return
          setError('')
          setWarning('')
          setStep('form')

          if (mode === 'signup') {
            setSignupAttempted(true)
            // Client-side validation guard — show red fields before hitting backend
            const hasErrors =
              !username.trim() ||
              !email.trim() ||
              !password.trim() || password.length < 6 ||
              !confirmPassword.trim() || confirmPassword !== password ||
              !termsAccepted
            if (hasErrors) {
              if (confirmPassword && confirmPassword !== password) {
                setError('Passwords do not match')
              }
              return
            }
          }

          setLoading(true)
          try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
            console.log('API_BASE:', API_BASE)

            if (mode === 'signup') {
              console.log('Attempting signup...')
              const res = await fetch(`${API_BASE}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, username, captchaToken, termsAccepted })
              })
              console.log('Signup response status:', res.status)
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Signup error:', data)
                turnstileRef.current?.reset()
                setCaptchaToken(null)
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
                body: JSON.stringify({ email, password, remember, captchaToken })
              })
              console.log('Signin response status:', res.status)
              if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                console.error('Signin error:', data)
                turnstileRef.current?.reset()
                setCaptchaToken(null)
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

        {!forgotPasswordMode && mode === 'signup' && (
          <>
            <label className="auth-panel__label">Username</label>
            <input
              className={`auth-panel__input${signupAttempted && !username.trim() ? ' auth-panel__input--invalid' : ''}`}
              type="text"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </>
        )}

        {!forgotPasswordMode && (
          <>
            <label className="auth-panel__label">Email address</label>
            <input
              className={`auth-panel__input${signupAttempted && !email.trim() ? ' auth-panel__input--invalid' : ''}`}
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label className="auth-panel__label">Password</label>
          </>
        )}
        {!forgotPasswordMode && (
          <div className="auth-panel__input-wrapper">
              <input
                className={`auth-panel__input${signupAttempted && mode === 'signup' && (!password.trim() || password.length < 6) ? ' auth-panel__input--invalid' : ''}`}
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
        )}

        {!forgotPasswordMode && mode === 'signup' && (
          <>
            <label className="auth-panel__label">Confirm password</label>
            <div className="auth-panel__input-wrapper">
              <input
                className={`auth-panel__input${signupAttempted && (!confirmPassword.trim() || confirmPassword !== password) ? ' auth-panel__input--invalid' : ''}`}
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
          </>
        )}

        {mode === 'signin' && !forgotPasswordMode && (
          <div className="auth-panel__row">
            <label className="auth-panel__checkbox">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              className="auth-panel__link"
              onClick={() => {
                setForgotPasswordMode(true)
                setCaptchaToken(null)
                setError('')
                setWarning('')
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              Forgot password?
            </button>
          </div>
        )}

        {forgotPasswordMode && (
          <>
            <div className="auth-panel__header">
              <h2 className="auth-panel__title">Reset your password</h2>
              <p className="auth-panel__desc">
                Enter your email address and we'll send you a link to reset your password.
              </p>
            </div>
            <label className="auth-panel__label">Email address</label>
            <input
              className="auth-panel__input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <AuthCaptcha
              captchaRef={turnstileRef}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
            <button
              className="auth-panel__cta"
              type="button"
              onClick={async () => {
                setError('')
                setWarning('')
                if (!email) {
                  setError('Please enter your email address')
                  return
                }
                if (!captchaToken) {
                  setError('Please complete the captcha')
                  return
                }
                setLoading(true)
                try {
                  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
                  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ email, captchaToken })
                  })
                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}))
                    turnstileRef.current?.reset()
                    setCaptchaToken(null)
                    throw new Error(data?.error || 'Failed to send reset email')
                  }
                  setStep('check-email')
                } catch (err) {
                  console.error('Forgot password error:', err)
                  setError(err.message || 'Something went wrong')
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading || !captchaToken}
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
            <button
              type="button"
              className="auth-panel__link"
              onClick={() => {
                setForgotPasswordMode(false)
                setCaptchaToken(null)
                setError('')
                setWarning('')
                setStep('form')
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px 0',
                textAlign: 'center',
                marginTop: '8px'
              }}
            >
              ← Back to sign in
            </button>
          </>
        )}

        {!forgotPasswordMode && mode === 'signup' && (
          <label className={`auth-panel__consent${signupAttempted && !termsAccepted ? ' auth-panel__consent--invalid' : ''}`} id="terms-consent-label">
            <input
              type="checkbox"
              id="terms-consent"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              required
            />
            <span>
              I agree to the{' '}
              <a
                href="https://www.synapseuk.org/terms-and-conditions"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-panel__consent-link"
              >
                Terms &amp; Conditions
              </a>
              {' '}and have read the{' '}
              <a
                href="https://www.synapseuk.org/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="auth-panel__consent-link"
              >
                Privacy Policy
              </a>
            </span>
          </label>
        )}

        {!forgotPasswordMode && (
          <>
            <AuthCaptcha
              captchaRef={turnstileRef}
              onSuccess={(token) => setCaptchaToken(token)}
              onExpire={() => setCaptchaToken(null)}
              onError={() => setCaptchaToken(null)}
            />
            <button
              className="auth-panel__cta"
              type="submit"
              disabled={loading || !captchaToken || (mode === 'signup' && step === 'check-email')}
            >
              {loading
                ? 'Please wait...'
                : mode === 'signin'
                  ? 'Sign In'
                  : step === 'check-email'
                    ? 'Verification sent'
                    : 'Create account'}
            </button>
          </>
        )}

        {warning && (
          <div className="auth-panel__notice auth-panel__notice--warning" role="status" style={{ marginTop: 8 }}>
            <div className="auth-panel__notice-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              <h3>Account already exists</h3>
            </div>
            <p>{warning}</p>
          </div>
        )}
        {error && (
          <div className="auth-panel__notice auth-panel__notice--error" role="alert" style={{ marginTop: 8 }}>
            <div className="auth-panel__notice-header">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              <h3>There was a problem</h3>
            </div>
            <p>{error}</p>
          </div>
        )}
      </form>

      {step === 'check-email' && (
        <div className="auth-panel__notice">
          <div className="auth-panel__notice-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" /></svg>
            <h3>Check your email</h3>
          </div>
          <p>
            {forgotPasswordMode
              ? <>We've sent a password reset link to <strong>{email}</strong>. Please check your email and click the link to reset your password.</>
              : <>We've sent a verification link to <strong>{email}</strong>. Please verify your email to activate your account. Once verified, return here to sign in.</>}
          </p>
        </div>
      )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

export default AuthPanel
