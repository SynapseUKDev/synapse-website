import React, { useEffect, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import { authHeaders } from '../auth/token'
import { LuFlame, LuTimer, LuTarget, LuCirclePlay, LuBookOpen, LuUserPlus, LuCheck, LuX } from 'react-icons/lu'
import LoadingScreen from '../components/loading/LoadingScreen'
import useStaleJson from '../utils/useStaleJson'

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const summaryReq = useStaleJson(`${API_BASE}/dashboard/summary`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 60_000,
    persist: 'session',
    key: 'dashboard:summary',
  })
  const trendReq = useStaleJson(`${API_BASE}/qbank/performance/trend`, {
    headers: authHeaders(),
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'dashboard:trend',
    transform: (t) => ({ days: Array.isArray(t.days) ? t.days : buildDemoTrend() }),
  })

  const summary = summaryReq.data || { study_streak_days: 0, time_today_minutes: 0, questions_today: 0, last_specialty: null, targets: { time_minutes: 180, questions: 30 } }
  const trend = trendReq.data?.days || buildDemoTrend()
  const loading = summaryReq.loading && !summaryReq.data

  // Friends state
  const [friendEmail, setFriendEmail] = useState('')
  const [sendLoading, setSendLoading] = useState(false)
  const [requests, setRequests] = useState({ inbox: [], outbox: [] })
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [friendsTab, setFriendsTab] = useState('add') // add | requests

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  // const loadFriendsData = async () => {
  //   try {
  //     setRequestsLoading(true)
  //     const reqRes = await fetch(`${API_BASE}/friends/requests`, { headers: authHeaders() })
  //     const reqJson = await reqRes.json().catch(() => ({}))
  //     setRequests({ inbox: reqJson?.inbox || [], outbox: reqJson?.outbox || [] })
  //   } catch (_e) {
  //     setRequests({ inbox: [], outbox: [] })
  //   } finally {
  //     setRequestsLoading(false)
  //   }
  //   // Leaderboard removed for now
  // }

  // useEffect(() => {
  //   loadFriendsData()
  // }, [])

  // const sendFriendRequest = async (e) => {
  //   e?.preventDefault?.()
  //   const email = friendEmail.trim()
  //   if (!email) return
  //   setSendLoading(true)
  //   try {
  //     const res = await fetch(`${API_BASE}/friends/requests`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json', ...authHeaders() },
  //       body: JSON.stringify({ email })
  //     })
  //     const json = await res.json().catch(() => ({}))
  //     if (!res.ok) {
  //       alert(json?.error || 'Failed to send request')
  //     } else {
  //       setFriendEmail('')
  //       await loadFriendsData()
  //     }
  //   } catch (_e) {
  //     alert('Failed to send request')
  //   } finally {
  //     setSendLoading(false)
  //   }
  // }

  // const respondToRequest = async (requestId, action) => {
  //   try {
  //     const res = await fetch(`${API_BASE}/friends/requests/${requestId}/respond`, {
  //       method: 'POST',
  //       headers: { 'Content-Type': 'application/json', ...authHeaders() },
  //       body: JSON.stringify({ action })
  //     })
  //     const json = await res.json().catch(() => ({}))
  //     if (!res.ok) {
  //       alert(json?.error || 'Failed to update request')
  //     }
  //   } catch (_e) {
  //     alert('Failed to update request')
  //   } finally {
  //     await loadFriendsData()
  //   }
  // }

  const continueQuestions = () => {
    const spec = summary.last_specialty
    if (spec?.id) {
      navigate(`/dashboard/question-bank/setup?specialty_id=${spec.id}&specialty_name=${encodeURIComponent(spec.name || 'Specialty')}`)
    } else {
      navigate('/dashboard/question-bank')
    }
  }

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading dashboard..." inline />
      </div>
    )
  }

  return (
    <div className="qb">
      <h1 className="qb__title">Dashboard</h1>
      <p className="qb__subtitle">{new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <div className="qb__stats db-stats">
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Study Streak</div><div className="qb-stat__icon"><LuFlame size={20} /></div></div>
          <div className="qb-stat__value">{summary?.study_streak_days ?? 0} days</div>
          <div className="qb-stat__sub">Keep it up!</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Study Time</div><div className="qb-stat__icon"><LuTimer size={20} /></div></div>
          <div className="qb-stat__value">{summary?.time_today_minutes ?? 0} mins</div>
          <div className="qb-stat__sub">Target: {summary?.targets?.time_minutes || 180} mins</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Questions Today</div><div className="qb-stat__icon"><LuTarget size={20} /></div></div>
          <div className="qb-stat__value">{summary?.questions_today ?? 0}/{summary?.targets?.questions || 30}</div>
          <div className="db-progress"><div className="db-progress__fill" style={{ width: `${Math.min(100, Math.round((((summary?.questions_today || 0) / (summary?.targets?.questions || 30)) * 100))) }%` }} /></div>
        </div>
      </div>

      <div className="db-qa">
        <div className="db-qa__title">Quick Actions</div>
        <div className="db-qa__sub">Jump back into your learning journey</div>
        <div className="db-qa__actions">
          <button className="db-btn" onClick={continueQuestions}>
            <div className="db-btn__left">
              <div className="db-btn__icon db-btn__icon--purple"><LuCirclePlay size={18} /></div>
              <div>
                <div>Continue Questions</div>
                <div className="db-btn__meta">{summary.last_specialty?.name ? `Resume ${summary.last_specialty.name} set` : 'Open Question Bank'}</div>
              </div>
            </div>
            <span>›</span>
          </button>
          <button className="db-btn" onClick={() => navigate('/dashboard/textbook')}>
            <div className="db-btn__left">
              <div className="db-btn__icon db-btn__icon--blue"><LuBookOpen size={18} /></div>
              <div>
                <div>Read Textbook</div>
                <div className="db-btn__meta">Revise content and view chapters</div>
              </div>
            </div>
            <span>›</span>
          </button>
        </div>
      </div>

      {/* {trend && trend.length > 0 && (
        <div className="db-perf card">
          <div className="db-perf__head">
            <div>
              <div className="db-perf__title">Performance Trend</div>
              <div className="db-perf__sub">Your accuracy and response times over the past 30 days</div>
            </div>
            <div className="db-perf__badge">↗</div>
          </div>
          <div className="db-perf__chart">
            {renderTrendChart(trend)}
          </div>
        </div>
      )} */}

      {/* <div className="db-right">
        <div className="db-card">
          <div className="db-card__top">
            <div className="db-card__title">Friends</div>
            <div className="db-tabs">
              <button className={`db-tab ${friendsTab==='add'?'is-active':''}`} onClick={()=>setFriendsTab('add')}>Add</button>
              <button className={`db-tab ${friendsTab==='requests'?'is-active':''}`} onClick={()=>setFriendsTab('requests')}>Requests</button>
            </div>
          </div>

          {friendsTab === 'add' ? (
            <div>
              <form className="db-inputrow" onSubmit={sendFriendRequest}>
                <input
                  type="email"
                  className="db-input"
                  placeholder="friend@example.com"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                />
                <button className="db-btn db-btn--small db-btn--primary" type="submit" disabled={sendLoading || !friendEmail.trim()}>
                  {sendLoading ? 'Sending…' : 'Send'}
                </button>
              </form>
              <div className="db-hint">Use their account email.</div>
            </div>
          ) : (
            <div>
              {requestsLoading ? (
                <div className="db-empty">Loading…</div>
              ) : (
                <div className="db-twoCols">
                  <div>
                    <div className="db-subheading">Inbox</div>
                    <div className="db-list">
                      {(requests.inbox || []).length === 0 && <div className="db-empty">No pending</div>}
                      {(requests.inbox || []).map((r) => (
                        <div key={r.id} className="db-list__item">
                          <div className="db-list__main">
                            <div className="db-list__title">{r.requester?.username || r.requester?.email || r.requester?.id}</div>
                            <div className="db-list__sub">{r.requester?.email}</div>
                          </div>
                          <div className="db-list__actions">
                            <button className="db-chip db-chip--accept" onClick={() => respondToRequest(r.id, 'accept')} title="Accept"><LuCheck size={16} /></button>
                            <button className="db-chip db-chip--decline" onClick={() => respondToRequest(r.id, 'decline')} title="Decline"><LuX size={16} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="db-subheading">Sent</div>
                    <div className="db-list">
                      {(requests.outbox || []).length === 0 && <div className="db-empty">No pending</div>}
                      {(requests.outbox || []).map((r) => (
                        <div key={r.id} className="db-list__item">
                          <div className="db-list__main">
                            <div className="db-list__title">{r.target?.username || r.target?.email || r.target?.id}</div>
                            <div className="db-list__sub">{r.target?.email}</div>
                          </div>
                          <div className="db-list__actions">
                            <button className="db-chip" onClick={() => respondToRequest(r.id, 'cancel')}>Cancel</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div> */}

    </div>
  )
}

function renderTrendChart(days) {
  const width = 820
  const height = 180
  const padding = { top: 10, right: 20, bottom: 26, left: 36 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const xs = days.map((_, i) => i)
  const accVals = days.map(d => (d.accuracy_pct ?? null))
  const timeVals = days.map(d => (d.avg_time_ms != null ? Math.round(d.avg_time_ms / 1000) : null))

  const xStep = innerW / Math.max(days.length - 1, 1)
  const accMax = 100
  const timeMax = Math.max(60, Math.max(...timeVals.filter(v => v != null), 0))

  const pt = (i, v, max) => {
    const x = padding.left + i * xStep
    const y = padding.top + (1 - (v / max)) * innerH
    return [x, y]
  }

  const buildPath = (values, max) => {
    const pts = values.map((v, i) => (v == null ? null : pt(i, v, max)))
    let d = ''
    let started = false
    pts.forEach((p, idx) => {
      if (!p) { started = false; return }
      const [x, y] = p
      if (!started) { d += `M ${x} ${y}`; started = true } else { d += ` L ${x} ${y}` }
    })
    return d
  }

  const accPath = buildPath(accVals, accMax)
  const timePath = buildPath(timeVals, timeMax)

  const xTicks = [0, Math.floor(days.length/2), days.length-1].filter(v=>v>=0)
  const accTicks = [0,25,50,75,100]
  const timeTicks = [0, Math.round(timeMax*0.33), Math.round(timeMax*0.66), timeMax]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Performance trend chart">
      <rect x="0" y="0" width={width} height={height} fill="#fff" rx="12" />
      {/* grid */}
      {accTicks.map((t,i)=>{
        const y = padding.top + (1 - (t/accMax)) * innerH
        return <line key={`g-${i}`} x1={padding.left} y1={y} x2={width-padding.right} y2={y} stroke="#eef2f7" />
      })}
      {/* axes labels */}
      {xTicks.map((i)=>{
        const x = padding.left + i * xStep
        return <text key={`xt-${i}`} x={x} y={height-6} textAnchor="middle" fontSize="11" fill="#64748b">{i===0?'Day 1':i===days.length-1?`Day ${days.length}`:`Day ${i+1}`}</text>
      })}
      {accTicks.map((t)=>{
        const y = padding.top + (1 - (t/accMax)) * innerH
        return <text key={`yt-a-${t}`} x={6} y={y+3} fontSize="11" fill="#64748b">{t}</text>
      })}
      {/* paths */}
      {timePath && <path d={timePath} fill="none" stroke="#16a34a" strokeWidth="2.25" />}
      {accPath && <path d={accPath} fill="none" stroke="#3b82f6" strokeWidth="2.25" />}
      {/* legends */}
      <g transform={`translate(${width-padding.right-160}, ${padding.top+4})`}>
        <circle cx="6" cy="6" r="4" fill="#3b82f6" />
        <text x="16" y="9" fontSize="12" fill="#0b1637">Accuracy (%)</text>
      </g>
      <g transform={`translate(${width-padding.right-160}, ${padding.top+22})`}>
        <circle cx="6" cy="6" r="4" fill="#16a34a" />
        <text x="16" y="9" fontSize="12" fill="#0b1637">Avg Time (s)</text>
      </g>
    </svg>
  )
}

function buildDemoTrend() {
  // Create gentle up-trending accuracy and slightly down-trending time
  const days = Array.from({ length: 30 }, (_, i) => {
    const accuracy = 70 + Math.round(8 * Math.sin(i / 4) + i * 0.4)
    const avgTimeS = 40 - Math.round(6 * Math.cos(i / 3) + i * 0.2)
    return {
      date: '',
      accuracy_pct: Math.max(40, Math.min(98, accuracy)),
      avg_time_ms: Math.max(20, avgTimeS) * 1000,
    }
  })
  return days
}


