import React, { useState, useEffect, useCallback } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import { LuTriangleAlert, LuUsers, LuArmchair, LuActivity, LuTarget } from 'react-icons/lu'
import '../Dashboard.css'
import '../question-bank/QuestionBank.css'
import './Institution.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import InstitutionInvite from './InstitutionInvite'
import InstitutionRoster from './InstitutionRoster'
import InstitutionCohorts from './InstitutionCohorts'
import InstitutionDetails from './InstitutionDetails'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function StatCard({ icon, iconStyle, label, value, sub }) {
  return (
    <div className="qb-stat">
      <div className="qb-stat__top">
        <div className="qb-stat__title">{label}</div>
        <div className="qb-stat__icon" style={iconStyle}>
          {icon}
        </div>
      </div>
      <div className="qb-stat__value">{value}</div>
      <div className="qb-stat__sub">{sub}</div>
    </div>
  )
}

export default function InstitutionDashboard() {
  const { user } = useOutletContext() || {}
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [details, setDetails] = useState(null)
  const [cohorts, setCohorts] = useState([])
  const [unassigned, setUnassigned] = useState(0)
  const [cohortsLoading, setCohortsLoading] = useState(true)

  const billingRequired = searchParams.get('billing') === 'required'
  const isInstitutionAdmin = !!user?.capabilities?.is_institution_admin

  const loadOverview = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/institution/overview`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to load your institution')
        return
      }
      setOverview(await res.json())
    } catch {
      setError('Failed to load your institution')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Held here rather than in each card, so the invite form, the roster and the
   * year group card all read the same list. */
  const loadCohorts = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/institution/cohorts`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      setCohorts(body.cohorts || [])
      setUnassigned(body.unassigned_students || 0)
    } catch {
      // The cards fall back to "no year groups", which is recoverable.
    } finally {
      setCohortsLoading(false)
    }
  }, [])

  /** Contact email is not on /institution/overview, so the details card needs this. */
  const loadDetails = useCallback(async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/institution/me`, { cache: 'no-store' })
      if (!res.ok) return
      const body = await res.json()
      setDetails(body.institution || null)
    } catch {
      setDetails(null)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  useEffect(() => {
    if (isInstitutionAdmin) {
      loadOverview()
      loadCohorts()
      loadDetails()
    } else {
      setLoading(false)
      setCohortsLoading(false)
    }
  }, [isInstitutionAdmin, loadOverview, loadCohorts, loadDetails])

  /** Anything that changes the roster also changes the headline counts. */
  const handleChanged = useCallback(() => {
    setRefreshKey((k) => k + 1)
    loadOverview()
    loadCohorts()
  }, [loadOverview, loadCohorts])

  const handleDetailsSaved = useCallback(() => {
    loadDetails()
    loadOverview()
  }, [loadDetails, loadOverview])

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading your institution..." inline />
      </div>
    )
  }

  if (!isInstitutionAdmin) {
    return (
      <div className="qb">
        <h1 className="qb__title">Institution</h1>
        <p className="qb__subtitle">This area is only available to institution administrators.</p>
      </div>
    )
  }

  const institution = overview?.institution
  const seats = overview?.seats
  const students = overview?.students
  const engagement = overview?.engagement
  const performance = overview?.performance

  const seatsRemaining = seats?.limit === null || seats?.limit === undefined ? null : seats.limit - seats.used

  return (
    <div className="qb">
      <h1 className="qb__title">{institution?.name || 'Institution'}</h1>
      <p className="qb__subtitle">Manage your students and track their progress</p>

      {billingRequired && (
        <div className="inst-alert inst-alert--warning" role="alert">
          <LuTriangleAlert size={18} aria-hidden />
          <div>
            <strong>Subscription needs attention.</strong> Your institution&apos;s access is currently inactive, so your
            students cannot use the platform. Billing management is coming to this page shortly.
          </div>
        </div>
      )}

      {error && (
        <div className="inst-alert inst-alert--error" role="alert">
          <LuTriangleAlert size={18} aria-hidden />
          <div>{error}</div>
        </div>
      )}

      <div className="inst-stats">
        <StatCard
          icon={<LuUsers size={18} aria-hidden />}
          iconStyle={{ background: '#e0e7ff', border: '1px solid #a5b4fc', color: '#4f46e5' }}
          label="Active students"
          value={students?.active ?? 0}
          sub={
            students?.invited
              ? `${students.invited} still to set up their account`
              : 'Everyone invited has set up their account'
          }
        />
        <StatCard
          icon={<LuArmchair size={18} aria-hidden />}
          iconStyle={{ background: 'var(--surface-tint-gold)', border: '1px solid #ffe7cc', color: '#d97706' }}
          label="Seats used"
          value={seats?.limit ? `${seats.used} / ${seats.limit}` : (seats?.used ?? 0)}
          sub={seatsRemaining === null ? 'Unlimited seats' : `${seatsRemaining} remaining`}
        />
        <StatCard
          icon={<LuActivity size={18} aria-hidden />}
          iconStyle={{ background: '#dcfce7', border: '1px solid #86efac', color: '#16a34a' }}
          label="Active this week"
          value={engagement?.active_last_7_days ?? 0}
          sub={
            engagement?.never_started
              ? `${engagement.never_started} have never started`
              : 'Everyone has answered something'
          }
        />
        <StatCard
          icon={<LuTarget size={18} aria-hidden />}
          iconStyle={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#dc2626' }}
          label="Cohort accuracy"
          value={
            performance?.accuracy_pct === null || performance?.accuracy_pct === undefined
              ? '—'
              : `${performance.accuracy_pct}%`
          }
          sub={`${performance?.total_answered ?? 0} questions answered in total`}
        />
      </div>

      <InstitutionCohorts
        cohorts={cohorts}
        unassigned={unassigned}
        loading={cohortsLoading}
        onChanged={handleChanged}
      />

      <InstitutionInvite cohorts={cohorts} onInvited={handleChanged} />

      <InstitutionRoster cohorts={cohorts} refreshKey={refreshKey} onChanged={handleChanged} />

      <InstitutionDetails institution={details || institution} onSaved={handleDetailsSaved} />
    </div>
  )
}
