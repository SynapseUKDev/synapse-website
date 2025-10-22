import React, { useEffect, useState } from 'react'
import { authHeaders } from '../../auth/token'
import { useOutletContext, useNavigate } from 'react-router-dom'
import * as Lu from 'react-icons/lu'
import { LuTarget, LuListCheck, LuFlame, LuTimer } from 'react-icons/lu'
import './QuestionBank.css'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'

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

  const summary = {
    total_answered: summaryReq.data?.total_answered || 0,
    accuracy_pct: summaryReq.data?.accuracy_pct || 0,
    avg_time_ms: summaryReq.data?.avg_time_ms || 0,
    study_streak_days: dashReq.data?.study_streak_days || 0,
  }
  const specialties = specialtiesReq.data || []
  const loading = (summaryReq.loading && !summaryReq.data) || (specialtiesReq.loading && !specialtiesReq.data)

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading question bank..." inline />
      </div>
    )
  }

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

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

      {/* Specialty cards grid */}
      <div className="qb__grid">
        {specialties.map((s) => (<SpecialtyCard key={s.specialty_id} item={s} />))}
      </div>
    </div>
  )
}


