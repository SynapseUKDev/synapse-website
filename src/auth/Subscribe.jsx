import React, { useMemo, useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import './Auth.css'
import logo from '../assets/logo/logo.png'
import '../dashboard/question-bank/QuestionBank.css'
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
    } catch {}
  }, [API_BASE, navigate])

  useEffect(() => { fetchMe() }, [fetchMe])

  // Handle success/canceled return from Stripe Checkout
  useEffect(() => {
    const params = new URLSearchParams(location.search || '')
    if (params.get('success') === '1') {
      setBanner({ type: 'success', text: 'Payment complete. Finalizing your subscription…' })
      ;(async () => {
        setProcessing(true)
        const sessionId = params.get('session_id')
        
        // First, immediately call confirm-session to ensure subscription is recorded
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
              // Immediately check access after confirmation
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
        
        // Poll for subscription status (faster polling)
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
      setBanner({ type: 'warning', text: 'Checkout canceled. You can restart your free trial anytime.' })
    } else {
      setBanner({ type: '', text: '' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search])

  const benefits = useMemo(() => ([
    { title: 'Full Question Bank', desc: '5,000+ exam-style questions with detailed explanations', icon: 'book', bg: 'var(--surface-tint-cyan)', border: '#b6f6fc', color: 'var(--syn-navy-700)' },
    { title: 'Smart Analytics', desc: 'Track progress, identify weak areas, and improve faster', icon: 'activity', bg: 'var(--surface-tint-gold)', border: '#ffe7cc', color: '#a15d00' },
    { title: 'Textbook Access', desc: 'Curated high-yield content aligned to UKMLA topics', icon: 'file', bg: 'var(--surface-tint-purple)', border: '#e6d6ff', color: '#5b23a6' },
    { title: 'Visual Learning', desc: 'Diagrams, tables, and illustrations to solidify concepts', icon: 'image', bg: 'var(--surface-tint-green)', border: '#cbf6da', color: '#0e8a4b' },
  ]), [])

  const renderIcon = (name) => {
    switch (name) {
      case 'book':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 4h7a3 3 0 0 1 3 3v13a3 3 0 0 0-3-3H2z"/>
            <path d="M22 4h-7a3 3 0 0 0-3 3v13a3 3 0 0 1 3-3h7z"/>
          </svg>
        )
      case 'activity':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h4l3 8 4-16 3 8h4"/>
          </svg>
        )
      case 'file':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="M16 13H8"/>
            <path d="M16 17H8"/>
          </svg>
        )
      case 'image':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <path d="M21 15l-5-5L5 21"/>
          </svg>
        )
      default:
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/></svg>
        )
    }
  }

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
    } catch {}
    clearTokens()
    window.location.href = '/'
  }

  return (
    <section className="auth" style={{ color: 'var(--syn-navy-700)' }}>
      <div className="auth__split auth__split--left">
        <div style={{ width: '100%', display: 'grid', placeItems: 'center', padding: '24px 0' }}>
          <div className="auth__panel" style={{ maxWidth: 520, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <h2 className="auth__headline" style={{ fontSize: 30, margin: 0 }}>Continue your learning journey</h2>
                {daysLeft !== null && daysLeft > 0 && (
                  <div style={{ fontSize: 14, color: 'var(--syn-muted)', marginTop: 4 }}>
                    Your trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              {user && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--syn-muted)' }}>Signed in as</div>
                  <div style={{ fontWeight: 800 }}>{user.username || user.email}</div>
                  <button onClick={handleLogout} className="qb-btn qb-btn--sm" style={{ marginTop: 6, background: '#fff', color: 'var(--syn-navy-700)', border: '1px solid var(--syn-border)', boxShadow: 'none' }}>Sign out</button>
                </div>
              )}
            </div>
            {banner.text && (() => {
              const theme = (t) => {
                if (t === 'success') return { bg: 'var(--surface-tint-green)', border: '#a7f3d0', accent: '#059669', iconBg: '#ecfdf5', iconBorder: '#a7f3d0', title: 'Payment complete' }
                if (t === 'warning') return { bg: 'var(--surface-tint-gold)', border: '#ffe7cc', accent: '#a15d00', iconBg: '#fff7ed', iconBorder: '#ffe7cc', title: 'Checkout canceled' }
                return { bg: 'var(--surface-tint-cyan)', border: '#b6f6fc', accent: '#0ea5b5', iconBg: '#e6fffb', iconBorder: '#b6f6fc', title: 'Finalizing subscription' }
              }
              const th = theme(banner.type)
              const icon = banner.type === 'success'
                ? (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>)
                : banner.type === 'warning'
                ? (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>)
                : (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>)
              return (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  marginBottom: 14,
                  border: `1px solid ${th.border}`,
                  borderRadius: 14,
                  padding: 12,
                  background: th.bg,
                  boxShadow: '0 8px 24px rgba(11,22,55,0.06)'
                }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: th.iconBg, border: `1px solid ${th.iconBorder}`, color: th.accent, display: 'grid', placeItems: 'center' }}>
                    {icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, color: th.accent, marginBottom: 2 }}>{th.title}</div>
                    <div style={{ color: 'var(--syn-navy-700)', lineHeight: 1.5 }}>{banner.text}</div>
                  </div>
                  <button onClick={() => setBanner({ type: '', text: '' })} aria-label="Dismiss" style={{ background: 'transparent', border: 0, color: '#64748b', cursor: 'pointer' }}>×</button>
                </div>
              )
            })()}

            <p className="auth__subtitle" style={{ marginBottom: 18, color: 'var(--syn-muted)' }}>
              Subscribe now for £15 per 6 months. Cancel anytime.
            </p>

            {daysLeft !== null && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                marginBottom: 16,
                border: '1px solid #b6f6fc',
                borderRadius: 14,
                padding: 14,
                background: 'var(--surface-tint-cyan)',
              }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: '#e6fffb', border: '1px solid #b6f6fc', color: '#0ea5b5', display: 'grid', placeItems: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 16v-4m0-4h.01"/>
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, color: '#0ea5b5', marginBottom: 4 }}>
                    {daysLeft > 0 ? 'Your free trial is ending soon' : 'Your free trial has ended'}
                  </div>
                  <div style={{ color: 'var(--syn-navy-700)', lineHeight: 1.5, fontSize: 14 }}>
                    {daysLeft > 0 
                      ? `Subscribe now to continue learning after your trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}.`
                      : 'Subscribe now to regain access to all features and continue your learning journey.'
                    }
                  </div>
                </div>
              </div>
            )}

            <div className="auth__stats" style={{ marginBottom: 16 }}>
              <div className="auth__stat">
                <div className="auth__stat-icon auth__stat-icon--green">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                </div>
                <div className="auth__stat-content">
                  <div className="auth__stat-number">£15</div>
                  <div className="auth__stat-label">6 months</div>
                </div>
              </div>
              <div className="auth__stat">
                <div className="auth__stat-icon auth__stat-icon--purple">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                </div>
                <div className="auth__stat-content">
                  <div className="auth__stat-number">1,000+</div>
                  <div className="auth__stat-label">Active students</div>
                </div>
              </div>
              <div className="auth__stat">
                <div className="auth__stat-icon auth__stat-icon--orange">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 11l3 3l8-8"/><path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02"/></svg>
                </div>
                <div className="auth__stat-content">
                  <div className="auth__stat-number">Cancel</div>
                  <div className="auth__stat-label">Anytime</div>
                </div>
              </div>
            </div>

            <button
              className="qb-btn"
              style={{ width: '100%', marginTop: 8 }}
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
                } catch (e) {
                  setBanner({ type: 'warning', text: 'Could not start checkout. Please try again.' })
                } finally {
                  setProcessing(false)
                }
              }}
            >
              {processing ? 'Preparing checkout…' : access?.has_active_access ? 'Already subscribed' : 'Subscribe now'}
            </button>

            <p style={{ marginTop: 12, fontSize: 12, opacity: 0.8, textAlign: 'center', color: 'var(--syn-muted)' }}>
              Secure payments handled by Stripe. No commitment—cancel anytime.
            </p>

            <div style={{ marginTop: 20, background: 'var(--surface-card)', border: '1px solid var(--syn-border)', borderRadius: 16, padding: 16 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>What you get</div>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.6, color: 'var(--syn-navy-700)' }}>
                <li>Unlimited access to the full Question Bank and explanations</li>
                <li>Personalised analytics dashboard and study streak tracking</li>
                <li>Complete textbook with sections, visuals and citations</li>
                <li>Email support and continual new content updates</li>
              </ul>
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
              Elevate your <span className="auth__gradient-text">Medical Mastery</span>
            </h1>
            <p className="auth__subtitle">
              Everything you need to prepare with confidence: high-yield questions, rich explanations,
              and a modern textbook—crafted for UK medical students.
            </p>
          </div>

          <div className="auth__features">
            {benefits.map((b, i) => (
              <div key={i} className="auth__feature">
                <div className="auth__feature-icon" style={{ width: 36, height: 36, borderRadius: 10, background: b.bg, border: `1px solid ${b.border}`, color: b.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {renderIcon(b.icon)}
                </div>
                <div className="auth__feature-text">
                  <div className="auth__feature-title">{b.title}</div>
                  <div className="auth__feature-desc">{b.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default Subscribe


