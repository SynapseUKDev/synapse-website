import React, { useEffect, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import * as Lu from 'react-icons/lu'
import { LuTarget, LuListCheck, LuFlame, LuTimer } from 'react-icons/lu'
import './QuestionBank.css'
import LoadingScreen from '../components/loading/LoadingScreen'

function StatCard({ title, value, sub, Icon }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #eef2f7', borderRadius: 16, padding: 20, position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ color: '#64748b', fontWeight: 700 }}>{title}</div>
        <div style={{ background: '#fff7ed', border: '1px solid #ffe7cc', color: '#fb923c', width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center' }}>
          {Icon ? <Icon size={18} /> : null}
        </div>
      </div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#0b1637', marginTop: 12 }}>{value}</div>
      {sub && <div style={{ marginTop: 6, color: '#8da2bf', fontSize: 13 }}>{sub}</div>}
    </div>
  )
}

function SpecialtyCard({ item }) {
  const pct = item.total_questions > 0 ? Math.round((item.completed_questions / item.total_questions) * 100) : 0
  const IconComp = item.icon_name && Lu[item.icon_name] ? Lu[item.icon_name] : null
  const navigate = useNavigate()
  return (
    <div className="qb-card">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div className="qb-card__icon" style={{
            background: item.icon_bg_start && item.icon_bg_end
              ? `linear-gradient(180deg, ${item.icon_bg_start}, ${item.icon_bg_end})`
              : undefined,
            color: item.icon_color || '#e11d48'
          }}>
            {IconComp ? <IconComp size={22} /> : (item.specialty_name?.charAt(0) || '•')}
          </div>
          <div>
            <div className="qb-card__title">{item.specialty_name}</div>
            <div className="qb-card__meta">{item.completed_questions}/{item.total_questions} completed</div>
          </div>
        </div>
        <div className="qb-card__badge">{pct}%</div>
      </div>
      <div className="qb-card__bar"><div className="qb-card__fill" style={{ width: `${pct}%` }} /></div>
      <div className="qb-card__metrics">
        <div><div className="qb-metric__label">Average Score</div><div className="qb-metric__value">{item.accuracy_pct ?? 0}%</div></div>
        <div><div className="qb-metric__label">Last Studied</div><div className="qb-metric__value">{item.last_studied ? new Date(item.last_studied).toLocaleString() : '—'}</div></div>
        <div><div className="qb-metric__label">Avg Time</div><div className="qb-metric__value">{item.avg_time_ms ? Math.round(item.avg_time_ms / 1000) : '—'} min</div></div>
      </div>
      <div className="qb-card__topics">
        <div className="qb-card__topics-title">Key Topics:</div>
        <div className="qb-chips">
          {(item.key_topics || []).map((slug) => (<span key={slug} className="qb-chip">{slug.replace(/-/g,' ')}</span>))}
        </div>
      </div>
      <div className="qb-card__actions">
        <button className="qb-btn" onClick={() => navigate(`/dashboard/question-bank/setup?specialty_id=${item.specialty_id}&specialty_name=${encodeURIComponent(item.specialty_name)}`)}>Start Practicing</button>
      </div>
    </div>
  )
}

export default function QuestionBank() {
  const { user } = useOutletContext()
  const [summary, setSummary] = useState(null)
  const [specialties, setSpecialties] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    ;(async () => {
      try {
        const sRes = await fetch(`${API_BASE}/qbank/summary`, { credentials: 'include', cache: 'no-store' })
        const tRes = await fetch(`${API_BASE}/qbank/specialties`, { credentials: 'include', cache: 'no-store' })
        const s = sRes.ok ? await sRes.json().catch(() => ({})) : {}
        const t = tRes.ok ? await tRes.json().catch(() => ({})) : {}
        setSummary(s.summary || { total_answered: 0, accuracy_pct: 0, avg_time_ms: 0 })
        setSpecialties(Array.isArray(t.specialties) ? t.specialties : [])
      } catch (e) {
        console.warn('Failed to load question bank data', e)
        setSummary({ total_answered: 0, accuracy_pct: 0, avg_time_ms: 0 })
        setSpecialties([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return <LoadingScreen message="Loading question bank..." />
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
          <div className="qb-stat__value">—</div>
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


