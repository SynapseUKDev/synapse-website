import { useEffect, useState } from 'react'
import useStaleJson from '../../utils/useStaleJson'
import { authHeaders } from '../../auth/token'
import { windowLabel } from './analyticsFormat'
import KpiDeck from './components/KpiDeck'
import TrendChart from './components/TrendChart'
import ReportCard from './components/ReportCard'
import SpecialtyMap from './components/SpecialtyMap'
import WeakestTopics from './components/WeakestTopics'
import ReadingVsPractice from './components/ReadingVsPractice'
import ActivityCard from './components/ActivityCard'
import './Analytics.css'

const WINDOWS = [
  { key: '30', label: '30 days' },
  { key: '90', label: '90 days' },
  { key: 'all', label: 'All time' },
]

function useIsMobile() {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false))
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const mql = window.matchMedia('(max-width: 640px)')
    const onChange = (e) => setM(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return m
}

export default function Analytics() {
  const [win, setWin] = useState(() => {
    try { return sessionStorage.getItem('analytics:window') || '30' } catch { return '30' }
  })
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const req = useStaleJson(`${API_BASE}/analytics/overview?window=${win}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 60_000,
    persist: 'session',
    key: `analytics:overview:${win}`,
  })
  const isMobile = useIsMobile()
  const d = req.data

  function pick(key) {
    setWin(key)
    try { sessionStorage.setItem('analytics:window', key) } catch { /* ignore */ }
  }

  return (
    <div className="an">
      <div className="an-hero">
        <div>
          <p className="an-eyebrow">Your progress</p>
          <h1 className="an-title">Analytics</h1>
          <p className="an-date">{windowLabel(win)}</p>
        </div>
        <div className="an-range" role="group" aria-label="Time range">
          {WINDOWS.map((w) => (
            <button key={w.key} type="button" aria-pressed={win === w.key} className={`an-range__b ${win === w.key ? 'is-on' : ''}`} onClick={() => pick(w.key)}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {req.error ? (
        <div className="an-card an-error">
          Couldn't load your analytics. <button type="button" className="an-btn" onClick={() => window.location.reload()}>Try again</button>
        </div>
      ) : null}

      {req.loading && !d ? <div className="an-card an-empty">Loading your progress…</div> : null}

      {d ? (
        <>
          <KpiDeck kpis={d.kpis} allTime={d.window.key === 'all'} />
          <div className="an-row an-row--21">
            <TrendChart trend={d.trend} />
            <ReportCard report={d.latest_report} eligibility={d.report_eligibility} />
          </div>
          <div className="an-row">
            <SpecialtyMap specialties={d.specialties} perRow={isMobile ? 2 : 6} />
          </div>
          <div className="an-row an-row--11">
            <WeakestTopics topics={d.weakest_topics} />
            <ReadingVsPractice data={d.reading_vs_practice} />
          </div>
          <div className="an-row">
            <ActivityCard />
          </div>
        </>
      ) : null}
    </div>
  )
}
