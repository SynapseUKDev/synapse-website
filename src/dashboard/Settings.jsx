import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext } from 'react-router-dom'
import { authHeaders } from '../auth/token'
import { LuUser, LuCreditCard, LuShield, LuCheck, LuX, LuTarget } from 'react-icons/lu'
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
  const [targets, setTargets] = useState({ questions: 30, time_minutes: 180 })
  const [savingTargets, setSavingTargets] = useState(false)
  const [targetMessage, setTargetMessage] = useState({ type: '', text: '' })
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
        setTargets({
          questions: data.user?.daily_question_target || 30,
          time_minutes: data.user?.daily_study_minutes_target || 180
        })
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

  const saveTargets = async (e) => {
    e?.preventDefault()
    setSavingTargets(true)
    setTargetMessage({ type: '', text: '' })
    try {
      const res = await fetch(`${API_BASE}/me/targets`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          daily_question_target: parseInt(targets.questions),
          daily_study_minutes_target: parseInt(targets.time_minutes)
        }),
      })
      if (res.ok) {
        setTargetMessage({ type: 'success', text: 'Study goals updated!' })
      } else {
        const json = await res.json().catch(() => ({}))
        setTargetMessage({ type: 'error', text: json?.error || 'Failed to save' })
      }
    } catch {
      setTargetMessage({ type: 'error', text: 'Failed to save' })
    } finally {
      setSavingTargets(false)
      setTimeout(() => setTargetMessage({ type: '', text: '' }), 3000)
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
  const hasStripeSubscription = accessData?.subscription_status === 'trialing' && !!accessData?.current_period_end && !accessData?.cancel_at_period_end
  const isCanceledPaidSub = accessData?.subscription_status === 'canceled' && !!accessData?.current_period_end
  const isBetaTester = accessData?.is_beta_tester && accessData?.beta_access_ends_at
  const canceledDuringTrial = accessData?.subscription_status === 'canceled' && !accessData?.last_payment_at

  return (
    <div className="qb">
      <h1 className="qb__title">Settings</h1>
      <p className="qb__subtitle">Manage your account and subscription</p>

      <div className="settings__grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 16 }}>
        {/* Profile card */}
        <div className="qb-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: '#ecfeff', border: '1.5px solid #0ea5e9', color: '#0ea5e9', borderRadius: '12px', boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)' }}>
                <LuUser size={20} />
              </div>
              <div>
                <div className="qb-card__title">Profile</div>
              </div>
            </div>
          </div>
          <form onSubmit={saveUsername} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
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
            </div>
            
            <div style={{ marginTop: 20 }}>
              <button type="submit" className="qb-btn qb-btn--sm" style={{ width: 'auto' }} disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saveMessage.text && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: saveMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {saveMessage.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
                  {saveMessage.text}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Study Goals card */}
        <div className="qb-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: '#f5f3ff', border: '1.5px solid #8b5cf6', color: '#8b5cf6', borderRadius: '12px', boxShadow: '0 2px 8px rgba(139, 92, 246, 0.15)' }}>
                <LuTarget size={20} />
              </div>
              <div>
                <div className="qb-card__title">Study Goals</div>
              </div>
            </div>
          </div>
          <form onSubmit={saveTargets} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="qb__subtitle" style={{ display: 'block', marginBottom: 6 }}>Daily Questions</label>
                  <input
                    type="number"
                    value={targets.questions}
                    onChange={(e) => setTargets({ ...targets, questions: e.target.value })}
                    placeholder="e.g. 30"
                    className="db-input"
                    style={{ width: '100%' }}
                    min="1"
                    max="1000"
                  />
                </div>
                <div>
                  <label className="qb__subtitle" style={{ display: 'block', marginBottom: 6 }}>Daily Minutes</label>
                  <input
                    type="number"
                    value={targets.time_minutes}
                    onChange={(e) => setTargets({ ...targets, time_minutes: e.target.value })}
                    placeholder="e.g. 180"
                    className="db-input"
                    style={{ width: '100%' }}
                    min="1"
                    max="1440"
                  />
                </div>
              </div>
              <p style={{ marginTop: 12, fontSize: 13, color: 'var(--syn-muted)', lineHeight: 1.5 }}>
                Set your personal daily targets to track your progress on the dashboard.
              </p>
            </div>
            
            <div style={{ marginTop: 20 }}>
              <button type="submit" className="qb-btn qb-btn--sm" style={{ width: 'auto' }} disabled={savingTargets}>
                {savingTargets ? 'Saving...' : 'Update Goals'}
              </button>
              {targetMessage.text && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: targetMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {targetMessage.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
                  {targetMessage.text}
                </div>
              )}
            </div>
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

            {isBetaTester && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>Beta Access Ends</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                    {formatDate(accessData.beta_access_ends_at)}
                  </div>
                </div>
              </>
            )}

            {hasStripeSubscription && !accessData?.cancel_at_period_end && (
              <>
                <div>
                  <div className="qb__subtitle" style={{ marginBottom: 4 }}>First Billing Date</div>
                  <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>{formatDate(accessData.current_period_end)}</div>
                </div>
                <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                  {portalLoading ? 'Opening...' : 'Manage Subscription'}
                </button>
              </>
            )}

            {isPaidSubscriber && !accessData?.cancel_at_period_end && (
              <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto' }} onClick={openBillingPortal} disabled={portalLoading}>
                {portalLoading ? 'Opening...' : 'Manage Subscription'}
              </button>
            )}

            {(isCanceledPaidSub || (isPaidSubscriber && accessData?.cancel_at_period_end)) && (
              <button className="qb-btn qb-btn--sm" style={{ marginTop: 8, width: 'auto', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', border: 'none', color: '#fff' }} onClick={openBillingPortal} disabled={portalLoading}>
                {portalLoading ? 'Opening...' : 'Reactivate Subscription'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
