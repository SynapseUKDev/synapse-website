import React, { useEffect, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { LuTimer, LuUsers, LuStethoscope, LuTarget, LuListCheck, LuSearch, LuShuffle, LuBookOpen, LuPencil } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TYPE_LABELS = {
  history_taking: 'History',
  examination: 'Examination',
  communication: 'Communication',
  procedural: 'Procedures',
  emergency: 'Emergency',
  data_interpretation: 'Interpretation',
  prescribing: 'Prescribing',
  documentation: 'Documentation',
  paeds_obs_gynae: 'Paeds / O&G',
}

const TYPE_EMOJIS = {
  history_taking: '💬',
  examination: '🩺',
  communication: '🗣️',
  procedural: '✂️',
  emergency: '🚨',
  data_interpretation: '📊',
  prescribing: '💊',
  documentation: '📋',
  paeds_obs_gynae: '👶',
}

export default function OsceStations() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin
  const [stations, setStations] = useState([])
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    window.scrollTo(0, 0)
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [stRes, prRes] = await Promise.all([
        authenticatedFetch(`${API_BASE}/osce/stations`),
        authenticatedFetch(`${API_BASE}/osce/progress`),
      ])
      if (stRes.ok) {
        const d = await stRes.json()
        setStations(d.stations || [])
      }
      if (prRes.ok) {
        const d = await prRes.json()
        setProgress(d.attempts || [])
      }
    } catch (e) {
      console.error('Failed to load OSCE data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Stats
  const totalStations = stations.length
  const attemptedStationIds = new Set(progress.map(a => a.station_id))
  const completedCount = attemptedStationIds.size
  const avgScore = progress.length > 0
    ? Math.round(progress.filter(a => a.max_marks > 0).reduce((s, a) => s + (a.total_marks / a.max_marks) * 100, 0) / Math.max(1, progress.filter(a => a.max_marks > 0).length))
    : 0

  // Available station types from data
  const availableTypes = [...new Set(stations.map(s => s.station_type))].sort()

  // Filter
  const filtered = stations.filter(s => {
    if (typeFilter && s.station_type !== typeFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (s.title || '').toLowerCase().includes(q) || (s.summary || '').toLowerCase().includes(q)
    }
    return true
  })

  if (loading) {
    return <div className="osce"><LoadingScreen message="Loading OSCE stations..." inline /></div>
  }

  return (
    <div className="osce">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="osce__title">OSCE Stations</h1>
          <p className="osce__subtitle">Practice clinical examinations following the UKMLA specification</p>
        </div>
        {isAdmin && (
          <button 
            className="osce-btn osce-btn--secondary osce-btn--sm" 
            onClick={() => navigate('/dashboard/admin/osce')}
          >
            <LuPencil size={16} /> Manage Stations
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="osce__stats">
        <div className="osce-stat">
          <div className="osce-stat__top">
            <div className="osce-stat__title">Stations Completed</div>
            <div className="osce-stat__icon osce-stat__icon--green"><LuTarget size={20} /></div>
          </div>
          <div className="osce-stat__value">{completedCount}/{totalStations}</div>
          <div className="osce-stat__sub">Unique stations attempted</div>
        </div>
        <div className="osce-stat">
          <div className="osce-stat__top">
            <div className="osce-stat__title">Total Attempts</div>
            <div className="osce-stat__icon osce-stat__icon--purple"><LuListCheck size={20} /></div>
          </div>
          <div className="osce-stat__value">{progress.length}</div>
          <div className="osce-stat__sub">Across all stations</div>
        </div>
        <div className="osce-stat">
          <div className="osce-stat__top">
            <div className="osce-stat__title">Average Score</div>
            <div className="osce-stat__icon osce-stat__icon--gold"><LuTimer size={20} /></div>
          </div>
          <div className="osce-stat__value">{avgScore}%</div>
          <div className="osce-stat__sub">{progress.length > 0 ? 'Keep practicing!' : 'Complete a station to see your score'}</div>
        </div>
      </div>

      {/* Feature cards */}
      <div className="osce__features">
        <div className="osce-feature">
          <div className="osce-feature__head">
            <div className="osce-feature__icon" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
              <LuUsers size={24} />
            </div>
            <div>
              <div className="osce-feature__title">Group Practice</div>
              <div className="osce-feature__meta">Practice with friends in real-time</div>
            </div>
          </div>
          <div className="osce-feature__actions">
            <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => navigate('/dashboard/osce/group')}>Create or Join</button>
          </div>
        </div>

        <div className="osce-feature">
          <div className="osce-feature__head">
            <div className="osce-feature__icon" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
              <LuShuffle size={24} />
            </div>
            <div>
              <div className="osce-feature__title">Random Station</div>
              <div className="osce-feature__meta">Jump into a random station</div>
            </div>
          </div>
          <div className="osce-feature__actions">
            <button
              className="osce-btn osce-btn--sm"
              disabled={stations.length === 0}
              onClick={() => {
                const rand = stations[Math.floor(Math.random() * stations.length)]
                if (rand) navigate(`/dashboard/osce/station/${rand.slug}`)
              }}
            >Try Random</button>
          </div>
        </div>

        <div className="osce-feature">
          <div className="osce-feature__head">
            <div className="osce-feature__icon" style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' }}>
              <LuBookOpen size={24} />
            </div>
            <div>
              <div className="osce-feature__title">OSCE Guide</div>
              <div className="osce-feature__meta">Tips and structure for each type</div>
            </div>
          </div>
          <div className="osce-feature__actions">
            <button className="osce-btn osce-btn--secondary osce-btn--sm" disabled style={{ opacity: 0.6, cursor: 'not-allowed' }}>Coming Soon</button>
          </div>
        </div>
      </div>

      {/* Section title + search */}
      <h2 className="osce__section-title">Browse Stations</h2>

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 24 }}>
        <div className="qb-search" style={{ flex: 1, minWidth: 200, marginBottom: 0 }}>
          <div className="qb-search__icon"><LuSearch size={20} /></div>
          <input
            type="text"
            className="qb-search__input"
            placeholder="Search stations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Type filter pills */}
      <div className="osce__filters">
        <button className={`osce__pill ${!typeFilter ? 'osce__pill--active' : ''}`} onClick={() => setTypeFilter('')}>
          All
        </button>
        {availableTypes.map(t => (
          <button
            key={t}
            className={`osce__pill ${typeFilter === t ? 'osce__pill--active' : ''}`}
            onClick={() => setTypeFilter(typeFilter === t ? '' : t)}
          >
            {TYPE_EMOJIS[t] || '📋'} {TYPE_LABELS[t] || t}
          </button>
        ))}
      </div>

      {/* Station grid */}
      {filtered.length === 0 ? (
        <div className="osce__empty">
          <div className="osce__empty-icon"><LuStethoscope size={28} /></div>
          <p>No stations found. {searchQuery || typeFilter ? 'Try adjusting your filters.' : 'Check back soon!'}</p>
        </div>
      ) : (
        <div className="osce__grid">
          {filtered.map(station => {
            const attempts = progress.filter(a => a.station_id === station.id)
            const lastAttempt = attempts[0]
            return (
              <div key={station.id} className="osce__card" onClick={() => navigate(`/dashboard/osce/station/${station.slug}`)}>
                <div className="osce__card-header">
                  <h3 className="osce__card-title">{station.title}</h3>
                  <div className="osce__card-time"><LuTimer size={14} />{station.time_minutes} min</div>
                </div>
                {station.summary && <p className="osce__card-summary">{station.summary}</p>}
                <div className="osce__card-tags">
                  <span className="osce__tag osce__tag--type">{TYPE_EMOJIS[station.station_type] || ''} {TYPE_LABELS[station.station_type] || station.station_type}</span>
                  {station.difficulty && <span className="osce__tag osce__tag--difficulty" data-diff={station.difficulty}>{station.difficulty}</span>}
                  {station.specialties?.name && <span className="osce__tag osce__tag--specialty">{station.specialties.name}</span>}
                  {lastAttempt && <span className="osce__tag" style={{ background: '#dcfce7', color: '#16a34a' }}>✓ Attempted</span>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
