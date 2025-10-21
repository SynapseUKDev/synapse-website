import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { authHeaders } from '../auth/token'
import { LuUser, LuCreditCard, LuShield, LuCheck, LuX } from 'react-icons/lu'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import LoadingScreen from '../components/loading/LoadingScreen'

export default function Settings() {
  const { user } = useOutletContext()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  
  const [loading, setLoading] = useState(true)
  const [accessData, setAccessData] = useState(null)
  const [username, setUsername] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' })
  const [portalLoading, setPortalLoading] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (res.ok) {
        const data = await res.json()
        setAccessData(data.access || null)
        setUsername(data.user?.username || '')
      }
    } catch {}
    finally { setLoading(false) }
  }, [API_BASE])

  useEffect(() => { fetchData() }, [fetchData])

  const saveUsername = async (e) => {
    e?.preventDefault()
    if (!username.trim()) return
    setSaving(true)
    setSaveMessage({ type: '', text: '' })
    try {
      const res = await fetch(`${API_BASE}/me/username`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ username: username.trim() }),
      })
      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Username updated!' })
        window.dispatchEvent(new Event('auth:changed'))
      } else {
        const json = await res.json().catch(() => ({}))
        setSaveMessage({ type: 'error', text: json?.error || 'Failed to save' })
      }
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save' })
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMessage({ type: '', text: '' }), 3000)
    }
  }

  const openBillingPortal = async () => {
    setPortalLoading(true)
    try {
      const res = await fetch(`${API_BASE}/billing/create-portal-session`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.url) {
          window.open(data.url, '_blank', 'noopener,noreferrer');
          setPortalLoading(false)
        }
      } else {
        alert('Failed to open billing portal. Please try again.')
        setPortalLoading(false)
      }
    } catch (e) {
      console.error('Error opening billing portal:', e)
      alert('Failed to open billing portal. Please try again.')
      setPortalLoading(false)
    }
  }

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
    } catch { return '—' }
  }

  const statusBadge = (status) => {
    const map = {
      active: { label: 'Active', color: '#10b981' },
      trialing: { label: 'Trialing', color: '#3b82f6' },
      past_due: { label: 'Past Due', color: '#f59e0b' },
      canceled: { label: 'Canceled', color: '#64748b' },
      incomplete: { label: 'Incomplete', color: '#64748b' },
    }
    const s = map[status] || { label: status || 'Unknown', color: '#64748b' }
    return (
      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: `${s.color}20`, color: s.color, fontWeight: 800, fontSize: 13 }}>
        {s.label}
      </span>
    )
  }

  const trialDaysLeft = () => {
    try {
      if (!accessData?.trial_ends_at) return null
      const end = new Date(accessData.trial_ends_at)
      const now = new Date()
      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return diff > 0 ? diff : 0
    } catch { return null }
  }

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading settings..." inline />
      </div>
    )
  }

  const daysLeft = trialDaysLeft()
  
  // Check if user is in free trial without payment method
  // Free trial users have subscription_status='trialing' but no current_period_start (billing not set up)
  const isFreeTrial = accessData?.subscription_status === 'trialing' && !accessData?.current_period_start && accessData?.trial_ends_at
  // Users with Stripe subscription (trialing) have current_period_start set (billing is scheduled to start)
  const hasStripeSubscription = accessData?.subscription_status === 'trialing' && !!accessData?.current_period_start
  // Active paid subscribers
  const isPaidSubscriber = accessData?.subscription_status && ['active', 'past_due'].includes(accessData.subscription_status)
  // Check if trial has expired
  const trialExpired = isFreeTrial && daysLeft === 0
  
  return (
    <div className="qb">
      <h1 className="qb__title">Settings</h1>
      <p className="qb__subtitle">Manage your account and subscription</p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
        {/* Profile card */}
        <div className="qb-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: 'var(--surface-tint-cyan)', border: '1px solid #b6f6fc', color: '#0ea5b5', borderRadius: '12px' }}>
                <LuUser size={20} />
              </div>
              <div>
                <div className="qb-card__title">Profile</div>
              </div>
            </div>
          </div>
          <form onSubmit={saveUsername} style={{ marginTop: 16 }}>
            <label className="qb__subtitle" style={{ display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="db-input"
              style={{ width: '100%', background: '#f1f5f9', cursor: 'not-allowed' }}
            />
            <label className="qb__subtitle" style={{ display: 'block', marginTop: 12, marginBottom: 6 }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              className="db-input"
              style={{ width: '100%' }}
            />
            <button type="submit" className="qb-btn qb-btn--sm" style={{ marginTop: 12, width: 'auto' }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            {saveMessage.text && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: saveMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 14 }}>
                {saveMessage.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
                {saveMessage.text}
              </div>
            )}
          </form>
        </div>

        {/* Subscription card */}
        <div className="qb-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: 'var(--surface-tint-gold)', border: '1px solid #ffe7cc', color: '#a15d00', borderRadius: '12px' }}>
                <LuCreditCard size={20} />
              </div>
              <div>
                <div className="qb-card__title">Subscription</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <div className="qb__subtitle" style={{ marginBottom: 4 }}>Status</div>
              {isFreeTrial ? (
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: '#dbeafe', color: '#1e40af', fontWeight: 800, fontSize: 13 }}>
                  Free Trial
                </span>
              ) : hasStripeSubscription ? (
                statusBadge('trialing')
              ) : isPaidSubscriber ? (
                statusBadge(accessData.subscription_status)
              ) : accessData?.subscription_status === 'canceled' ? (
                statusBadge('canceled')
              ) : (
                <span style={{ color: 'var(--syn-muted)' }}>No subscription</span>
              )}
            </div>
            
            {/* Free trial without Stripe subscription */}
            {isFreeTrial && daysLeft !== null && daysLeft > 0 && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Trial Ends</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.trial_ends_at)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--syn-muted)', marginLeft: 6 }}>
                      ({daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining)
                    </span>
                  </div>
                </div>
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)', 
                  border: '2px solid #a7f3d0', 
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0e8a4b', marginBottom: 4 }}>
                    Enjoying your trial?
                  </div>
                  <div style={{ fontSize: 13, color: '#059669', lineHeight: 1.5 }}>
                    Subscribe now to continue learning after your trial ends. Just £15 for 6 months!
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    setPortalLoading(true)
                    try {
                      const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...authHeaders() },
                        body: JSON.stringify({ trial_days: daysLeft || 0 })
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data?.url) {
                          window.location.href = data.url
                        } else {
                          alert('Could not start checkout. Please try again.')
                        }
                      } else {
                        alert('Could not start checkout. Please try again.')
                      }
                    } catch (e) {
                      console.error('Error creating checkout session:', e)
                      alert('Could not start checkout. Please try again.')
                    } finally {
                      setPortalLoading(false)
                    }
                  }}
                  className="qb-btn qb-btn--sm" 
                  style={{ 
                    marginTop: 8, 
                    width: 'auto',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Opening checkout...' : 'Subscribe Now – £15/6mo →'}
                </button>
              </>
            )}

            {/* Trial ended without subscription */}
            {isFreeTrial && daysLeft !== null && daysLeft === 0 && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Trial Ended</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.trial_ends_at)}
                  </div>
                </div>
                <div style={{ 
                  padding: '12px 16px', 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  border: '2px solid #fcd34d', 
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Your trial has ended
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                    Subscribe to regain access to all features and continue your learning journey.
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    setPortalLoading(true)
                    try {
                      const res = await fetch(`${API_BASE}/billing/create-checkout-session`, {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json', ...authHeaders() },
                        body: JSON.stringify({ trial_days: 0 })
                      })
                      if (res.ok) {
                        const data = await res.json()
                        if (data?.url) {
                          window.location.href = data.url
                        } else {
                          alert('Could not start checkout. Please try again.')
                        }
                      } else {
                        alert('Could not start checkout. Please try again.')
                      }
                    } catch (e) {
                      console.error('Error creating checkout session:', e)
                      alert('Could not start checkout. Please try again.')
                    } finally {
                      setPortalLoading(false)
                    }
                  }}
                  className="qb-btn qb-btn--sm" 
                  style={{ 
                    marginTop: 8, 
                    width: 'auto',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Opening checkout...' : 'Subscribe Now – £15/6mo →'}
                </button>
              </>
            )}

            {/* Stripe trialing with payment method */}
            {hasStripeSubscription && daysLeft !== null && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Trial Ends</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.trial_ends_at)}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--syn-muted)', marginLeft: 6 }}>
                      ({daysLeft} day{daysLeft !== 1 ? 's' : ''} left)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Then</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>£15 per 6 months</div>
                  <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>Billing starts automatically</div>
                </div>
                <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {/* Active or past_due subscription */}
            {isPaidSubscriber && (
              <>
                {accessData?.current_period_start && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Billing Started</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_start)}</div>
                  </div>
                )}
                {accessData?.current_period_end && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Current Period Ends</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_end)}</div>
                  </div>
                )}
                <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {/* Canceled subscription */}
            {accessData?.subscription_status === 'canceled' && (
              <>
                {accessData?.current_period_end && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Access Until</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_end)}</div>
                  </div>
                )}
                <a 
                  href="/subscribe" 
                  className="qb-btn qb-btn--sm" 
                  style={{ 
                    marginTop: 8, 
                    width: 'auto',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  Resubscribe
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Security section (future expansion) */}
      {/* <div className="qb-card" style={{ marginTop: 18 }}>
        <div className="qb-card__head">
          <div className="qb-card__titlewrap">
            <div className="qb-card__icon" style={{ background: 'var(--surface-tint-purple)', border: '1px solid #e6d6ff', color: '#5b23a6' }}>
              <LuShield size={20} />
            </div>
            <div>
              <div className="qb-card__title">Security</div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16 }}>
          <p className="qb__subtitle">Password management and two-factor authentication coming soon.</p>
        </div>
      </div> */}
    </div>
  )
}

