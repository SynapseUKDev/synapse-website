import React, { useEffect, useState, useRef } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useOutletContext, useNavigate } from 'react-router-dom'
import * as Lu from 'react-icons/lu'
import { LuTarget, LuListCheck, LuTimer, LuUsers, LuBookOpen, LuSearch } from 'react-icons/lu'
import './QuestionBank.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'
import ActivityHeatmap from '../../components/heatmap/ActivityHeatmap'

// Animated counter component for engaging stat display
function AnimatedCounter({ value, suffix = '', duration = 1000 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const startTime = useRef(null)
  const animationFrame = useRef(null)

  useEffect(() => {
    const targetValue = typeof value === 'number' ? value : parseFloat(value) || 0

    if (targetValue === 0) {
      setDisplayValue(0)
      return
    }

    const animate = (timestamp) => {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)

      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4)
      const currentValue = Math.floor(targetValue * easeOutQuart)

      setDisplayValue(currentValue)

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate)
      } else {
        setDisplayValue(targetValue)
      }
    }

    startTime.current = null
    animationFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
    }
  }, [value, duration])

  return <>{displayValue}{suffix}</>
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
  const specialtiesReq = useStaleJson(`${API_BASE}/qbank/specialties`, {
    headers: authHeaders(),
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'qbank:specialties',
    transform: (t) => (Array.isArray(t.specialties) ? t.specialties : []),
  })

  const summary = {
    total_answered: summaryReq.data?.total_answered || 0,
    accuracy_pct: summaryReq.data?.accuracy_pct || 0,
    avg_time_ms: summaryReq.data?.avg_time_ms || 0,
  }
  const allSpecialties = specialtiesReq.data || []
  const [searchQuery, setSearchQuery] = useState('')
  const loading = (summaryReq.loading && !summaryReq.data) || (specialtiesReq.loading && !specialtiesReq.data)

  // Filter specialties using regex
  const specialties = allSpecialties.filter(specialty => {
    if (!searchQuery.trim()) return true
    try {
      const regex = new RegExp(searchQuery, 'i')
      return regex.test(specialty.specialty_name || '')
    } catch (e) {
      // If regex is invalid, fall back to simple string matching
      return (specialty.specialty_name || '').toLowerCase().includes(searchQuery.toLowerCase())
    }
  })

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

      {/* Stat cards with animated counters */}
      <div className="qb__stats">
        <div className="qb-stat qb-stat--interactive">
          <div className="qb-stat__top">
            <div className="qb-stat__title">Overall Accuracy</div>
            <div className="qb-stat__icon qb-stat__icon--target">
              <LuTarget size={20} />
            </div>
          </div>
          <div className="qb-stat__value">
            <AnimatedCounter value={summary?.accuracy_pct ?? 0} suffix="%" duration={1200} />
          </div>
          <div className="qb-stat__sub">
            <div
              className="qb-stat__progress-ring"
              style={{ '--progress': `${summary?.accuracy_pct ?? 0}%` }}
            />
          </div>
        </div>
        <div className="qb-stat qb-stat--interactive">
          <div className="qb-stat__top">
            <div className="qb-stat__title">Questions Answered</div>
            <div className="qb-stat__icon qb-stat__icon--questions">
              <LuListCheck size={20} />
            </div>
          </div>
          <div className="qb-stat__value">
            <AnimatedCounter value={summary?.total_answered ?? 0} duration={1500} />
          </div>
          <div className="qb-stat__sub">Across all specialties</div>
        </div>
        <div className="qb-stat qb-stat--interactive">
          <div className="qb-stat__top">
            <div className="qb-stat__title">Avg Time per Question</div>
            <div className="qb-stat__icon qb-stat__icon--timer">
              <LuTimer size={20} />
            </div>
          </div>
          <div className="qb-stat__value">
            <AnimatedCounter value={summary?.avg_time_ms ? Math.round(summary.avg_time_ms / 1000) : 0} suffix="s" duration={1000} />
          </div>
          <div className="qb-stat__sub">
            {summary?.avg_time_ms ? (
              Math.round(summary.avg_time_ms / 1000) >= 30 && Math.round(summary.avg_time_ms / 1000) <= 60
                ? <span className="qb-stat__badge qb-stat__badge--good">✓ Optimal pace</span>
                : Math.round(summary.avg_time_ms / 1000) < 30
                  ? <span className="qb-stat__badge qb-stat__badge--fast">⚡ Quick pace</span>
                  : <span className="qb-stat__badge qb-stat__badge--slow">🐢 Take your time</span>
            ) : 'Optimal range: 30–60s'}
          </div>
        </div>
      </div>

      {/* Three Feature Cards */}
      <div className="qb__grid qb__grid--features" style={{ marginTop: 32, marginBottom: 40 }}>
        {/* Custom Revision Sets Card */}
        <div className="qb-card qb-card--feature">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>
                <LuBookOpen size={24} />
              </div>
              <div>
                <div className="qb-card__title">Custom Revision Sets</div>
                <div className="qb-card__meta">Create and manage your study sets</div>
              </div>
            </div>
          </div>
          <div className="qb-card__actions">
            <button className="qb-btn" onClick={() => navigate('/dashboard/study-sets')}>Go to Custom Sets</button>
          </div>
        </div>

        {/* Group Sessions Card */}
        <div className="qb-card qb-card--feature">
          <div className="qb-card__head">
            <div className="qb-card__titlewrap">
              <div className="qb-card__icon" style={{ background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a' }}>
                <LuUsers size={24} />
              </div>
              <div>
                <div className="qb-card__title">Group Sessions</div>
                <div className="qb-card__meta">Study together with others</div>
              </div>
            </div>
          </div>
          <div className="qb-card__actions" style={{ display: 'flex', gap: 8 }}>
            <button className="qb-btn qb-btn--secondary" onClick={() => navigate('/dashboard/question-bank/group_setup?mode=join')}>Join Session</button>
            <button className="qb-btn" onClick={() => navigate('/dashboard/study-sets')}>Create Session</button>
          </div>
        </div>

        {/* Heatmap Card */}
        <div className="qb-card qb-card--feature qb-card--heatmap">
          <div className="qb-card__head" style={{ marginBottom: 8 }}>
            <div className="qb-card__title">Study Activity</div>
          </div>
          <div className="qb-heatmap-visualization">
            <ActivityHeatmap />
          </div>
        </div>
      </div>

      <h2 className="qb__section-title" style={{ fontSize: 20, fontWeight: 700, marginTop: 32, marginBottom: 16, color: '#1f2937' }}>Browse by Specialty</h2>

      {/* Search bar */}
      <div className="qb-search">
        <div className="qb-search__icon">
          <LuSearch size={20} />
        </div>
        <input
          type="text"
          className="qb-search__input"
          placeholder="Search specialties..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Specialty cards grid */}
      <div className="qb__grid">
        {specialties.map((s) => (<SpecialtyCard key={s.specialty_id} item={s} />))}
      </div>
    </div>
  )
}


