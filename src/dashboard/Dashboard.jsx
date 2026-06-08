import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import { authHeaders, authenticatedFetch } from '../auth/token'
import { LuFlame, LuTimer, LuTarget, LuCirclePlay, LuBookOpen, LuTrophy, LuArrowRight, LuUserPlus, LuCheck, LuX, LuPencil, LuChevronDown } from 'react-icons/lu'
import LoadingScreen from '../components/loading/LoadingScreen'
import useStaleJson from '../utils/useStaleJson'
import {
  buildDemoTrend,
  aggregateTrendByWeekday,
  aggregateTrendByWeekdayForAccuracy,
  aggregateTrendByWeekdayForTime,
  renderQuestionsChart,
  renderAccuracyChartByWeekday,
  renderTimeChartByWeekday,
} from './insights/dashboardAnalyticsCharts.jsx'
import { getEmailDomain, isUniversityEmail } from '../utils/emailDomain.js'

/** px to scroll when a collapsible list opens — scales with item count */
function collapseExpandScrollOffset(itemCount) {
  const n = Math.max(1, itemCount)
  const base = 40
  const perItem = 52
  const max = 520
  return Math.min(max, base + n * perItem)
}

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
  const [leaderboardScope, setLeaderboardScope] = useState('friends') // friends | university

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
  const [leaderboardExpanded, setLeaderboardExpanded] = useState(false)
  const [friendsListExpanded, setFriendsListExpanded] = useState(false)
  const friendsListRef = useRef(null)
  const leaderboardListRef = useRef(null)
  const shouldScrollFriendsRef = useRef(false)
  const shouldScrollLeaderboardRef = useRef(false)
  const [isEditingTargets, setIsEditingTargets] = useState(null) // 'time' | 'questions' | null
  const [tempTargets, setTempTargets] = useState({ questions: 30, time_minutes: 180 })
  const editRef = useRef(null)
  const [isLeaderboardExpanded, setIsLeaderboardExpanded] = useState(false)
  const [isFriendsListExpanded, setIsFriendsListExpanded] = useState(false)

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
      const params = new URLSearchParams()
      if (selectedSpecialty !== 'all') params.set('specialty_id', selectedSpecialty)
      const query = params.toString()
      const basePath = leaderboardScope === 'university'
        ? `${API_BASE}/friends/university-leaderboard`
        : `${API_BASE}/friends/leaderboard`
      const url = query ? `${basePath}?${query}` : basePath
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

  const universityEligible = isUniversityEmail(user?.email)
  const universityDomain = getEmailDomain(user?.email)

  useEffect(() => {
    loadSpecialties()
  }, [])

  useEffect(() => {
    if (leaderboardScope === 'university' && !universityEligible) {
      setLeaderboardScope('friends')
    }
  }, [leaderboardScope, universityEligible])

  useEffect(() => {
    loadLeaderboard()
  }, [selectedSpecialty, leaderboardScope])

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

  const sortedLeaderboard = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      if (sortBy === 'accuracy_pct') {
        const aVal = a.accuracy_pct ?? -1
        const bVal = b.accuracy_pct ?? -1
        return bVal - aVal
      }
      return (b[sortBy] || 0) - (a[sortBy] || 0)
    })
  }, [leaderboard, sortBy])

  const visibleLeaderboard = leaderboardExpanded
    ? sortedLeaderboard
    : sortedLeaderboard.slice(0, 3)
  const hiddenLeaderboardCount = Math.max(0, sortedLeaderboard.length - 3)

  useEffect(() => {
    setLeaderboardExpanded(false)
  }, [selectedSpecialty, sortBy, leaderboardScope])

  const toggleFriendsList = () => {
    setFriendsListExpanded((prev) => {
      if (!prev) shouldScrollFriendsRef.current = true
      return !prev
    })
  }

  const toggleLeaderboardExpanded = () => {
    setLeaderboardExpanded((prev) => {
      if (!prev) shouldScrollLeaderboardRef.current = true
      return !prev
    })
  }

  useEffect(() => {
    if (!friendsListExpanded || !shouldScrollFriendsRef.current) return
    shouldScrollFriendsRef.current = false
    const scrollPx = collapseExpandScrollOffset(friends.length)
    requestAnimationFrame(() => {
      friendsListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      window.scrollBy({ top: scrollPx, behavior: 'smooth' })
    })
  }, [friendsListExpanded, friends.length])

  useEffect(() => {
    if (!leaderboardExpanded || !shouldScrollLeaderboardRef.current) return
    shouldScrollLeaderboardRef.current = false
    const scrollPx = collapseExpandScrollOffset(hiddenLeaderboardCount)
    requestAnimationFrame(() => {
      leaderboardListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      window.scrollBy({ top: scrollPx, behavior: 'smooth' })
    })
  }, [leaderboardExpanded, hiddenLeaderboardCount])

  const renderLeaderboardEntry = (entry, index) => {
    const isCurrentUser = entry.user_id === user?.id
    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null

    let scoreValue
    let scoreLabel
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
                  {universityEligible && (
                    <div className="db-filter db-filter--full">
                      <select
                        className="db-select"
                        value={leaderboardScope}
                        onChange={(e) => setLeaderboardScope(e.target.value)}
                      >
                        <option value="friends">Friends leaderboard</option>
                        <option value="university">
                          University leaderboard (@{universityDomain})
                        </option>
                      </select>
                    </div>
                  )}
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
                  <div className="db-empty">
                    {leaderboardScope === 'university'
                      ? `No students from @${universityDomain} on Synapse yet.`
                      : 'No data available. Add friends to compete!'}
                  </div>
                ) : (
                  <div className="db-leaderboard__list" ref={leaderboardListRef}>
                    {visibleLeaderboard.map((entry, index) => renderLeaderboardEntry(entry, index))}
                    {hiddenLeaderboardCount > 0 && (
                      <button
                        type="button"
                        className="db-collapse-toggle"
                        aria-expanded={leaderboardExpanded}
                        onClick={toggleLeaderboardExpanded}
                      >
                        {leaderboardExpanded
                          ? 'Show less'
                          : `See more (${hiddenLeaderboardCount})`}
                        <LuChevronDown
                          size={16}
                          className={`db-collapse-toggle__chevron ${leaderboardExpanded ? 'is-expanded' : ''}`}
                          aria-hidden
                        />
                      </button>
                    )}
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
              onClick={() => navigate('/dashboard/analytics')}
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
                {friendRequests.inbox?.length > 0 && (
                  <span className="db-friends__notification-dot" title={`${friendRequests.inbox.length} pending friend request(s)`}>
                    {friendRequests.inbox.length}
                  </span>
                )}
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
                  {friendRequests.inbox?.length > 0 && (
                    <span className="db-friends__tab-badge">
                      {friendRequests.inbox.length}
                    </span>
                  )}
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
                  {friendsLoading ? (
                    <div className="db-empty">Loading…</div>
                  ) : friends.length === 0 ? (
                    <div className="db-empty">No friends yet. Add someone by email above.</div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="db-collapse-toggle"
                        aria-expanded={friendsListExpanded}
                        onClick={toggleFriendsList}
                      >
                        {friendsListExpanded ? 'Hide friends list' : `See friends list (${friends.length})`}
                        <LuChevronDown
                          size={16}
                          className={`db-collapse-toggle__chevron ${friendsListExpanded ? 'is-expanded' : ''}`}
                          aria-hidden
                        />
                      </button>
                      {friendsListExpanded && (
                        <div className="db-list db-friends__list" ref={friendsListRef}>
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
                </>
              )}

                  {friendsTab === 'requests' && (
                    <>
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
