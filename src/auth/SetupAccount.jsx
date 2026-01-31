import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Auth.css'
import './auth-panel/AuthPanel.css'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { setTokens } from './token'
import logo from '../assets/logo/logo.png'

function SetupAccount() {
    const navigate = useNavigate()
    const location = useLocation()
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [checkingToken, setCheckingToken] = useState(true)
    const [inviteTokens, setInviteTokens] = useState({ accessToken: null, refreshToken: null })
    const hasProcessedTokens = useRef(false)

    useEffect(() => {
        if (hasProcessedTokens.current) return

        const hash = location.hash?.startsWith('#') ? location.hash.slice(1) : ''
        const search = location.search?.startsWith('?') ? location.search.slice(1) : ''

        const hashParams = new URLSearchParams(hash)
        const searchParams = new URLSearchParams(search)

        const accessToken = hashParams.get('access_token') || searchParams.get('access_token')
        const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token')

        if (accessToken && refreshToken) {
            setInviteTokens({ accessToken, refreshToken })
            hasProcessedTokens.current = true
            // Clean URL
            const cleanUrl = window.location.origin + window.location.pathname
            window.history.replaceState({}, '', cleanUrl)

            // Fetch user info from API to get email
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
            fetch(`${API_BASE}/auth/get-user-from-token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: accessToken })
            })
                .then(res => res.json())
                .then(data => {
                    if (data.email) {
                        setEmail(data.email)
                        setUsername(data.email.split('@')[0])
                    }
                    setCheckingToken(false)
                })
                .catch(() => {
                    setCheckingToken(false)
                })
        } else {
            setError('Invalid or missing setup link. Please use the link from your invite email.')
            setCheckingToken(false)
            hasProcessedTokens.current = true
        }
    }, [location])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError('')

        if (!username.trim()) {
            setError('Please enter a username')
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long')
            return
        }

        if (!inviteTokens.accessToken || !inviteTokens.refreshToken) {
            setError('Session expired. Please use the link from your invite email again.')
            return
        }

        setLoading(true)
        try {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

            const res = await fetch(`${API_BASE}/auth/setup-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    password,
                    username: username.trim(),
                    access_token: inviteTokens.accessToken,
                    refresh_token: inviteTokens.refreshToken,
                })
            })

            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(data?.error || 'Failed to set up account')
            }

            const data = await res.json()

            // Set tokens from response
            if (data.access_token && data.refresh_token) {
                setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
            }

            setSuccess(true)
            // Redirect to dashboard after short delay
            setTimeout(() => {
                navigate('/dashboard', { replace: true })
            }, 1500)
        } catch (err) {
            console.error('Setup account error:', err)
            setError(err.message || 'Something went wrong')
        } finally {
            setLoading(false)
        }
    }

    if (checkingToken) {
        return <LoadingScreen message="Setting up your account..." />
    }

    if (error && !password) {
        return (
            <section className="auth">
                <div className="auth__split auth__split--left">
                    <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
                        <div className="auth-panel">
                            <div className="auth-panel__header">
                                <h2 className="auth-panel__title">Invalid Setup Link</h2>
                                <p className="auth-panel__desc">{error}</p>
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
                            </p>
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
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    <h3>Account Setup Complete!</h3>
                                </div>
                                <p>
                                    Welcome to Synapse UK! You're being redirected to your dashboard...
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
                            <h2 className="auth-panel__title">Complete Your Account</h2>
                            <p className="auth-panel__desc">
                                You've been invited to Synapse UK! Set up your account to get started.
                            </p>
                        </div>

                        <div className="auth-panel__trial-banner" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', borderColor: '#fcd34d' }}>
                            <div className="auth-panel__trial-icon" style={{ color: '#92400e' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                    <path d="M2 17l10 5 10-5" />
                                    <path d="M2 12l10 5 10-5" />
                                </svg>
                            </div>
                            <div className="auth-panel__trial-content">
                                <div className="auth-panel__trial-title" style={{ color: '#92400e' }}>Beta Tester Access</div>
                                <div className="auth-panel__trial-subtitle" style={{ color: '#b45309' }}>1 month of free access to all features</div>
                            </div>
                        </div>

                        <form className="auth-panel__form" onSubmit={handleSubmit}>
                            <label className="auth-panel__label">Email address</label>
                            <input
                                className="auth-panel__input"
                                type="email"
                                value={email}
                                disabled
                                style={{ background: '#f3f4f6', color: '#6b7280', cursor: 'not-allowed' }}
                            />

                            <label className="auth-panel__label">Username</label>
                            <input
                                className="auth-panel__input"
                                type="text"
                                placeholder="Choose a username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                            />

                            <label className="auth-panel__label">Password</label>
                            <div className="auth-panel__input-wrapper">
                                <input
                                    className="auth-panel__input"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a password"
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

                            <button
                                className="auth-panel__cta"
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? 'Setting up...' : 'Complete Setup'}
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
                            Welcome to <span className="auth__gradient-text">Synapse UK</span>
                        </h1>
                        <p className="auth__subtitle">
                            Thank you for joining our beta programme! You'll have access to all features for 1 month.
                        </p>
                    </div>

                    <div className="auth__features">
                        <div className="auth__feature">
                            <div className="auth__feature-icon">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="3" />
                                    <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1" />
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
                                    <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
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
                                    <path d="M9 11l3 3l8-8" />
                                    <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02" />
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

export default SetupAccount
