import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Auth.css'
import './auth-panel/AuthPanel.css'
import AuthShell from './AuthShell.jsx'
import { authHeaders, clearTokens } from './token'

function Subscribe() {
  const [user, setUser] = useState(null)
  const [access, setAccess] = useState(null)
  const [banner, setBanner] = useState({ type: '', text: '' })
  const [processing, setProcessing] = useState(false)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const location = useLocation()
  const navigate = useNavigate()

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user || null)
        setAccess(data.access || null)
        if (data?.access?.has_active_access) {
          navigate('/dashboard', { replace: true })
        }
      }
    } catch { }
  }, [API_BASE, navigate])

  useEffect(() => { fetchMe() }, [fetchMe])

  useEffect(() => {
    const params = new URLSearchParams(location.search || '')
    if (params.get('success') === '1') {
      setBanner({ type: 'success', text: 'Payment complete. Finalizing your subscription…' })
        ; (async () => {
          setProcessing(true)
          const sessionId = params.get('session_id')

          if (sessionId) {
            try {
              console.log('Confirming session:', sessionId)
              const resp = await fetch(`${API_BASE}/billing/confirm-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ session_id: sessionId })
              })
              console.log('Confirm response status:', resp.status)

              if (resp.ok) {
                console.log('Session confirmed successfully')
                const res = await fetch(`${API_BASE}/me?ts=${Date.now()}`, {
                  credentials: 'include',
                  cache: 'no-store',
                  headers: { 'Content-Type': 'application/json', ...authHeaders() }
                })
                if (res.ok) {
                  const data = await res.json()
                  console.log('User data after confirm:', data)
                  if (data?.access?.has_active_access) {
                    console.log('Access granted, redirecting to dashboard')
                    navigate('/dashboard', { replace: true })
                    return
                  } else {
                    console.warn('No active access after confirmation:', data.access)
                  }
                }
              } else {
                const errorData = await resp.json().catch(() => ({}))
                console.error('Confirm session failed:', errorData)
              }
            } catch (e) {
              console.error('Confirm session error:', e)
            }
          }

          const tries = 15
          for (let i = 0; i < tries; i++) {
            try {
              const res = await fetch(`${API_BASE}/me?ts=${Date.now()}`, {
                credentials: 'include',
                cache: 'no-store',
                headers: { 'Content-Type': 'application/json', ...authHeaders() }
              })
              if (res.ok) {
                const data = await res.json()
                setUser(data.user || null)
                setAccess(data.access || null)
                if (data?.access?.has_active_access) {
                  navigate('/dashboard', { replace: true })
                  return
                }
              }
            } catch (e) {
              console.error('Poll error:', e)
            }
            await new Promise(r => setTimeout(r, 500))
          }

          setProcessing(false)
          setBanner({
            type: 'info',
            text: 'Your payment succeeded. We are finalizing your subscription. If you are not redirected automatically, please refresh this page in a few seconds.'
          })
        })()
    } else if (params.get('canceled') === '1') {
      setBanner({ type: 'warning', text: 'Checkout canceled. You can subscribe anytime to get access.' })
    } else {
      setBanner({ type: '', text: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const daysLeft = useMemo(() => {
    try {
      const end = access?.trial_ends_at ? new Date(access.trial_ends_at) : null
      if (!end) return null
      const now = new Date()
      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    } catch { return null }
  }, [access])

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include', headers: authHeaders() })
    } catch { }
    clearTokens()
    window.location.href = '/'
  }

  return (
    <AuthShell
      eyebrow="Continue learning"
      headline={<>Keep going. <span>You've got this.</span></>}
      subtitle="Subscribe to keep full access to your question bank, textbook and OSCE practice."
    >
      <div className="auth-panel">
        <div className="auth-sub__top">
          <div className="auth-panel__header">
            <h2 className="auth-panel__title">Continue your learning</h2>
            {daysLeft !== null && daysLeft > 0 && (
              <p className="auth-panel__desc">Your trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
            )}
          </div>
          {user && (
            <div className="auth-sub__user">
              <div className="auth-sub__user-label">Signed in as</div>
              <div className="auth-sub__user-name">{user.username || user.email}</div>
              <button type="button" onClick={handleLogout} className="auth-sub__signout">Sign out</button>
            </div>
          )}
        </div>

        {banner.text && (
          <div className={`auth-sub__banner${banner.type === 'success' ? ' auth-sub__banner--success' : banner.type === 'warning' ? ' auth-sub__banner--warning' : ''}`}>
            <div>
              <h3>
                {banner.type === 'success' ? 'Payment complete' : banner.type === 'warning' ? 'Checkout canceled' : 'Finalizing subscription'}
              </h3>
              <p>{banner.text}</p>
            </div>
            <button type="button" className="auth-sub__dismiss" onClick={() => setBanner({ type: '', text: '' })} aria-label="Dismiss">×</button>
          </div>
        )}

        <p className="auth-panel__desc">Subscribe now for £15 per 6 months. Cancel anytime.</p>

        {daysLeft !== null && (
          <div className="auth-sub__banner">
            <div>
              <h3>{daysLeft > 0 ? 'Your free trial is ending soon' : 'Your free trial has ended'}</h3>
              <p>
                {daysLeft > 0
                  ? `Subscribe now to continue learning after your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
                  : 'Subscribe now to regain access to all features and continue your learning journey.'}
              </p>
            </div>
          </div>
        )}

        <div className="auth__stats">
          <div className="auth__stat">
            <div className="auth__stat-number">£15</div>
            <div className="auth__stat-label">6 months</div>
          </div>
          <div className="auth__stat">
            <div className="auth__stat-number">15,000+</div>
            <div className="auth__stat-label">Questions</div>
          </div>
          <div className="auth__stat">
            <div className="auth__stat-number">Cancel</div>
            <div className="auth__stat-label">Anytime</div>
          </div>
        </div>

        <button
          className="auth-panel__cta"
          disabled={processing || access?.has_active_access}
          onClick={async () => {
            if (access?.has_active_access) {
              navigate('/dashboard', { replace: true })
              return
            }
            setProcessing(true)
            try {
              const trialDays = daysLeft && daysLeft > 0 ? daysLeft : 0

              const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json', ...authHeaders() },
                body: JSON.stringify({ trial_days: trialDays }),
              })
              if (!res.ok) {
                const txt = await res.text().catch(() => '')
                setBanner({ type: 'warning', text: txt || 'Could not start checkout. Please try again.' })
                return
              }
              const data = await res.json()
              if (data?.url) {
                window.open(data.url, '_blank', 'noopener,noreferrer');
                return
              }
              setBanner({ type: 'warning', text: 'Checkout URL not returned. Please try again.' })
            } catch {
              setBanner({ type: 'warning', text: 'Could not start checkout. Please try again.' })
            } finally {
              setProcessing(false)
            }
          }}
        >
          {processing ? 'Preparing checkout…' : access?.has_active_access ? 'Already subscribed' : 'Subscribe now'}
        </button>

        <p className="auth-sub__fine">Secure payments handled by Stripe. No commitment—cancel anytime.</p>

        <div className="auth-sub__list">
          <strong>What you get</strong>
          <ul>
            <li>Unlimited access to the full Question Bank and explanations</li>
            <li>Personalised analytics dashboard and study streak tracking</li>
            <li>Complete textbook with sections, visuals and citations</li>
          </ul>
        </div>
      </div>
    </AuthShell>
  )
}

export default Subscribe
