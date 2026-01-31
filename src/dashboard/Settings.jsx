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
    } catch { }
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
      canceled: { label: 'Cancelled', color: '#64748b' },
      incomplete: { label: 'Incomplete', color: '#64748b' },
    }
    const s = map[status] || { label: status || 'Unknown', color: '#64748b' }
    return (
      <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: `${s.color}20`, color: s.color, fontWeight: 800, fontSize: 13 }}>
        {s.label}
      </span>
    )
  }



  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading settings..." inline />
      </div>
    )
  }

  const isPaidSubscriber = accessData?.subscription_status && ['active', 'past_due'].includes(accessData.subscription_status)

  // Stripe subscription with payment method (has period dates)
  const hasStripeSubscription = accessData?.subscription_status === 'trialing' && !!accessData?.current_period_end && !accessData?.cancel_at_period_end

  // Canceled paid subscription (has period dates)
  const isCanceledPaidSub = accessData?.subscription_status === 'canceled' && !!accessData?.current_period_end

  // Beta tester access
  const isBetaTester = accessData?.is_beta_tester && accessData?.beta_access_ends_at

  return (
    <div className="qb">
      <h1 className="qb__title">Settings</h1>
      <p className="qb__subtitle">Manage your account and subscription</p>

      <div className="settings__grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
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
              {isBetaTester ? (
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: '#fef3c7', color: '#92400e', fontWeight: 800, fontSize: 13 }}>
                  Beta Tester
                </span>
              ) : isCanceledPaidSub || accessData?.cancel_at_period_end ? (
                <span style={{ display: 'inline-block', padding: '4px 10px', borderRadius: 999, background: '#fee2e2', color: '#dc2626', fontWeight: 800, fontSize: 13 }}>
                  Cancelled
                </span>
              ) : hasStripeSubscription ? (
                statusBadge('trialing')
              ) : isPaidSubscriber ? (
                statusBadge(accessData.subscription_status)
              ) : (
                <span style={{ color: 'var(--syn-muted)' }}>No subscription</span>
              )}
            </div>

            {/* Beta tester access */}
            {isBetaTester && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Beta Access Ends</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.beta_access_ends_at)}
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
                    Thanks for being a beta tester!
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                    You have free access until your beta period ends. Subscribe anytime to continue after.
                  </div>
                </div>
              </>
            )}

            {/* Stripe trialing with payment method */}
            {hasStripeSubscription && !accessData?.cancel_at_period_end && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>First Billing Date</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.current_period_end)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>
                    Your trial is active until this date
                  </div>
                </div>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Subscription Amount</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>£15 per 6 months</div>
                  <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>Billing starts automatically on the date above</div>
                </div>
                <div style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
                  border: '2px solid #a7f3d0',
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#0e8a4b', marginBottom: 4 }}>
                    ✓ Payment method saved
                  </div>
                  <div style={{ fontSize: 13, color: '#059669', lineHeight: 1.5 }}>
                    Your subscription is set up! You can manage your payment method and cancel anytime.
                  </div>
                </div>
                <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {/* Stripe trial with cancellation scheduled */}
            {hasStripeSubscription && accessData?.cancel_at_period_end && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Access Until</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.current_period_end)}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>
                    Your subscription will end on this date
                  </div>
                </div>
                {/* <div style={{ 
                  padding: '12px 16px', 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  border: '2px solid #fcd34d', 
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Subscription Cancelled
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                    You cancelled your subscription. You'll have access until {formatDate(accessData.current_period_end)}, then it will end.
                  </div>
                </div> */}
                <button
                  className="qb-btn qb-btn--sm"
                  style={{
                    marginTop: 8,
                    width: 'auto',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Opening...' : 'Reactivate Subscription'}
                </button>
              </>
            )}

            {/* Active or past_due subscription */}
            {isPaidSubscriber && !accessData?.cancel_at_period_end && (
              <>
                {accessData?.current_period_end && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Next Billing Date</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                      {formatDate(accessData.current_period_end)}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>
                      £15 will be charged for the next 6 months
                    </div>
                  </div>
                )}
                {/* {accessData?.current_period_start && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Current Period Started</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_start)}</div>
                  </div>
                )} */}
                <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {/* Active subscription with cancellation scheduled */}
            {isPaidSubscriber && accessData?.cancel_at_period_end && (
              <>
                {accessData?.current_period_end && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Access Until</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_end)}</div>
                  </div>
                )}
                <div style={{
                  padding: '12px 16px',
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                  border: '2px solid #fcd34d',
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Subscription Cancelled
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                    Your subscription is cancelled and will not renew. You'll have access until {formatDate(accessData.current_period_end)}.
                  </div>
                </div>
                <button
                  className="qb-btn qb-btn--sm"
                  style={{
                    marginTop: 8,
                    width: 'auto',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Opening...' : 'Reactivate Subscription'}
                </button>
              </>
            )}

            {/* Canceled subscription (only show if NOT canceled during trial) */}
            {accessData?.subscription_status === 'canceled' && !canceledDuringTrial && (
              <>
                {accessData?.current_period_end && (
                  <div>
                    <div className="qb__subtitle" style={{ marginBottom: 4 }}>Access Until</div>
                    <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_end)}</div>
                    <div style={{ fontSize: 13, color: 'var(--syn-muted)', marginTop: 2 }}>
                      Your subscription has been canceled
                    </div>
                  </div>
                )}
                {/* <div style={{ 
                  padding: '12px 16px', 
                  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', 
                  border: '2px solid #fcd34d', 
                  borderRadius: 12,
                  marginTop: 4
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                    Subscription Cancelled
                  </div>
                  <div style={{ fontSize: 13, color: '#b45309', lineHeight: 1.5 }}>
                    {accessData?.current_period_end 
                      ? `You'll have access until ${formatDate(accessData.current_period_end)}, then it will end.`
                      : 'Your subscription has ended.'
                    }
                  </div>
                </div> */}
                <button
                  className="qb-btn qb-btn--sm"
                  style={{
                    marginTop: 8,
                    width: 'auto',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                  onClick={openBillingPortal}
                  disabled={portalLoading}
                >
                  {portalLoading ? 'Opening...' : 'Reactivate Subscription'}
                </button>
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

