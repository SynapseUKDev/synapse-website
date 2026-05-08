import React, { useEffect, useState } from 'react'
import { useParams, useNavigate, useOutletContext } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import { LuChevronLeft, LuUsers, LuUser, LuClock, LuStethoscope, LuClipboardList, LuEye, LuPencil } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TYPE_LABELS = {
  history_taking: 'History Taking',
  examination: 'Examination',
  communication: 'Communication',
  procedural: 'Procedural',
  emergency: 'Emergency',
  data_interpretation: 'Data Interpretation',
  prescribing: 'Prescribing',
  documentation: 'Documentation',
  paeds_obs_gynae: 'Paeds / Obs & Gynae',
}

export default function OsceStationLanding() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin

  const [station, setStation] = useState(null)
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadStation()
  }, [slug])

  async function loadStation() {
    try {
      setLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/osce/stations/${slug}`)
      if (!res.ok) {
        navigate('/dashboard/osce')
        return
      }
      const data = await res.json()
      setStation(data.station)
      setSections(data.sections || [])
    } catch (e) {
      console.error('Failed to load station:', e)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="osce-station">
        <LoadingScreen message="Loading station info..." inline />
      </div>
    )
  }

  if (!station) {
    return (
      <div className="osce-station">
        <div className="osce__empty">Station not found.</div>
      </div>
    )
  }

  // Determine available roles based on sections
  // A role is available if at least one section has that role in visible_to
  const availableRoles = new Set()
  sections.forEach(s => {
    if (s.visible_to) {
      s.visible_to.forEach(r => availableRoles.add(r))
    }
  })

  // Mark scheme exists if there's any domains (which the API returns, but we didn't fetch them specifically here, wait we did fetch them in the endpoint)
  // The API returns domains, items, etc. If it has examiner instructions or domains, examiner role makes sense.
  // We'll just rely on `visible_to` containing 'examiner' or assume Examiner is always an option since they need to score.
  // Actually, we can just allow Examiner always because they need to score the candidate.
  // Patient is only available if there are sections explicitly for the patient (e.g. Patient Script).
  const hasPatientRole = availableRoles.has('patient')

  return (
    <div className="osce-group osce-group--full">
      <div className="osce-group__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <button className="osce-station__back" onClick={() => navigate('/dashboard/osce')}>
              <LuChevronLeft size={16} /> Back to OSCE Stations
            </button>
            <h1 className="osce-group__page-title">{station.title}</h1>
          </div>
          {isAdmin && (
            <button 
              className="osce-btn osce-btn--secondary osce-btn--sm" 
              onClick={() => navigate(`/dashboard/admin/osce/station/${station.id}`)}
              style={{ marginTop: 8 }}
            >
              <LuPencil size={16} /> Edit Station
            </button>
          )}
        </div>
        <div className="osce-station__meta" style={{ marginTop: 12 }}>
          <span className="osce__tag osce__tag--type">
            {TYPE_LABELS[station.station_type] || station.station_type}
          </span>
          {station.difficulty && (
            <span className="osce__tag osce__tag--difficulty" data-diff={station.difficulty}>
              {station.difficulty}
            </span>
          )}
          {station.specialties?.name && (
            <span className="osce__tag osce__tag--specialty">{station.specialties.name}</span>
          )}
        </div>
        {station.summary && (
          <p style={{ marginTop: 16, color: 'var(--syn-muted)', fontSize: 16, lineHeight: 1.5 }}>
            {station.summary}
          </p>
        )}
      </div>

      <div className="osce-group__grid">
        <div className="osce-group__main">
          <div className="osce-roles" style={{ gridTemplateColumns: '1fr', gap: 16 }}>

            <button
              className="osce-role"
              onClick={() => navigate(`/dashboard/osce/station/${station.slug}/practice?role=candidate`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="osce-stat__icon osce-stat__icon--blue">
                  <LuUser size={20} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="osce-role__name">Candidate Instructions</div>
                  <div className="osce-role__desc">View the candidate brief, write notes, and use the timer.</div>
                </div>
              </div>
            </button>

            {hasPatientRole && (
              <button
                className="osce-role"
                onClick={() => navigate(`/dashboard/osce/station/${station.slug}/practice?role=patient`)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div className="osce-stat__icon osce-stat__icon--green">
                    <LuStethoscope size={20} />
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="osce-role__name">Patient Script</div>
                    <div className="osce-role__desc">Act as the simulated patient with a detailed history and instructions.</div>
                  </div>
                </div>
              </button>
            )}

            <button
              className="osce-role"
              onClick={() => navigate(`/dashboard/osce/station/${station.slug}/practice?role=examiner`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="osce-stat__icon osce-stat__icon--cyan">
                  <LuClipboardList size={20} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="osce-role__name">Examiner Instructions & Mark Scheme</div>
                  <div className="osce-role__desc">Score the candidate, view viva questions, and provide global impressions.</div>
                </div>
              </div>
            </button>

            <button
              className="osce-role"
              onClick={() => navigate(`/dashboard/osce/station/${station.slug}/practice?role=all`)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="osce-stat__icon osce-stat__icon--gray">
                  <LuEye size={20} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div className="osce-role__name">View All (Self-Study)</div>
                  <div className="osce-role__desc">View all station materials simultaneously with expand/collapse options.</div>
                </div>
              </div>
            </button>

          </div>
        </div>

        <div className="osce-group__sidebar">
          <div className="osce-group__sidebar-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ background: 'var(--surface-tint-cyan)', color: 'var(--syn-cyan)', width: 64, height: 64, borderRadius: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <LuUsers size={32} />
            </div>
            <h3 className="osce-group__sidebar-title" style={{ fontSize: 18 }}>Practice with Friends</h3>
            <p style={{ color: 'var(--syn-muted)', fontSize: 14, marginBottom: 24 }}>
              Invite others to a real-time synchronized session where you each take on a different role.
            </p>
            <button
              className="osce-btn osce-btn--primary-large"
              style={{ width: '100%' }}
              onClick={() => navigate(`/dashboard/osce/group?station_id=${station.id}&tab=create`)}
            >
              Start Group Session
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
