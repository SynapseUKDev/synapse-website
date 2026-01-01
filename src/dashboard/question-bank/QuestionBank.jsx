import React, { useEffect, useState } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useOutletContext, useNavigate } from 'react-router-dom'
import * as Lu from 'react-icons/lu'
import { LuTarget, LuListCheck, LuFlame, LuTimer, LuPlus, LuTrash2, LuLayers, LuUsers } from 'react-icons/lu'
import './QuestionBank.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'

function StudySetCard({ item, onDelete }) {
  const navigate = useNavigate()
  
  return (
    <div className="qb-card qb-card--set">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div className="qb-card__icon" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
            <LuLayers size={24} />
          </div>
          <div style={{ overflow: 'hidden' }}>
            <div className="qb-card__title" style={{ fontSize: 18, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
            <div className="qb-card__meta">{item.item_count} items included</div>
          </div>
        </div>
        <button 
          className="qb-card__del-btn" 
          onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
          title="Delete Study Set"
        >
          <LuTrash2 size={16} />
        </button>
      </div>
      <div style={{ marginTop: 16, flex: 1 }}>
        {/* Can add more metadata here later like last studied or accuracy */}
      </div>
      <div className="qb-card__actions">
        <button className="qb-btn" onClick={() => navigate(`/dashboard/question-bank/setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}>Start Set</button>
        <button className="qb-btn qb-btn--secondary" onClick={() => navigate(`/dashboard/question-bank/group_setup?study_set_id=${item.id}&study_set_name=${encodeURIComponent(item.name)}`)}>Group Study</button>
      </div>
    </div>
  )
}

function SpecialtyCard({ item }) {
  const pct = item.total_questions > 0 ? Math.round((item.completed_questions / item.total_questions) * 100) : 0
  const navigate = useNavigate()
  const initial = item.specialty_name?.charAt(0) || '•'
  const showImage = typeof item.icon_url === 'string' && item.icon_url.trim().length > 0
  return (
    <div className="qb-card">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div className="qb-card__icon">
            {showImage ? (
              <img src={item.icon_url} alt={item.specialty_name} className="qb-card__icon-img" />
            ) : (
              initial
            )}
          </div>
          <div>
            <div className="qb-card__title">{item.specialty_name}</div>
            <div className="qb-card__meta">{item.completed_questions}/{item.total_questions} completed</div>
          </div>
        </div>
      </div>
      <div className="qb-card__bar"><div className="qb-card__fill" style={{ width: `${pct}%` }} /></div>
      <div className="qb-card__metrics">
        <div><div className="qb-metric__label">Average Score</div><div className="qb-metric__value">{item.accuracy_pct ?? 0}%</div></div>
        <div><div className="qb-metric__label">Last Studied</div><div className="qb-metric__value">{item.last_studied ? new Date(item.last_studied).toLocaleString() : '—'}</div></div>
        <div><div className="qb-metric__label">Avg Time</div><div className="qb-metric__value">{item.avg_time_ms ? Math.round(item.avg_time_ms / 1000) : '—'} min</div></div>
      </div>
      <div className="qb-card__actions">
        <button className="qb-btn" onClick={() => navigate(`/dashboard/question-bank/setup?specialty_id=${item.specialty_id}&specialty_name=${encodeURIComponent(item.specialty_name)}`)}>Start Practicing</button>
      </div>
      {/* <div className="qb-card__topics">
        <div className="qb-card__topics-title">Key Topics:</div>
        <div className="qb-chips">
          {(item.key_topics || []).map((slug) => (<span key={slug} className="qb-chip">{slug.replace(/-/g,' ')}</span>))}
        </div>
      </div> */}
      
    </div>
  )
}

export default function QuestionBank() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const summaryReq = useStaleJson(`${API_BASE}/qbank/summary`, {
    headers: authHeaders(),
    staleMs: 60_000,
    persist: 'session',
    key: 'qbank:summary',
    transform: (s) => s && s.summary ? s.summary : { total_answered: 0, accuracy_pct: 0, avg_time_ms: 0 },
  })
  const dashReq = useStaleJson(`${API_BASE}/dashboard/summary`, {
    headers: authHeaders(),
    staleMs: 60_000,
    persist: 'session',
    key: 'dashboard:summary',
  })
  const specialtiesReq = useStaleJson(`${API_BASE}/qbank/specialties`, {
    headers: authHeaders(),
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'qbank:specialties',
    transform: (t) => (Array.isArray(t.specialties) ? t.specialties : []),
  })

  // Fetch study sets
  const [studySets, setStudySets] = useState([])
  const [loadingSets, setLoadingSets] = useState(true)

  useEffect(() => {
    loadStudySets()
  }, [])

  const loadStudySets = async () => {
    try {
      setLoadingSets(true)
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        setStudySets(data.sets || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingSets(false)
    }
  }

  const handleDeleteSet = async (setId) => {
    if (!window.confirm('Are you sure you want to delete this study set?')) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${setId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: authHeaders()
      })
      if (res.ok) {
        setStudySets(prev => prev.filter(s => s.id !== setId))
      }
    } catch (e) {
      console.error(e)
      alert('Failed to delete set')
    }
  }

  const summary = {
    total_answered: summaryReq.data?.total_answered || 0,
    accuracy_pct: summaryReq.data?.accuracy_pct || 0,
    avg_time_ms: summaryReq.data?.avg_time_ms || 0,
    study_streak_days: dashReq.data?.study_streak_days || 0,
  }
  const specialties = specialtiesReq.data || []
  const loading = (summaryReq.loading && !summaryReq.data) || (specialtiesReq.loading && !specialtiesReq.data)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading question bank..." inline />
      </div>
    )
  }

  return (
    <div className="qb">
      <h1 className="qb__title">Question Bank</h1>
      <p className="qb__subtitle">Choose your specialty and study mode to begin practicing</p>

      {/* Stat cards */}
      <div className="qb__stats">
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Overall Accuracy</div><div className="qb-stat__icon"><LuTarget size={20} /></div></div>
          <div className="qb-stat__value">{`${summary?.accuracy_pct ?? 0}%`}</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Questions Answered</div><div className="qb-stat__icon"><LuListCheck size={20} /></div></div>
          <div className="qb-stat__value">{summary?.total_answered ?? 0}</div>
          <div className="qb-stat__sub">Across all specialties</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Study Streak</div><div className="qb-stat__icon"><LuFlame size={20} /></div></div>
          <div className="qb-stat__value">{summary?.study_streak_days ?? 0} days</div>
          <div className="qb-stat__sub">Keep it going!</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Avg Time per Question</div><div className="qb-stat__icon"><LuTimer size={20} /></div></div>
          <div className="qb-stat__value">{`${summary?.avg_time_ms ? Math.round(summary.avg_time_ms / 1000) : 0}s`}</div>
          <div className="qb-stat__sub">Optimal range: 30–60s</div>
        </div>
      </div>

      {/* Study Sets Section */}
      <div className="qb__section-header" style={{ marginTop: 32, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="qb__section-title" style={{ fontSize: 20, fontWeight: 700, margin: 0, color: '#1f2937' }}>My Study Sets</h2>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button 
            className="qb-btn qb-btn--sm qb-btn--secondary" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/dashboard/question-bank/group_setup?mode=join')}
          >
            <LuUsers size={18} /> Join Group Session
          </button>
          <button 
            className="qb-btn qb-btn--sm" 
            style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}
            onClick={() => navigate('/dashboard/question-bank/create-set')}
          >
            <LuPlus size={18} /> Create New Set
          </button>
        </div>
      </div>

      {studySets.length > 0 ? (
        <div className="qb__grid">
          {studySets.map(set => (
            <StudySetCard key={set.id} item={set} onDelete={handleDeleteSet} />
          ))}
        </div>
      ) : (
        <div className="qb-empty-sets">
          <div className="qb-empty-sets__icon"><LuLayers size={32} /></div>
          <p>You haven't created any personal study sets yet.</p>
          <button className="qb-btn-text" onClick={() => navigate('/dashboard/question-bank/create-set')}>Create your first set</button>
        </div>
      )}

      <h2 className="qb__section-title" style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16, color: '#1f2937' }}>Browse by Specialty</h2>

      {/* Specialty cards grid */}
      <div className="qb__grid">
        {specialties.map((s) => (<SpecialtyCard key={s.specialty_id} item={s} />))}
      </div>
    </div>
  )
}


