import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import { authHeaders, authenticatedFetch } from '../auth/token'
import { LuFlame, LuTimer, LuTarget, LuCirclePlay, LuBookOpen, LuTrophy, LuArrowRight, LuUserPlus, LuCheck, LuX, LuPencil } from 'react-icons/lu'
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
  // Analytics: /qbank/performance/trend (from user_question_attempts) → questions_answered, accuracy_pct, avg_time_ms per day
  const trendReq = useStaleJson(`${API_BASE}/qbank/performance/trend`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'dashboard:trend',
    transform: (t) => ({
      days: Array.isArray(t.days)
        ? t.days.map((d) => ({
          date: d.date,
          questions_answered: d.questions_answered ?? 0,
          accuracy_pct: d.accuracy_pct ?? null,
          avg_time_ms: d.avg_time_ms ?? null,
        }))
        : buildDemoTrend(),
    }),
  })

  const summary = summaryReq.data || { study_streak_days: 0, time_today_minutes: 0, questions_today: 0, last_specialty: null, targets: { time_minutes: 180, questions: 30 } }
  // Topic-based analytics: /qbank/topics (accuracy_pct, avg_time_ms per topic)
  const topicsReq = useStaleJson(`${API_BASE}/qbank/topics?limit=50`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'dashboard:topics',
    transform: (t) => ({ topics: Array.isArray(t?.topics) ? t.topics : [] }),
  })
  const topicCards = topicsReq.data?.topics ?? []
  const topicCardsWithAttempts = topicCards.filter((t) => (t.attempted_questions ?? 0) > 0).sort((a, b) => (b.attempted_questions ?? 0) - (a.attempted_questions ?? 0)).slice(0, 12)
  const topicsLoading = topicsReq.loading && !topicsReq.data

  // Use API trend when available (real analytics); demo only while loading or on error
  const trend = trendReq.data?.days ?? buildDemoTrend()
  const trendLoading = trendReq.loading && !trendReq.data
  const loading = summaryReq.loading && !summaryReq.data

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([])
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)
  const [specialties, setSpecialties] = useState([])
  const [selectedSpecialty, setSelectedSpecialty] = useState('all')
  const [sortBy, setSortBy] = useState('total_answered') // total_answered | correct | accuracy_pct

  const [recentTopic, setRecentTopic] = useState(null)
  const [analyticsChart, setAnalyticsChart] = useState('questions') // 'questions' | 'accuracy' | 'time'

  // Friends state
  const [friends, setFriends] = useState([])
  const [friendRequests, setFriendRequests] = useState({ inbox: [], outbox: [] })
  const [friendsLoading, setFriendsLoading] = useState(true)
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [friendEmail, setFriendEmail] = useState('')
  const [friendMessage, setFriendMessage] = useState(null) // { type: 'success'|'error', text }
  const [respondingId, setRespondingId] = useState(null)
  const [friendsTab, setFriendsTab] = useState('friends') // 'friends' | 'requests'
  const [isEditingTargets, setIsEditingTargets] = useState(null) // 'time' | 'questions' | null
  const [tempTargets, setTempTargets] = useState({ questions: 30, time_minutes: 180 })
  const editRef = useRef(null)

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
    loadSpecialties()
  }, [])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedSpecialty])

  const loadFriends = async () => {
    try {
      setFriendsLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/friends`)
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setFriends(json?.friends ?? [])
      } else {
        setFriends([])
      }
    } catch (_e) {
      setFriends([])
    } finally {
      setFriendsLoading(false)
    }
  }

  const loadFriendRequests = async () => {
    try {
      setRequestsLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/friends/requests`)
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        setFriendRequests({ inbox: json?.inbox ?? [], outbox: json?.outbox ?? [] })
      } else {
        setFriendRequests({ inbox: [], outbox: [] })
      }
    } catch (_e) {
      setFriendRequests({ inbox: [], outbox: [] })
    } finally {
      setRequestsLoading(false)
    }
  }

  const sendFriendRequest = async (e) => {
    e.preventDefault()
    const email = (friendEmail || '').trim().toLowerCase()
    if (!email) {
      setFriendMessage({ type: 'error', text: 'Enter an email address' })
      return
    }
    setFriendMessage(null)
    try {
      const res = await authenticatedFetch(`${API_BASE}/friends/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setFriendEmail('')
        setFriendMessage({ type: 'success', text: 'Friend request sent' })
        loadFriendRequests()
      } else {
        setFriendMessage({ type: 'error', text: json?.error || 'Failed to send request' })
      }
    } catch (_e) {
      setFriendMessage({ type: 'error', text: 'Failed to send request' })
    }
  }

  const respondToRequest = async (requestId, action) => {
    setRespondingId(requestId)
    try {
      const res = await authenticatedFetch(`${API_BASE}/friends/requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        loadFriendRequests()
        loadFriends()
        loadLeaderboard()
      }
    } finally {
      setRespondingId(null)
    }
  }

  useEffect(() => {
    loadFriends()
    loadFriendRequests()
  }, [API_BASE])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedSpecialty])

  const continueQuestions = () => {
    const spec = summary.last_specialty
    if (spec?.id) {
      navigate(`/dashboard/question-bank/setup?specialty_id=${spec.id}&specialty_name=${encodeURIComponent(spec.name || 'Specialty')}`)
    } else {
      navigate('/dashboard/question-bank')
    }
  }
  
  const startEditingTargets = (type) => {
    setTempTargets({
      questions: summary?.targets?.questions || 30,
      time_minutes: summary?.targets?.time_minutes || 180
    })
    setIsEditingTargets(type)
  }

  // Click-away to save
  useEffect(() => {
    if (!isEditingTargets) return;
    const handleClickOutside = (e) => {
      if (editRef.current && !editRef.current.contains(e.target)) {
        saveTargets();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isEditingTargets, tempTargets, summary]); // include summary/tempTargets to ensure saveTargets has fresh state if it's not a callback

  const saveTargets = async () => {
    if (!isEditingTargets) return;
    // Optimistic update
    const previousTargets = { ...summary.targets }
    const questionsVal = parseInt(tempTargets.questions) || 30
    const timeVal = parseInt(tempTargets.time_minutes) || 180
    
    summary.targets = {
      questions: questionsVal,
      time_minutes: timeVal
    }
    setIsEditingTargets(null)

    try {
      const res = await authenticatedFetch(`${API_BASE}/me/targets`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          daily_question_target: questionsVal,
          daily_study_minutes_target: timeVal
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
    } catch (e) {
      console.error('Failed to save targets:', e)
      // Rollback
      summary.targets = previousTargets
      alert('Failed to save targets. Please try again.')
    }
  }

  const handleTargetKeyDown = (e) => {
    if (e.key === 'Enter') {
      saveTargets()
    } else if (e.key === 'Escape') {
      setIsEditingTargets(null)
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
        
        <div 
          className={`qb-stat ${isEditingTargets === 'time' ? 'is-editing' : 'is-clickable'}`} 
          onClick={!isEditingTargets ? () => startEditingTargets('time') : undefined}
          ref={isEditingTargets === 'time' ? editRef : null}
        >
          <div className="qb-stat__top">
            <div className="qb-stat__title">Focused study</div>
            <div className="qb-stat__icon">
              <LuTimer size={20} />
            </div>
          </div>
          <div className="qb-stat__value">
            {summary?.time_today_minutes ?? 0} mins
          </div>
          <div className="qb-stat__sub">
            {isEditingTargets === 'time' ? (
              <div className="qb-stat__input-wrap">
                Target: 
                <input
                  type="number"
                  className="qb-stat__input"
                  value={tempTargets.time_minutes}
                  onChange={(e) => setTempTargets({ ...tempTargets, time_minutes: e.target.value })}
                  onKeyDown={handleTargetKeyDown}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                mins
              </div>
            ) : (
              <div className="qb-stat__target-wrap">
                Target: {summary?.targets?.time_minutes || 180} {summary?.targets?.time_minutes === 1 ? 'min' : 'mins'}
                <LuPencil className="qb-stat__edit-hint" size={12} />
              </div>
            )}
          </div>
          
          {isEditingTargets === 'time' && (
            <div className="qb-stat__edit-actions">
              <button className="qb-stat__action qb-stat__action--save" onClick={(e) => { e.stopPropagation(); saveTargets(); }} title="Save">
                <LuCheck size={18} />
              </button>
              <button className="qb-stat__action qb-stat__action--cancel" onClick={(e) => { e.stopPropagation(); setIsEditingTargets(null); }} title="Cancel">
                <LuX size={18} />
              </button>
            </div>
          )}
        </div>
        
        <div 
          className={`qb-stat ${isEditingTargets === 'questions' ? 'is-editing' : 'is-clickable'}`} 
          onClick={!isEditingTargets ? () => startEditingTargets('questions') : undefined}
          ref={isEditingTargets === 'questions' ? editRef : null}
        >
          <div className="qb-stat__top"><div className="qb-stat__title">Questions Completed</div><div className="qb-stat__icon"><LuTarget size={20} /></div></div>
          <div className="qb-stat__value">
            {summary?.questions_today ?? 0}/
            {isEditingTargets === 'questions' ? (
              <input
                type="number"
                className="qb-stat__input qb-stat__input--large"
                value={tempTargets.questions}
                onChange={(e) => setTempTargets({ ...tempTargets, questions: e.target.value })}
                onKeyDown={handleTargetKeyDown}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{summary?.targets?.questions || 30}</span>
            )}
          </div>
          <div className="qb-stat__sub">
            <div className="qb-stat__progress">
              <div 
                className="qb-stat__progress-bar" 
                style={{ width: `${Math.min(100, Math.round((((summary?.questions_today || 0) / (summary?.targets?.questions || 30)) * 100)))}%` }}
              ></div>
            </div>
            {!isEditingTargets && <LuPencil className="qb-stat__edit-hint qb-stat__edit-hint--float" size={12} />}
          </div>

          {isEditingTargets === 'questions' && (
            <div className="qb-stat__edit-actions">
              <button className="qb-stat__action qb-stat__action--save" onClick={(e) => { e.stopPropagation(); saveTargets(); }} title="Save">
                <LuCheck size={18} />
              </button>
              <button className="qb-stat__action qb-stat__action--cancel" onClick={(e) => { e.stopPropagation(); setIsEditingTargets(null); }} title="Cancel">
                <LuX size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="db-split">
        <div className="db-split__left">
          <div className="db-qa">
            <div className="db-qa__title">Quick Actions</div>
            <div className="db-qa__sub">Jump back into your learning journey</div>
            <div className="db-qa__actions db-qa__actions--stacked">
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
        </div>

        <aside className="db-analytics">
          <div className="db-card db-analytics__card">
            <div className="db-analytics__head">Analytics</div>
            <div className="db-analytics__tabs">
              <button
                type="button"
                className={`db-analytics__tab ${analyticsChart === 'questions' ? 'is-active' : ''}`}
                onClick={() => setAnalyticsChart('questions')}
              >
                Questions
              </button>
              <button
                type="button"
                className={`db-analytics__tab ${analyticsChart === 'accuracy' ? 'is-active' : ''}`}
                onClick={() => setAnalyticsChart('accuracy')}
              >
                Accuracy
              </button>
              <button
                type="button"
                className={`db-analytics__tab ${analyticsChart === 'time' ? 'is-active' : ''}`}
                onClick={() => setAnalyticsChart('time')}
              >
                Time
              </button>
            </div>
            <div className="db-analytics__graph">
              {analyticsChart === 'questions' && (trendLoading ? <div className="db-analytics__graph-loading">Loading analytics…</div> : renderQuestionsChart(aggregateTrendByWeekday(trend)))}
              {analyticsChart === 'accuracy' && (trendLoading ? <div className="db-analytics__graph-loading">Loading analytics…</div> : renderAccuracyChartByWeekday(aggregateTrendByWeekdayForAccuracy(trend)))}
              {analyticsChart === 'time' && (trendLoading ? <div className="db-analytics__graph-loading">Loading analytics…</div> : renderTimeChartByWeekday(aggregateTrendByWeekdayForTime(trend)))}
            </div>
            <p className="db-analytics__copy">
              {analyticsChart === 'questions' && 'Track how many questions you answer each day. Consistency helps build long-term retention and improves exam readiness.'}
              {analyticsChart === 'accuracy' && 'See which days you perform best. Higher accuracy on certain weekdays can help you plan when to do practice exams.'}
              {analyticsChart === 'time' && "Average time per question by day of week. Spot days when you're quicker or need more focus."}
            </p>
            <button
              type="button"
              className="db-analytics__view-btn"
              onClick={() => navigate('/dashboard')}
            >
              View analytics
              <LuArrowRight size={12} />
            </button>
          </div>

          <div className="db-card db-friends__card">
            <div className="db-card__top">
              <div className="db-friends__title">
                <LuUserPlus size={18} />
                Friends
              </div>
            </div>
            <div className="db-friends__content">
              <div className="db-analytics__tabs db-friends__tabs">
                <button
                  type="button"
                  className={`db-analytics__tab ${friendsTab === 'friends' ? 'is-active' : ''}`}
                  onClick={() => setFriendsTab('friends')}
                >
                  Friends
                </button>
                <button
                  type="button"
                  className={`db-analytics__tab ${friendsTab === 'requests' ? 'is-active' : ''}`}
                  onClick={() => setFriendsTab('requests')}
                >
                  Requests
                </button>
              </div>

              <p className="db-friends__desc">
                Add friends by email to see them on the leaderboard and compete together.
              </p>
              {friendMessage && (
                <div className={`db-friends__alert db-friends__alert--${friendMessage.type}`}>
                  {friendMessage.text}
                </div>
              )}
              <form className="db-inputrow" onSubmit={sendFriendRequest}>
                <input
                  type="email"
                  className="db-input"
                  placeholder="Friend's email"
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  aria-label="Friend email"
                />
                <button type="submit" className="db-btn--small db-btn-primary" disabled={!friendEmail.trim()}>
                  Add
                </button>
              </form>

              <div className="db-friends__divider" />

              {friendsTab === 'friends' && (
                <>
                  <div className="db-subheading">Your friends</div>
                  {friendsLoading ? (
                    <div className="db-empty">Loading…</div>
                  ) : friends.length === 0 ? (
                    <div className="db-empty">No friends yet. Add someone by email above.</div>
                  ) : (
                    <div className="db-list">
                      {friends.map((f) => (
                        <div key={f.id} className="db-list__item db-list__item--friend">
                          <div className="db-list__main">
                            <div className="db-list__title">{f.friend_username || f.friend_email || 'Friend'}</div>
                            <div className="db-list__sub">{f.friend_email}</div>
                          </div>
                          <span className="db-friend-badge">Friends</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {friendsTab === 'requests' && (
                <>
                  <div className="db-subheading">Requests</div>
                  {requestsLoading ? (
                    <div className="db-empty">Loading…</div>
                  ) : (friendRequests.inbox?.length === 0 && friendRequests.outbox?.length === 0) ? (
                    <div className="db-empty">No pending requests.</div>
                  ) : (
                    <div className="db-list">
                      {friendRequests.inbox?.map((r) => (
                        <div key={r.id} className="db-list__item">
                          <div className="db-list__main">
                            <div className="db-list__title">{r.requester?.username || r.requester?.email || 'Someone'}</div>
                            <div className="db-list__sub">Wants to be your friend</div>
                          </div>
                          <div className="db-list__actions">
                            <button
                              type="button"
                              className="db-chip db-chip--accept"
                              onClick={() => respondToRequest(r.id, 'accept')}
                              disabled={respondingId === r.id}
                              aria-label="Accept"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="db-chip db-chip--decline"
                              onClick={() => respondToRequest(r.id, 'decline')}
                              disabled={respondingId === r.id}
                              aria-label="Decline"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                      {friendRequests.outbox?.map((r) => (
                        <div key={r.id} className="db-list__item">
                          <div className="db-list__main">
                            <div className="db-list__title">{r.target?.username || r.target?.email || 'User'}</div>
                            <div className="db-list__sub">Pending</div>
                          </div>
                          <button
                            type="button"
                            className="db-chip db-chip--neutral"
                            onClick={() => respondToRequest(r.id, 'cancel')}
                            disabled={respondingId === r.id}
                          >
                            Cancel
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

    </div>
  )
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Saturday first, then Sunday … Friday. Index 0 = Sat, 1 = Sun, …, 6 = Fri */
const WEEKDAY_ORDER = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

function dayOfWeek(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'Z')
  return DAY_NAMES[d.getUTCDay()] || ''
}

/** Map date to weekday index: Sat=0, Sun=1, …, Fri=6 */
function weekdayIndex(dateStr) {
  if (!dateStr) return -1
  const d = new Date(dateStr + 'Z')
  const jsDay = d.getUTCDay() // 0=Sun, 1=Mon, ..., 6=Sat
  return (jsDay + 1) % 7 // Sat=0, Sun=1, ..., Fri=6
}

/** Aggregate trend days by weekday (Sat..Fri); returns 7 entries with dayName and avgQuestions */
function aggregateTrendByWeekday(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    if (idx >= 0) {
      sums[idx] += d.questions_answered ?? 0
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgQuestions: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

/** Aggregate accuracy by weekday (Sat..Fri); returns 7 entries with dayName and avgAccuracy (0–100) */
function aggregateTrendByWeekdayForAccuracy(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    const acc = d.accuracy_pct != null ? Number(d.accuracy_pct) : null
    if (idx >= 0 && acc != null) {
      sums[idx] += acc
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgAccuracy: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

/** Aggregate time by weekday (Sat..Fri); returns 7 entries with dayName and avgTimeSeconds */
function aggregateTrendByWeekdayForTime(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    const ms = d.avg_time_ms != null ? Number(d.avg_time_ms) : null
    if (idx >= 0 && ms != null) {
      sums[idx] += ms / 1000
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgTimeSeconds: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

function renderQuestionsChart(weekDayStats) {
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = (weekDayStats || []).map((d) => d.avgQuestions ?? 0)
  const n = Math.max(1, vals.length)
  const maxVal = Math.max(1, ...vals)
  const xStep = innerW / Math.max(n - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average questions by day of week">
      <defs>
        <linearGradient id="q-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--syn-cyan)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--syn-cyan)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill="url(#q-gradient)" />}
      {linePath && <path d={linePath} fill="none" stroke="var(--syn-cyan)" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayName = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        const v = vals[i]
        const tooltip = `${dayName}: ${v} question${v === 1 ? '' : 's'} on average`
        return (
          <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke="var(--syn-cyan)" strokeWidth={2.5}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}</text>
          </g>
        )
      })}
      {vals.map((_, i) => {
        const x = pad.left + i * xStep
        const label = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function renderAccuracyChartByWeekday(weekDayStats) {
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = (weekDayStats || []).map((d) => d.avgAccuracy ?? 0)
  const n = Math.max(1, vals.length)
  const maxVal = 100
  const xStep = innerW / Math.max(n - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, 25, 50, 75, 100]
  const gradientId = 'acc-wd-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average accuracy by day of week">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayName = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        const v = vals[i]
        const tooltip = `${dayName}: ${v}% accuracy on average`
        return (
          <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke="#3b82f6" strokeWidth={2.5}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}%</text>
          </g>
        )
      })}
      {vals.map((_, i) => {
        const x = pad.left + i * xStep
        const label = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function renderTimeChartByWeekday(weekDayStats) {
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = (weekDayStats || []).map((d) => d.avgTimeSeconds ?? 0)
  const n = Math.max(1, vals.length)
  const timeMax = Math.max(60, ...vals, 1)
  const xStep = innerW / Math.max(n - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - ((v ?? 0) / timeMax)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.round(timeMax / 3), Math.round((2 * timeMax) / 3), timeMax].filter((v, i, a) => a.indexOf(v) === i)
  const gradientId = 'time-wd-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average time per question by day of week">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayName = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        const v = vals[i]
        const tooltip = `${dayName}: ${v}s per question on average`
        return (
          <circle key={i} cx={x} cy={y} r={5} fill="#fff" stroke="#16a34a" strokeWidth={2.5}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / timeMax)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}s</text>
          </g>
        )
      })}
      {vals.map((_, i) => {
        const x = pad.left + i * xStep
        const label = weekDayStats[i]?.dayName ?? WEEKDAY_ORDER[i]
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function renderAccuracyChart(days) {
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = days.map((d) => d.accuracy_pct ?? 0)
  const maxVal = 100
  const xStep = innerW / Math.max(days.length - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, 25, 50, 75, 100]
  const xTickIndices = days.length > 0 ? [0, Math.floor(days.length / 4), Math.floor(days.length / 2), Math.floor((3 * days.length) / 4), days.length - 1].filter((v, i, a) => a.indexOf(v) === i) : []
  const gradientId = 'acc-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy over time">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayLabel = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        const tooltip = `${dayLabel}: ${vals[i]}%`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}</text>
          </g>
        )
      })}
      {xTickIndices.map((i) => {
        const x = pad.left + i * xStep
        const label = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function renderTimeChart(days) {
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = days.map((d) => (d.avg_time_ms != null ? Math.round(d.avg_time_ms / 1000) : 0))
  const timeMax = Math.max(60, ...vals, 0)
  const xStep = innerW / Math.max(days.length - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - ((v ?? 0) / timeMax)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.round(timeMax / 3), Math.round((2 * timeMax) / 3), timeMax].filter((v, i, a) => a.indexOf(v) === i)
  const xTickIndices = days.length > 0 ? [0, Math.floor(days.length / 4), Math.floor(days.length / 2), Math.floor((3 * days.length) / 4), days.length - 1].filter((v, i, a) => a.indexOf(v) === i) : []
  const gradientId = 'time-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average time per question">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayLabel = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        const tooltip = `${dayLabel}: ${vals[i]}s`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#16a34a" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / timeMax)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}s</text>
          </g>
        )
      })}
      {xTickIndices.map((i) => {
        const x = pad.left + i * xStep
        const label = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function truncateTopicLabel(name, maxLen = 10) {
  if (!name) return ''
  return name.length <= maxLen ? name : name.slice(0, maxLen) + '…'
}

function renderAccuracyChartByTopic(topicCards) {
  const w = 560
  const h = 220
  const pad = { top: 12, right: 20, bottom: 34, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const baselineY = pad.top + innerH
  if (topicCards.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy by topic">
        <text x={w / 2} y={h / 2} fontSize={13} fill="#64748b" textAnchor="middle">Answer questions to see accuracy by topic</text>
      </svg>
    )
  }
  const vals = topicCards.map((t) => (t.accuracy_pct != null ? Number(t.accuracy_pct) : 0))
  const maxVal = Math.max(100, ...vals)
  const xStep = innerW / Math.max(topicCards.length - 1, 1)
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, 25, 50, 75, 100]
  const gradientId = 'acc-topic-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy by topic">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const t = topicCards[i]
        const topicName = t?.topic_name || 'Topic'
        const pct = vals[i]
        const tooltip = `${topicName}: ${pct}%`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}%</text>
          </g>
        )
      })}
      {topicCards.map((t, i) => {
        const x = pad.left + i * xStep
        const label = truncateTopicLabel(t.topic_name || 'Topic', 14)
        return (
          <g key={t.topic_id || i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 8} fontSize={8} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function renderTimeChartByTopic(topicCards) {
  const w = 560
  const h = 220
  const pad = { top: 12, right: 20, bottom: 34, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const baselineY = pad.top + innerH
  if (topicCards.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Time by topic">
        <text x={w / 2} y={h / 2} fontSize={13} fill="#64748b" textAnchor="middle">Answer questions to see time by topic</text>
      </svg>
    )
  }
  const vals = topicCards.map((t) => (t.avg_time_ms != null ? Math.round(t.avg_time_ms / 1000) : 0))
  const timeMax = Math.max(60, ...vals)
  const xStep = innerW / Math.max(topicCards.length - 1, 1)
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / timeMax)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.round(timeMax / 3), Math.round((2 * timeMax) / 3), timeMax].filter((v, i, a) => a.indexOf(v) === i)
  const gradientId = 'time-topic-gradient'
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Time by topic">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gradientId})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const t = topicCards[i]
        const topicName = t?.topic_name || 'Topic'
        const secs = vals[i]
        const tooltip = `${topicName}: ${secs}s`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#16a34a" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / timeMax)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="#64748b" textAnchor="end">{tick}s</text>
          </g>
        )
      })}
      {topicCards.map((t, i) => {
        const x = pad.left + i * xStep
        const label = truncateTopicLabel(t.topic_name || 'Topic', 14)
        return (
          <g key={t.topic_id || i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 8} fontSize={8} fill="#64748b" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
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
  const now = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - (29 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const accuracy = 70 + Math.round(8 * Math.sin(i / 4) + i * 0.4)
    const avgTimeS = 40 - Math.round(6 * Math.cos(i / 3) + i * 0.2)
    const questions = Math.round(15 + 12 * Math.sin(i / 5) + i * 0.3)
    return {
      date: dateStr,
      questions_answered: Math.max(0, questions),
      accuracy_pct: Math.max(40, Math.min(98, accuracy)),
      avg_time_ms: Math.max(20, avgTimeS) * 1000,
    }
  })
  return days
}


