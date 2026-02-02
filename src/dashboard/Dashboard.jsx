import React, { useEffect, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import { authHeaders, authenticatedFetch } from '../auth/token'
import { LuFlame, LuTimer, LuTarget, LuCirclePlay, LuBookOpen, LuUserPlus, LuCheck, LuX, LuUsers, LuMail, LuTrash2, LuTrophy, LuAward } from 'react-icons/lu'
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
  const [friends, setFriends] = useState([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [friendsTab, setFriendsTab] = useState('friends') // friends | requests
  const [friendsError, setFriendsError] = useState('')
  const [friendsSuccess, setFriendsSuccess] = useState('')

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [specialties, setSpecialties] = useState([])
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [sortBy, setSortBy] = useState('total_answered') // total_answered | correct | accuracy_pct

  const [recentTopic, setRecentTopic] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, []);

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/textbook/topic-history`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
    })
      .then((res) => res.ok ? res.json() : Promise.reject())
      .then((data) => {
        if (!cancelled && Array.isArray(data?.items) && data.items.length > 0) {
          setRecentTopic(data.items[0])
        }
      })
      .catch(() => {
      })
    return () => { cancelled = true }
  }, [API_BASE])

  const loadFriendsData = async () => {
    try {
      setRequestsLoading(true)
      const reqRes = await authenticatedFetch(`${API_BASE}/friends/requests`)
      if (reqRes.ok) {
        const reqJson = await reqRes.json().catch(() => ({}))
        setRequests({ inbox: reqJson?.inbox || [], outbox: reqJson?.outbox || [] })
      } else {
        setRequests({ inbox: [], outbox: [] })
      }
    } catch (_e) {
      setRequests({ inbox: [], outbox: [] })
    } finally {
      setRequestsLoading(false)
    }
  }

  const loadFriendsList = async () => {
    try {
      setFriendsLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/friends`)
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setFriends(json?.friends || [])
      } else {
        setFriends([])
      }
    } catch (_e) {
      setFriends([])
    } finally {
      setFriendsLoading(false)
    }
  }

  const loadSpecialties = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/specialties`)
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setSpecialties(json?.specialties || [])
      } else {
        setSpecialties([])
      }
    } catch (_e) {
      setSpecialties([])
    }
  }

  const loadLeaderboard = async () => {
    try {
      setLeaderboardLoading(true)
      const url = selectedSpecialty === 'all'
        ? `${API_BASE}/friends/leaderboard`
        : `${API_BASE}/friends/leaderboard?specialty_id=${selectedSpecialty}`
      const res = await authenticatedFetch(url)
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setLeaderboard(json?.leaderboard || [])
      } else {
        setLeaderboard([])
      }
    } catch (_e) {
      setLeaderboard([])
    } finally {
      setLeaderboardLoading(false)
    }
  }

  useEffect(() => {
    loadFriendsData()
    loadFriendsList()
    loadSpecialties()
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedSpecialty])

  // Clear error/success messages when switching tabs
  useEffect(() => {
    setFriendsError('')
    setFriendsSuccess('')
  }, [friendsTab])

  const sendFriendRequest = async (e) => {
    e?.preventDefault?.()
    setFriendsError('')
    setFriendsSuccess('')

    const email = friendEmail.trim()
    if (!email) return

    // Check if user is already a friend
    const isAlreadyFriend = friends.some(f =>
      f.friend_email?.toLowerCase() === email.toLowerCase()
    )
    if (isAlreadyFriend) {
      setFriendsError('This user is already your friend')
      return
    }

    setSendLoading(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/friends/requests`, {
        method: 'POST',
        body: JSON.stringify({ email })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFriendsError(json?.error || 'Failed to send request')
      } else {
        setFriendEmail('')
        await loadFriendsData()
        setFriendsSuccess('Friend request sent successfully!')
        // Clear success message after 3 seconds
        setTimeout(() => setFriendsSuccess(''), 3000)
      }
    } catch (_e) {
      setFriendsError('Failed to send request. Please try again.')
    } finally {
      setSendLoading(false)
    }
  }

  const respondToRequest = async (requestId, action) => {
    setFriendsError('')
    setFriendsSuccess('')

    try {
      const res = await authenticatedFetch(`${API_BASE}/friends/requests/${requestId}/respond`, {
        method: 'POST',
        body: JSON.stringify({ action })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFriendsError(json?.error || 'Failed to update request')
      } else {
        await loadFriendsData()
        await loadFriendsList()

        // Show success message
        if (action === 'accept') {
          setFriendsSuccess('Friend request accepted!')
        } else if (action === 'decline') {
          setFriendsSuccess('Friend request declined')
        } else if (action === 'cancel') {
          setFriendsSuccess('Friend request cancelled')
        }

        // Clear success message after 3 seconds
        setTimeout(() => setFriendsSuccess(''), 3000)
      }
    } catch (_e) {
      setFriendsError('Failed to update request. Please try again.')
    }
  }

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
          <div className="qb-stat__value">{summary?.study_streak_days ?? 0} {summary?.study_streak_days === 1 ? 'day' : 'days'}</div>
          <div className="qb-stat__sub">Keep it up!</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Study Time</div><div className="qb-stat__icon"><LuTimer size={20} /></div></div>
          <div className="qb-stat__value">{summary?.time_today_minutes ?? 0} {summary?.time_today_minutes === 1 ? 'min' : 'mins'}</div>
          <div className="qb-stat__sub">Target: {summary?.targets?.time_minutes || 180} {summary?.targets?.time_minutes === 1 ? 'min' : 'mins'}</div>
        </div>
        <div className="qb-stat">
          <div className="qb-stat__top"><div className="qb-stat__title">Questions Today</div><div className="qb-stat__icon"><LuTarget size={20} /></div></div>
          <div className="qb-stat__value">{summary?.questions_today ?? 0}/{summary?.targets?.questions || 30}</div>
          <div className="db-progress"><div className="db-progress__fill" style={{ width: `${Math.min(100, Math.round((((summary?.questions_today || 0) / (summary?.targets?.questions || 30)) * 100)))}%` }} /></div>
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
          <button className="db-btn" onClick={() => {
            if (recentTopic?.topic_slug) {
              navigate(`/dashboard/textbook/topic/${recentTopic.topic_slug}`)
            } else {
              navigate('/dashboard/textbook')
            }
          }}>
            <div className="db-btn__left">
              <div className="db-btn__icon db-btn__icon--blue"><LuBookOpen size={18} /></div>
              <div>
                <div>{recentTopic ? 'Continue Reading' : 'Read Textbook'}</div>
                <div className="db-btn__meta">
                  {recentTopic?.topic_name
                    ? recentTopic.topic_name
                    : 'Browse chapters and topics'}
                </div>
              </div>
            </div>
            <span>›</span>
          </button>
        </div>
      </div>

      <div className="db-leaderboard-friends-grid">
        <div className="db-leaderboard">
          <div className="db-card">
            <div className="db-card__top">
              <div className="db-leaderboard__title">
                <LuTrophy size={18} />
                Leaderboard
              </div>
            </div>
            <div className="db-leaderboard__content">
              <div className="db-filters">
                <div className="db-filter">
                  <select
                    className="db-select"
                    value={selectedSpecialty}
                    onChange={(e) => setSelectedSpecialty(e.target.value)}
                  >
                    <option value="all">All Specialties</option>
                    {specialties.map((spec) => (
                      <option key={spec.specialty_id} value={spec.specialty_id}>
                        {spec.specialty_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="db-filter">
                  <select
                    className="db-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="total_answered">Sort by Total Answered</option>
                    <option value="correct">Sort by Correct Answers</option>
                    <option value="accuracy_pct">Sort by Accuracy</option>
                  </select>
                </div>
              </div>

              {leaderboardLoading ? (
                <div className="db-empty">Loading leaderboard…</div>
              ) : leaderboard.length === 0 ? (
                <div className="db-empty">No data available. Add friends to compete!</div>
              ) : (
                <div className="db-leaderboard__list">
                  {(() => {
                    // Sort leaderboard based on selected metric
                    const sorted = [...leaderboard].sort((a, b) => {
                      if (sortBy === 'accuracy_pct') {
                        const aVal = a.accuracy_pct ?? -1
                        const bVal = b.accuracy_pct ?? -1
                        return bVal - aVal
                      } else {
                        return (b[sortBy] || 0) - (a[sortBy] || 0)
                      }
                    })

                    return sorted.map((entry, index) => {
                      const isCurrentUser = entry.user_id === user?.id
                      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

                      // Determine what to show on the right based on sort
                      let scoreValue, scoreLabel
                      if (sortBy === 'accuracy_pct') {
                        scoreValue = entry.accuracy_pct !== null ? `${entry.accuracy_pct}%` : 'N/A'
                        scoreLabel = 'accuracy'
                      } else if (sortBy === 'correct') {
                        scoreValue = entry.correct || 0
                        scoreLabel = 'correct'
                      } else {
                        scoreValue = entry.total_answered || 0
                        scoreLabel = 'total'
                      }

                      return (
                        <div
                          key={entry.user_id}
                          className={`db-leaderboard__item ${isCurrentUser ? 'db-leaderboard__item--self' : ''}`}
                        >
                          <div className="db-leaderboard__rank">
                            {medal || `#${index + 1}`}
                          </div>
                          <div className="db-leaderboard__user">
                            <div className="db-leaderboard__username">
                              {entry.username || entry.email?.split('@')[0] || 'User'}
                              {isCurrentUser && <span className="db-leaderboard__you">(You)</span>}
                            </div>
                            <div className="db-leaderboard__stats">
                              {entry.total_answered} questions • {entry.accuracy_pct !== null ? `${entry.accuracy_pct}%` : 'N/A'} accuracy
                            </div>
                          </div>
                          <div className="db-leaderboard__score">
                            <div className="db-leaderboard__score-num">{scoreValue}</div>
                            <div className="db-leaderboard__score-label">{scoreLabel}</div>
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="db-friends">
          <div className="db-card">
            <div className="db-card__top">
              <div className="db-friends__title">Friends</div>
              <div className="db-tabs">
                <button className={`db-tab ${friendsTab === 'friends' ? 'is-active' : ''}`} onClick={() => setFriendsTab('friends')}>
                  <LuUsers size={14} />
                  <span>Friends</span>
                </button>
                <button className={`db-tab ${friendsTab === 'requests' ? 'is-active' : ''}`} onClick={() => setFriendsTab('requests')}>
                  <LuMail size={14} />
                  <span>Requests</span>
                  {(requests.inbox.length > 0) && <span className="db-tab__badge">{requests.inbox.length}</span>}
                </button>
              </div>
            </div>

            {friendsTab === 'friends' && (
              <div className="db-friends__content">
                {friendsError && (
                  <div className="db-friends__alert db-friends__alert--error">
                    <LuX size={16} />
                    {friendsError}
                  </div>
                )}
                {friendsSuccess && (
                  <div className="db-friends__alert db-friends__alert--success">
                    <LuCheck size={16} />
                    {friendsSuccess}
                  </div>
                )}
                <p className="db-friends__desc">Add friends by email to connect and compete with other users.</p>
                <form className="db-inputrow" onSubmit={sendFriendRequest}>
                  <input
                    type="email"
                    className="db-input"
                    placeholder="friend@example.com"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                  />
                  <button className="db-btn-primary" type="submit" disabled={sendLoading || !friendEmail.trim()}>
                    {sendLoading ? 'Sending…' : 'Send Request'}
                  </button>
                </form>

                <div className="db-friends__divider" />

                {friendsLoading ? (
                  <div className="db-empty">Loading friends…</div>
                ) : (
                  <div>
                    <div className="db-subheading">
                      <LuUsers size={14} />
                      Your Friends ({friends.length})
                    </div>
                    <div className="db-list">
                      {friends.length === 0 && <div className="db-empty">No friends yet. Send some requests!</div>}
                      {friends.map((f) => (
                        <div key={f.id} className="db-list__item db-list__item--friend">
                          <div className="db-list__main">
                            <div className="db-list__title">{f.friend_username || f.friend_email?.split('@')[0] || 'User'}</div>
                            <div className="db-list__sub">{f.friend_email}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {friendsTab === 'requests' && (
              <div className="db-friends__content">
                {friendsError && (
                  <div className="db-friends__alert db-friends__alert--error">
                    <LuX size={16} />
                    {friendsError}
                  </div>
                )}
                {friendsSuccess && (
                  <div className="db-friends__alert db-friends__alert--success">
                    <LuCheck size={16} />
                    {friendsSuccess}
                  </div>
                )}
                {requestsLoading ? (
                  <div className="db-empty">Loading requests…</div>
                ) : (
                  <div className="db-twoCols">
                    <div>
                      <div className="db-subheading">
                        <LuMail size={14} />
                        Received ({requests.inbox.length})
                      </div>
                      <div className="db-list">
                        {(requests.inbox || []).length === 0 && <div className="db-empty">No pending requests</div>}
                        {(requests.inbox || []).map((r) => (
                          <div key={r.id} className="db-list__item db-list__item--request">
                            <div className="db-list__main">
                              <div className="db-list__title">{r.requester?.username || r.requester?.email?.split('@')[0] || 'User'}</div>
                              <div className="db-list__sub">{r.requester?.email}</div>
                            </div>
                            <div className="db-list__actions">
                              <button className="db-chip db-chip--accept" onClick={() => respondToRequest(r.id, 'accept')} title="Accept">
                                <LuCheck size={16} />
                              </button>
                              <button className="db-chip db-chip--decline" onClick={() => respondToRequest(r.id, 'decline')} title="Decline">
                                <LuX size={16} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="db-requests-divider" />
                    <div>
                      <div className="db-subheading">
                        <LuMail size={14} />
                        Sent ({requests.outbox.length})
                      </div>
                      <div className="db-list">
                        {(requests.outbox || []).length === 0 && <div className="db-empty">No pending requests</div>}
                        {(requests.outbox || []).map((r) => (
                          <div key={r.id} className="db-list__item db-list__item--request">
                            <div className="db-list__main">
                              <div className="db-list__title">{r.target?.username || r.target?.email?.split('@')[0] || 'User'}</div>
                              <div className="db-list__sub">{r.target?.email}</div>
                            </div>
                            <div className="db-list__actions">
                              <button className="db-chip db-chip--neutral" onClick={() => respondToRequest(r.id, 'cancel')}>
                                <LuTrash2 size={14} />
                                Cancel
                              </button>
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
        </div>
      </div>

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

  const xTicks = [0, Math.floor(days.length / 2), days.length - 1].filter(v => v >= 0)
  const accTicks = [0, 25, 50, 75, 100]
  const timeTicks = [0, Math.round(timeMax * 0.33), Math.round(timeMax * 0.66), timeMax]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Performance trend chart">
      <rect x="0" y="0" width={width} height={height} fill="#fff" rx="12" />
      {/* grid */}
      {accTicks.map((t, i) => {
        const y = padding.top + (1 - (t / accMax)) * innerH
        return <line key={`g-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#eef2f7" />
      })}
      {/* axes labels */}
      {xTicks.map((i) => {
        const x = padding.left + i * xStep
        return <text key={`xt-${i}`} x={x} y={height - 6} textAnchor="middle" fontSize="11" fill="#64748b">{i === 0 ? 'Day 1' : i === days.length - 1 ? `Day ${days.length}` : `Day ${i + 1}`}</text>
      })}
      {accTicks.map((t) => {
        const y = padding.top + (1 - (t / accMax)) * innerH
        return <text key={`yt-a-${t}`} x={6} y={y + 3} fontSize="11" fill="#64748b">{t}</text>
      })}
      {/* paths */}
      {timePath && <path d={timePath} fill="none" stroke="#16a34a" strokeWidth="2.25" />}
      {accPath && <path d={accPath} fill="none" stroke="#3b82f6" strokeWidth="2.25" />}
      {/* legends */}
      <g transform={`translate(${width - padding.right - 160}, ${padding.top + 4})`}>
        <circle cx="6" cy="6" r="4" fill="#3b82f6" />
        <text x="16" y="9" fontSize="12" fill="#0b1637">Accuracy (%)</text>
      </g>
      <g transform={`translate(${width - padding.right - 160}, ${padding.top + 22})`}>
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


