import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { authHeaders, clearTokens } from '../auth/token'
import { LuUser, LuCreditCard, LuCheck, LuX, LuTarget, LuSun, LuMoon, LuTrash2, LuLoader, LuTrophy } from 'react-icons/lu'
import { getStoredPreference, setPreference } from '../theme'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import LoadingScreen from '../components/loading/LoadingScreen'

export default function Settings() {
  const { user } = useOutletContext()
  const navigate = useNavigate()
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
  const [appearance, setAppearance] = useState(() => getStoredPreference())
  const [yearGroup, setYearGroup] = useState('')
  const [savingYearGroup, setSavingYearGroup] = useState(false)
  const [yearGroupMessage, setYearGroupMessage] = useState({ type: '', text: '' })
  const [anonymise, setAnonymise] = useState(false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [privacyMessage, setPrivacyMessage] = useState({ type: '', text: '' })
  const [institution, setInstitution] = useState(null)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteUnderstand, setDeleteUnderstand] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!deleteModalOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [deleteModalOpen])

  const handleDeleteAccount = async (e) => {
    e?.preventDefault()
    if (deleteConfirmText.toLowerCase() !== 'delete my account' || !deleteUnderstand || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const res = await fetch(`${API_BASE}/me`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { ...authHeaders() }
      })
      if (res.ok) {
        clearTokens()
        window.dispatchEvent(new Event('auth:changed'))
        setDeleteModalOpen(false)
        navigate('/', { replace: true })
      } else {
        const json = await res.json().catch(() => ({}))
        setDeleteError(json?.error || 'Failed to delete account. Please try again.')
        setDeleting(false)
      }
    } catch (err) {
      console.error(err)
      setDeleteError('A connection error occurred. Please check your internet and try again.')
      setDeleting(false)
    }
  }

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
        setYearGroup(data.user?.year_group || '')
        setAnonymise(!!data.user?.anonymise_in_leaderboards)
        setInstitution(data.institution || null)
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

  const saveYearGroup = async (e) => {
    e?.preventDefault()
    setSavingYearGroup(true)
    setYearGroupMessage({ type: '', text: '' })
    try {
      const trimmed = yearGroup.trim()
      const res = await fetch(`${API_BASE}/me/year-group`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ year_group: trimmed === '' ? null : trimmed }),
      })
      if (res.ok) {
        setYearGroupMessage({ type: 'success', text: 'Year group updated!' })
        window.dispatchEvent(new Event('auth:changed'))
      } else {
        const json = await res.json().catch(() => ({}))
        setYearGroupMessage({ type: 'error', text: json?.error || 'Failed to save' })
      }
    } catch {
      setYearGroupMessage({ type: 'error', text: 'Failed to save' })
    } finally {
      setSavingYearGroup(false)
      setTimeout(() => setYearGroupMessage({ type: '', text: '' }), 3000)
    }
  }

  /** Saves immediately on toggle, and reverts the switch if the request fails. */
  const savePrivacy = async (next) => {
    setAnonymise(next)
    setSavingPrivacy(true)
    setPrivacyMessage({ type: '', text: '' })
    try {
      const res = await fetch(`${API_BASE}/me/privacy`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ anonymise_in_leaderboards: next }),
      })
      if (res.ok) {
        setPrivacyMessage({ type: 'success', text: next ? 'Your name is now hidden.' : 'Your name is now visible.' })
      } else {
        const json = await res.json().catch(() => ({}))
        setAnonymise(!next)
        setPrivacyMessage({ type: 'error', text: json?.error || 'Failed to save' })
      }
    } catch {
      setAnonymise(!next)
      setPrivacyMessage({ type: 'error', text: 'Failed to save' })
    } finally {
      setSavingPrivacy(false)
      setTimeout(() => setPrivacyMessage({ type: '', text: '' }), 3000)
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
      free_trial: { label: 'Free Trial', color: '#3b82f6' },
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
  const freeTrialEndsAt = accessData?.trial_ends_at ? new Date(accessData.trial_ends_at) : null
  const isFreeTrial = !!freeTrialEndsAt && freeTrialEndsAt > new Date()
    && !isPaidSubscriber && !hasStripeSubscription && !isCanceledPaidSub

  return (
    <div className="qb">
      <h1 className="qb__title">Settings</h1>
      <p className="qb__subtitle">Manage your account and subscription</p>

      <div className="qb-card" style={{ marginTop: 16 }}>
        <div className="qb-card__head">
          <div className="qb-card__titlewrap">
            <div className="qb-card__icon" style={{ background: 'var(--surface-tint-blue)', border: '1px solid var(--syn-border)', color: '#3b82f6', borderRadius: '12px' }}>
              <LuMoon size={20} />
            </div>
            <div>
              <div className="qb-card__title">Appearance</div>
              <div className="qb-card__meta" style={{ marginTop: 4 }}>Light or dark</div>
            </div>
          </div>
        </div>
        <div className="settings-appearance__options" role="group" aria-label="Color theme">
          {[
            { id: 'light', label: 'Light', Icon: LuSun },
            { id: 'dark', label: 'Dark', Icon: LuMoon },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              className={`settings-appearance__btn ${appearance === id ? 'is-active' : ''}`}
              onClick={() => {
                setPreference(id)
                setAppearance(id)
              }}
            >
              <Icon size={18} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>

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
                className="db-input settings__input--disabled"
                style={{ width: '100%', cursor: 'not-allowed', opacity: 0.92 }}
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

        {/* Leaderboards card */}
        <div className="qb-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: '#f0fdf4', border: '1.5px solid #10b981', color: '#10b981', borderRadius: '12px', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.15)' }}>
                <LuTrophy size={20} />
              </div>
              <div>
                <div className="qb-card__title">Leaderboards</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', height: '100%' }}>
            {institution ? (
              /* Institution students are assigned a year group by their institution,
                 so this is shown rather than offered as an editable field. */
              <div>
                <label className="qb__subtitle" style={{ display: 'block', marginBottom: 6 }}>Year group</label>
                <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)', fontSize: 15 }}>
                  {institution.cohort_name || 'Not assigned yet'}
                </div>
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--syn-muted)', lineHeight: 1.5 }}>
                  {institution.cohort_name
                    ? `Set by ${institution.name}, and used to compare you with students in the same year.`
                    : `${institution.name} has not assigned you to a year group yet, so you can only be compared with the whole institution.`}
                </p>
              </div>
            ) : (
              <form onSubmit={saveYearGroup}>
                <label className="qb__subtitle" style={{ display: 'block', marginBottom: 6 }}>Year group</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={yearGroup}
                    onChange={(e) => setYearGroup(e.target.value)}
                    placeholder="e.g. 4"
                    className="db-input"
                    style={{ flex: 1 }}
                    maxLength={50}
                  />
                  <button type="submit" className="qb-btn qb-btn--sm" style={{ width: 'auto' }} disabled={savingYearGroup}>
                    {savingYearGroup ? 'Saving...' : 'Save'}
                  </button>
                </div>
                <p style={{ marginTop: 8, fontSize: 13, color: 'var(--syn-muted)', lineHeight: 1.5 }}>
                  Used to compare you with students in the same year at your university. Leave blank to opt out of year
                  filtering.
                </p>
                {yearGroupMessage.text && (
                  <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: yearGroupMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                    {yearGroupMessage.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
                    {yearGroupMessage.text}
                  </div>
                )}
              </form>
            )}

            <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--syn-border)', flex: 1 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: savingPrivacy ? 'progress' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={anonymise}
                  disabled={savingPrivacy}
                  onChange={(e) => savePrivacy(e.target.checked)}
                  style={{ marginTop: 3, width: 16, height: 16, flex: 'none', cursor: 'inherit' }}
                />
                <span>
                  <span style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>Hide my name from other students</span>
                  <span style={{ display: 'block', marginTop: 4, fontSize: 13, color: 'var(--syn-muted)', lineHeight: 1.5 }}>
                    You'll appear as an anonymous student
                    {institution?.name ? ` on the ${institution.name} leaderboard` : ' on leaderboards'}. Your stats
                    still count, and staff at your institution can always see your name.
                  </span>
                </span>
              </label>
              {privacyMessage.text && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, color: privacyMessage.type === 'success' ? '#10b981' : '#ef4444', fontSize: 13, fontWeight: 600 }}>
                  {privacyMessage.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
                  {privacyMessage.text}
                </div>
              )}
            </div>
          </div>
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
              ) : isFreeTrial ? (
                statusBadge('free_trial')
              ) : (
                <span style={{ color: 'var(--syn-muted)' }}>No subscription</span>
              )}
            </div>

            {isFreeTrial && (
              <div>
                <div className="qb__subtitle" style={{ marginBottom: 4 }}>Free Access Ends</div>
                <div style={{ fontWeight: 800, color: 'var(--syn-navy-700)' }}>
                  {formatDate(accessData.trial_ends_at)}
                </div>
              </div>
            )}

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

        {/* Delete Account (Danger Zone) card */}
        <div className="qb-card settings-danger-card">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon settings-danger-icon">
                <LuTrash2 size={20} />
              </div>
              <div>
                <div className="qb-card__title">Delete Account</div>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            <p style={{ fontSize: 13, color: 'var(--syn-muted)', lineHeight: 1.5, flex: 1, marginTop: -5 }}>
              Permanently delete your account and all associated data, including progress history, subscription details, and mock attempts. This action is irreversible.
            </p>
            <div>
              <button
                type="button"
                className="qb-btn qb-btn--sm qb-btn--danger"
                style={{ marginTop: 8, width: 'auto' }}
                onClick={() => {
                  setDeleteConfirmText('')
                  setDeleteUnderstand(false)
                  setDeleteError('')
                  setDeleteModalOpen(true)
                }}
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal */}
      {deleteModalOpen && (
        <div className="delete-confirm-overlay">
          <div className="delete-confirm-backdrop" onClick={() => !deleting && setDeleteModalOpen(false)} />
          <div className="delete-confirm-container">
            <div className="delete-confirm-card">
              <div className="delete-confirm-icon-wrapper">
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h2 className="delete-confirm-title">Permanently Delete Account?</h2>

              <p className="delete-confirm-text">
                This action is <strong>irreversible</strong> and will permanently wipe:
                <span style={{ display: 'block', margin: '8px 0 0 12px', lineHeight: '1.6' }}>
                  • Your user profile and login credentials<br />
                  • Active Stripe subscriptions (billing will cease)<br />
                  • Question attempts, reading history, & progress stats<br />
                  • Highlights, study sets, & exam mock attempts
                </span>
              </p>

              <form onSubmit={handleDeleteAccount} className="delete-confirm-form">
                {deleteError && (
                  <div className="consent-modal-error-box" style={{ margin: '0 0 4px 0' }}>
                    <span>{deleteError}</span>
                  </div>
                )}

                <div className="delete-confirm-field">
                  <label className="delete-confirm-input-label">
                    To confirm, type <strong>delete my account</strong> below:
                  </label>
                  <input
                    type="text"
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="delete my account"
                    className="delete-confirm-input"
                    disabled={deleting}
                    autoFocus
                  />
                </div>

                <label className={`delete-confirm-checkbox-label ${deleteUnderstand ? 'is-checked' : ''}`}>
                  <div className="delete-confirm-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={deleteUnderstand}
                      onChange={(e) => setDeleteUnderstand(e.target.checked)}
                      disabled={deleting}
                      className="delete-confirm-hidden-checkbox"
                    />
                    <div className="delete-confirm-custom-checkbox">
                      {deleteUnderstand && (
                        <svg className="delete-confirm-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="delete-confirm-checkbox-text">
                    I understand that my subscriptions will be cancelled immediately and all my data will be permanently deleted.
                  </span>
                </label>

                <div className="delete-confirm-actions">
                  <button
                    type="button"
                    onClick={() => setDeleteModalOpen(false)}
                    disabled={deleting}
                    className="delete-confirm-btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={deleteConfirmText.toLowerCase() !== 'delete my account' || !deleteUnderstand || deleting}
                    className="delete-confirm-btn-danger"
                  >
                    {deleting ? (
                      <>
                        <LuLoader className="consent-modal-spinner" size={16} />
                        Deleting...
                      </>
                    ) : (
                      'Delete Account'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
