import React, { useEffect, useState, useRef } from 'react'
import { authHeaders, authenticatedFetch, getAccessToken, getRefreshToken, setTokens } from '../../auth/token'
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom'
import { LuChevronLeft, LuUsers, LuCopy, LuCheck, LuPlay, LuCrown, LuUser, LuLayers, LuBookOpen, LuSettings } from 'react-icons/lu'
import './PracticeSetup.css'
import './GroupStudySetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { io } from 'socket.io-client'

export default function GroupStudySetup() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const isReviewer = !!user?.capabilities?.can_review
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') // 'join' or null (create mode)

  const [loading, setLoading] = useState(true)
  const [studySetData, setStudySetData] = useState(null)

  // Question source choices
  const [sessionSource, setSessionSource] = useState('set') // 'set' or 'specialty'

  // Lists
  const [studySets, setStudySets] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [topics, setTopics] = useState([])

  // Selections
  const [selectedStudySetId, setSelectedStudySetId] = useState('')
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('')
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [topicsLoading, setTopicsLoading] = useState(false)

  // Session settings
  const [numQuestions, setNumQuestions] = useState(25)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [includeAttempted, setIncludeAttempted] = useState(false)
  const [includeIncorrect, setIncludeIncorrect] = useState(false)

  // Group session state
  const [roomCode, setRoomCode] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [sessionCreated, setSessionCreated] = useState(false)
  const [participants, setParticipants] = useState([])
  const [copied, setCopied] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  const socketRef = useRef(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const SOCKET_URL = API_BASE.replace(/^http/, 'ws').replace(/:\d+$/, ':4000')

  useEffect(() => {
    if (mode === 'join') {
      setLoading(false)
      return
    }

    const loadInitialData = async () => {
      try {
        setLoading(true)

        // Fetch custom study sets and specialties
        const [setsRes, specsRes] = await Promise.all([
          authenticatedFetch(`${API_BASE}/qbank/sets`, { headers: authHeaders() }),
          authenticatedFetch(`${API_BASE}/qbank/specialties/list`, { headers: authHeaders() })
        ])

        let sets = []
        if (setsRes.ok) {
          const setsData = await setsRes.json()
          sets = setsData.sets || []
          setStudySets(sets)
        }

        let specs = []
        if (specsRes.ok) {
          const specsData = await specsRes.json()
          specs = specsData.specialties || []
          setSpecialties(specs)
        }

        // Parse query params (pre-population)
        const qStudySetId = searchParams.get('study_set_id')
        const qSpecialtyId = searchParams.get('specialty_id')
        const qNumQs = searchParams.get('num_questions')
        const qTimerMins = searchParams.get('timer_minutes')
        const qIncAtt = searchParams.get('include_attempted') === '1'
        const qIncInc = searchParams.get('include_incorrect') === '1' || searchParams.get('incorrect_only') === '1'

        if (qNumQs) setNumQuestions(parseInt(qNumQs, 10))
        if (qTimerMins) {
          const mins = parseInt(qTimerMins, 10)
          setTimerMinutes(mins > 0 ? mins : 30)
          setTimerEnabled(mins > 0)
        }
        setIncludeAttempted(qIncAtt)
        setIncludeIncorrect(qIncInc)

        if (qStudySetId) {
          setSessionSource('set')
          setSelectedStudySetId(qStudySetId)
          await fetchSetDetails(qStudySetId)
        } else if (qSpecialtyId) {
          setSessionSource('specialty')
          setSelectedSpecialtyId(qSpecialtyId)
          await fetchTopicsList(qSpecialtyId, searchParams.get('topic_ids'))
        } else {
          // Default selection if no search query (keep empty so it's disabled at first)
          setSessionSource('set')
          setSelectedStudySetId('')
          setSelectedSpecialtyId('')
        }
      } catch (err) {
        console.error('Error loading group session setup data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [mode, searchParams])

  useEffect(() => {
    // Initialize socket connection when session is created or joined
    if (sessionCreated && roomCode) {
      connectSocket()
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [sessionCreated, roomCode])

  const fetchSetDetails = async (setId) => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${setId}`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch study set details')
      const data = await res.json()
      setStudySetData(data.set)
    } catch (err) {
      console.error('Error fetching set details:', err)
    }
  }

  const fetchTopicsList = async (specId, topicIdsParam = null) => {
    try {
      setTopicsLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/qbank/specialty/${specId}/topics`, {
        headers: authHeaders()
      })
      if (!res.ok) throw new Error('Failed to fetch topics')
      const data = await res.json()
      const loadedTopics = data.topics || []
      setTopics(loadedTopics)

      if (topicIdsParam) {
        const preselected = new Set(topicIdsParam.split(',').map(id => id.trim()).filter(Boolean))
        setSelectedTopics(preselected)
      } else {
        // Select all topics by default
        setSelectedTopics(new Set(loadedTopics.map(t => t.id)))
      }
    } catch (err) {
      console.error('Error loading topics:', err)
      setTopics([])
    } finally {
      setTopicsLoading(false)
    }
  }

  const handleStudySetChange = async (setId) => {
    setSelectedStudySetId(setId)
    if (setId) {
      await fetchSetDetails(setId)
    } else {
      setStudySetData(null)
    }
  }

  const handleSpecialtyChange = async (specId) => {
    setSelectedSpecialtyId(specId)
    setSelectedTopics(new Set())
    if (specId) {
      await fetchTopicsList(specId)
    } else {
      setTopics([])
    }
  }

  const getSpecialtyQuestionsCount = () => {
    if (!selectedSpecialtyId || selectedTopics.size === 0) return 0
    if (includeIncorrect && !includeAttempted) {
      return topics
        .filter(t => selectedTopics.has(t.id))
        .reduce((sum, t) => sum + (t.remaining_count || 0) + (t.incorrect_count || 0), 0)
    }
    return topics
      .filter(t => selectedTopics.has(t.id))
      .reduce((sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
  }

  const getStudySetQuestionsCount = () => {
    if (!selectedStudySetId || !studySetData) return 0
    if (includeIncorrect && !includeAttempted) {
      return (studySetData.remaining_questions ?? 0) + (studySetData.incorrect_questions ?? 0)
    }
    return includeAttempted
      ? (studySetData.total_questions || 0)
      : (studySetData.remaining_questions ?? studySetData.total_questions ?? 0)
  }

  const totalAvailable = sessionSource === 'set' ? getStudySetQuestionsCount() : getSpecialtyQuestionsCount()
  const maxQuestions = totalAvailable
  const stepperMin = totalAvailable > 0 ? 1 : 0
  const isDisabled = totalAvailable === 0

  const isCreateDisabled = sessionSource === 'set'
    ? (!selectedStudySetId || totalAvailable === 0)
    : (!selectedSpecialtyId || selectedTopics.size === 0 || totalAvailable === 0)

  useEffect(() => {
    if (mode === 'join') return
    if (totalAvailable === 0) {
      setNumQuestions(0)
    } else {
      setNumQuestions((n) => (n < 1 || n > totalAvailable ? Math.min(25, totalAvailable) : Math.min(n, totalAvailable)))
    }
  }, [totalAvailable, mode])

  const connectSocket = () => {
    const userId = user.id
    const username = user.username || user.email || 'Anonymous'

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: getAccessToken(),
        refreshToken: getRefreshToken()
      }
    })

    socketRef.current.on('token-refreshed', (data) => {
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id)
      console.log('joining room', userId)
      socketRef.current.emit('join-group-session', {
        room_code: roomCode,
        user_id: userId,
        username: username
      })
    })

    socketRef.current.on('participant-joined', (data) => {
      console.log('Participant joined:', data)
      setParticipants(prev => {
        if (prev.some(p => p.id === data.participant.id)) {
          return prev
        }
        return [...prev, data.participant]
      })
    })

    socketRef.current.on('participant-left', (data) => {
      console.log('Participant left:', data)
      setParticipants(prev => prev.filter(p => p.id !== data.participantId))
    })

    socketRef.current.on('session-started', (data) => {
      console.log('Session started:', data)
      const params = new URLSearchParams({
        room_code: data.room_code,
        study_set_name: data.study_set_name,
        num_questions: data.num_questions.toString(),
        timer_minutes: data.timer_minutes.toString(),
        include_attempted: data.include_attempted ? '1' : '0',
        include_incorrect: data.incorrect_only ? '1' : '0'
      })

      if (data.study_set_id) {
        params.append('study_set_id', data.study_set_id)
      }

      if (data.timer_end_time) {
        sessionStorage.setItem('group_timer_end', data.timer_end_time.toString())
      }

      navigate(`/dashboard/question-bank/group-practice?${params.toString()}`)
    })

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error)
      alert(error.message || 'An error occurred')
    })

    socketRef.current.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
    })
  }

  const createSession = async () => {
    try {
      const body = {
        num_questions: numQuestions,
        timer_minutes: timerEnabled ? timerMinutes : 0,
        include_attempted: includeAttempted,
        include_incorrect: includeIncorrect,
      }

      if (sessionSource === 'set') {
        if (!selectedStudySetId) {
          alert('Please select a study set')
          return
        }
        body.study_set_id = selectedStudySetId
      } else {
        if (!selectedSpecialtyId) {
          alert('Please select a specialty')
          return
        }
        if (selectedTopics.size === 0) {
          alert('Please select at least one topic')
          return
        }
        body.specialty_id = selectedSpecialtyId
        body.topic_ids = Array.from(selectedTopics).join(',')
      }

      const res = await authenticatedFetch(`${API_BASE}/qbank/group-session/create`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (!res.ok) throw new Error('Failed to create session')
      const data = await res.json()

      setRoomCode(data.room_code)
      setIsHost(true)

      setParticipants([{ id: data.host_id, name: data.host_name, is_host: true }])
      setSessionCreated(true)

      setStudySetData({ name: data.study_set_name })
    } catch (error) {
      console.error('Error creating session:', error)
      alert('Failed to create group session. Please try again.')
    }
  }

  const joinSession = async () => {
    if (!joinCode.trim()) {
      alert('Please enter a room code')
      return
    }

    try {
      setIsJoining(true)
      const res = await authenticatedFetch(`${API_BASE}/qbank/group-session/join`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          room_code: joinCode.toUpperCase()
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || error.message || 'Failed to join session')
      }
      const data = await res.json()

      if (data.status === 'active') {
        const params = new URLSearchParams({
          room_code: joinCode.toUpperCase(),
          study_set_name: data.study_set_name || '',
          num_questions: data.num_questions.toString(),
          timer_minutes: data.timer_minutes.toString(),
          include_attempted: data.include_attempted ? '1' : '0',
          include_incorrect: data.incorrect_only ? '1' : '0'
        })
        if (data.study_set_id) {
          params.append('study_set_id', data.study_set_id)
        }
        navigate(`/dashboard/question-bank/group-practice?${params.toString()}`)
        return
      }

      setRoomCode(joinCode.toUpperCase())
      setSessionCreated(true)
      setParticipants(data.participants || [])
      setStudySetData({ name: data.study_set_name })
      setNumQuestions(data.num_questions)
      setTimerMinutes(data.timer_minutes)
      setTimerEnabled(data.timer_minutes > 0)
    } catch (error) {
      console.error('Error joining session:', error)
      alert(error.message || 'Failed to join group session. Please check the room code.')
      setIsJoining(false)
    }
  }

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const startGroupSession = () => {
    if (socketRef.current) {
      socketRef.current.emit('start-session', { room_code: roomCode })
    }
  }

  const updateSliderProgress = (value, min, max) => {
    const progress = ((value - min) / (max - min)) * 100
    return progress
  }

  const getSessionDisplayName = () => {
    if (sessionSource === 'set') {
      return studySets.find(s => s.id === selectedStudySetId)?.name || 'Custom Study Set'
    } else {
      const specName = specialties.find(s => s.id === selectedSpecialtyId)?.name || 'Specialty Practice'
      return `${specName} (${selectedTopics.size} Topics)`
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading group study setup..." />
  }

  // Show waiting room if session is created
  if (sessionCreated) {
    return (
      <div className="setup">
        <div className="setup__header">
          <button
            className="setup__back"
            onClick={() => navigate('/dashboard/question-bank')}
          >
            <LuChevronLeft />
            Back to Question Bank
          </button>
          <div className="setup__title-section">
            <div>
              <h1 className="setup__title">Group Study Session</h1>
              <p className="setup__subtitle">{studySetData?.name}</p>
            </div>
          </div>
        </div>

        <div className="group-waiting">
          <div className="group-waiting__main">
            <div className="group-waiting__card">
              <div className="group-waiting__header">
                <div className="group-waiting__icon">
                  <LuUsers size={32} />
                </div>
                <div>
                  <h2 className="group-waiting__title">Waiting Room</h2>
                  <p className="group-waiting__subtitle">
                    {isHost ? 'Share the room code with others to join' : 'Waiting for host to start the session'}
                  </p>
                </div>
              </div>

              <div className="group-waiting__room-code">
                <div className="room-code__label">Room Code</div>
                <div className="room-code__display">
                  <span className="room-code__text">{roomCode}</span>
                  <button
                    className="room-code__copy"
                    onClick={copyRoomCode}
                    title="Copy room code"
                  >
                    {copied ? <LuCheck size={20} /> : <LuCopy size={20} />}
                  </button>
                </div>
                <p className="room-code__hint">Share this code with your study group</p>
              </div>

              <div className="group-waiting__participants">
                <h3 className="participants__title">
                  Participants ({participants.length})
                </h3>
                <div className="participants__list">
                  {participants.map((participant, idx) => (
                    <div key={participant.id || idx} className="participant-item">
                      <div className="participant-item__avatar">
                        {participant.is_host ? <LuCrown size={16} /> : <LuUser size={16} />}
                      </div>
                      <div className="participant-item__info">
                        <div className="participant-item__name">
                          {participant.name || 'Anonymous'}
                          {participant.is_host && <span className="participant-item__badge">Host</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {isHost && (
                <button
                  className="setup__start-btn"
                  onClick={startGroupSession}
                  disabled={participants.length < 1}
                >
                  <LuPlay />
                  Start Session
                </button>
              )}
            </div>
          </div>

          <div className="group-waiting__sidebar">
            <div className="setup__summary">
              <h3 className="setup__summary-title">Session Details</h3>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Question Source:</div>
                <div className="setup__summary-value">{studySetData?.name}</div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Questions:</div>
                <div className="setup__summary-value">{numQuestions}</div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Time Limit:</div>
                <div className="setup__summary-value">
                  {timerEnabled ? `${timerMinutes} min` : 'No limit'}
                </div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Mode:</div>
                <div className="setup__summary-value">Group Study</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Initial setup screen
  return (
    <div className="setup">
      <div className="setup__header">
        <button
          className="setup__back"
          onClick={() => navigate('/dashboard/question-bank')}
        >
          <LuChevronLeft />
          Back to Question Bank
        </button>
        <div className="setup__title-section">
          <div>
            <h1 className="setup__title">
              {mode === 'join' ? 'Join Group Study Session' : 'Group Study Setup'}
            </h1>
            <p className="setup__subtitle">
              {mode === 'join' ? 'Enter a room code to join an existing session' : 'Configure and create a group study session'}
            </p>
          </div>
        </div>
      </div>

      <div className="setup__content">
        <div className="setup__main">
          {/* Join Mode - Only show join input */}
          {mode === 'join' ? (
            <div className="setup__section">
              <h2 className="setup__section-title">Enter Room Code</h2>
              <p className="setup__section-subtitle">Get the 6-character code from your study group host</p>

              <div className="group-join" style={{ marginTop: 24 }}>
                <div className="group-join__input-group">
                  <input
                    type="text"
                    className="group-join__input"
                    placeholder="ABCD12"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && joinCode.trim() && !isReviewer && joinSession()}
                    maxLength={6}
                    autoFocus
                    disabled={isReviewer}
                  />
                  <button
                    className="group-join__btn"
                    onClick={joinSession}
                    disabled={!joinCode.trim() || isJoining || isReviewer}
                    title={isReviewer ? 'Group sessions are not available for reviewer accounts' : undefined}
                  >
                    {isJoining ? 'Joining...' : 'Join Session'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Question Source Options */}
              <div className="setup__section">
                <h2 className="setup__section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <LuLayers size={20} />
                  Question Source
                </h2>
                <p className="setup__section-subtitle">Choose how questions are selected for your group study session</p>

                <div className="qb-segmented-control">
                  <button
                    type="button"
                    className={`qb-segmented-btn ${sessionSource === 'set' ? 'active' : ''}`}
                    onClick={() => setSessionSource('set')}
                  >
                    <LuBookOpen size={16} />
                    Custom Study Set
                  </button>
                  <button
                    type="button"
                    className={`qb-segmented-btn ${sessionSource === 'specialty' ? 'active' : ''}`}
                    onClick={() => setSessionSource('specialty')}
                  >
                    <LuLayers size={16} />
                    Specialty & Topics
                  </button>
                </div>

                <div style={{ marginTop: '24px' }}>
                  {sessionSource === 'set' ? (
                    <div className="source-config">
                      <label className="setup__setting-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Select Custom Study Set
                      </label>
                      <select
                        className="setup__select"
                        value={selectedStudySetId}
                        onChange={(e) => handleStudySetChange(e.target.value)}
                      >
                        <option value="">Select a study set...</option>
                        {studySets.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.topic_count ?? s.item_count}{' '}
                            {(s.topic_count ?? s.item_count) === 1 ? 'topic' : 'topics'})
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="source-config">
                      <label className="setup__setting-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                        Select Specialty
                      </label>
                      <select
                        className="setup__select"
                        value={selectedSpecialtyId}
                        onChange={(e) => handleSpecialtyChange(e.target.value)}
                        style={{ marginBottom: '20px' }}
                      >
                        <option value="">Select a specialty...</option>
                        {specialties.map(s => (
                          <option key={s.specialty_id} value={s.specialty_id}>
                            {s.specialty_name}
                          </option>
                        ))}
                      </select>

                      {selectedSpecialtyId && (
                        <div className="setup__topics-list" style={{ marginTop: '16px' }}>
                          <div className="setup__topics-header">
                            <span className="setup__topics-title">Select Topics ({selectedTopics.size} / {topics.length})</span>
                            <div className="setup__topics-actions">
                              <button
                                type="button"
                                onClick={() => setSelectedTopics(new Set(topics.map(t => t.id)))}
                                className="setup__topics-action-btn"
                              >
                                Select All
                              </button>
                              <span className="setup__topics-divider">|</span>
                              <button
                                type="button"
                                onClick={() => setSelectedTopics(new Set())}
                                className="setup__topics-action-btn setup__topics-action-btn--deselect"
                              >
                                Deselect All
                              </button>
                            </div>
                          </div>

                          {topicsLoading ? (
                            <div style={{ padding: '16px 0', color: 'var(--text-muted)' }}>Loading topics...</div>
                          ) : (
                            <div className="topics-grid">
                              {topics.map(t => {
                                const isChecked = selectedTopics.has(t.id)
                                return (
                                  <label
                                    key={t.id}
                                    className={`topic-checkbox-label ${isChecked ? 'checked' : ''}`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        const next = new Set(selectedTopics)
                                        if (next.has(t.id)) next.delete(t.id)
                                        else next.add(t.id)
                                        setSelectedTopics(next)
                                      }}
                                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                                    />
                                    <div style={{ flex: 1, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {t.name}
                                    </div>
                                    <span style={{ fontSize: '12px', color: 'var(--syn-muted)' }}>
                                      ({includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)})
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Create session card removed - Moved button to sidebar */}

              {/* Question Settings - Only show if creating (not join mode) */}
              <div className="setup__section">
                <h2 className="setup__section-title">Session Settings</h2>
                <p className="setup__section-subtitle">Configure your group study session</p>

                <div className="qs-grid">
                  <div className="qs-col">
                    <div className="setup__setting">
                      <label className="setup__setting-label">
                        Number of Questions
                      </label>
                      <div className="setup__qty">
                        <div className="qty__control">
                          <button className="qty__btn" disabled={isDisabled || numQuestions <= stepperMin} onClick={() => setNumQuestions(Math.max(stepperMin, numQuestions - 1))}>−</button>
                          <input
                            type="number"
                            className="qty__input"
                            value={numQuestions}
                            min={stepperMin}
                            max={maxQuestions}
                            disabled={isDisabled}
                            onChange={(e) => {
                              const v = parseInt(e.target.value || '0', 10)
                              if (Number.isNaN(v)) return
                              setNumQuestions(Math.max(stepperMin, Math.min(maxQuestions, v)))
                            }}
                          />
                          <button className="qty__btn" disabled={isDisabled || numQuestions >= maxQuestions} onClick={() => setNumQuestions(Math.min(maxQuestions, numQuestions + 1))}>+</button>
                        </div>
                        <div className="qty__chips">
                          {[10, 25, 50, 100].filter(n => n <= maxQuestions).map(n => (
                            <button key={n} className={`chip ${numQuestions === n ? 'is-active' : ''}`} disabled={isDisabled} onClick={() => setNumQuestions(n)}>{n}</button>
                          ))}
                          <button className={`chip ${numQuestions === maxQuestions ? 'is-active' : ''}`} disabled={isDisabled} onClick={() => setNumQuestions(maxQuestions)}>Max</button>
                        </div>
                      </div>
                      {!includeIncorrect && (
                        <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                          <label htmlFor="include-toggle" className="setup__toggle-label">Include previously answered</label>
                          <div className="setup__toggle-container">
                            <input
                              type="checkbox"
                              id="include-toggle"
                              checked={includeAttempted}
                              onChange={(e) => {
                                const v = e.target.checked
                                if (v) setIncludeIncorrect(false)
                                setIncludeAttempted(v)
                              }}
                              className="setup__toggle-input"
                            />
                            <label htmlFor="include-toggle" className="setup__toggle-slider"></label>
                          </div>
                          <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeAttempted ? 'Include' : 'New only'}</span>
                        </div>
                      )}
                      {!includeAttempted && (
                        <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                          <label htmlFor="g-incorrect-toggle" className="setup__toggle-label">Include incorrectly answered (host)</label>
                          <div className="setup__toggle-container">
                            <input
                              type="checkbox"
                              id="g-incorrect-toggle"
                              checked={includeIncorrect}
                              onChange={(e) => setIncludeIncorrect(e.target.checked)}
                              className="setup__toggle-input"
                            />
                            <label htmlFor="g-incorrect-toggle" className="setup__toggle-slider"></label>
                          </div>
                          <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeIncorrect ? 'On' : 'Off'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="qs-col">
                    <div className="setup__setting">
                      <div className="setup__toggle-row">
                        <label htmlFor="timer-toggle" className="setup__toggle-label">
                          Enable Timer
                        </label>
                        <div className="setup__toggle-container">
                          <input
                            type="checkbox"
                            id="timer-toggle"
                            checked={timerEnabled}
                            onChange={(e) => setTimerEnabled(e.target.checked)}
                            className="setup__toggle-input"
                          />
                          <label htmlFor="timer-toggle" className="setup__toggle-slider"></label>
                        </div>
                        <span className={`setup__timer-inline ${!timerEnabled ? 'is-off' : ''}`}>
                          {timerEnabled ? `${timerMinutes} minutes` : 'Off'}
                        </span>
                      </div>
                      <div className={`setup__timer-setting ${!timerEnabled ? 'is-dim' : ''}`}>
                        <div className="setup__slider-wrapper">
                          <input
                            type="range"
                            min="10"
                            max="120"
                            step="5"
                            value={timerMinutes}
                            onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                            className={`setup__slider ${!timerEnabled ? 'setup__slider--disabled' : ''}`}
                            style={{ '--progress': `${updateSliderProgress(timerMinutes, 10, 120)}%` }}
                            disabled={!timerEnabled}
                          />
                          <div className="setup__slider-labels-new">
                            <span className="setup__slider-label-left">10 mins</span>
                            <span className="setup__slider-label-right">120 mins</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Sidebar - Only show in create mode */}
        {mode !== 'join' && (
          <div className="setup__sidebar">
            <div className="setup__summary">
              <h3 className="setup__summary-title">Session Summary</h3>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Type:</div>
                <div className="setup__summary-value">Group Study</div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Question Source:</div>
                <div className="setup__summary-value" style={{ maxWidth: '180px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {getSessionDisplayName()}
                </div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Questions:</div>
                <div className="setup__summary-value">{numQuestions}</div>
              </div>

              <div className="setup__summary-item">
                <div className="setup__summary-label">Time:</div>
                <div className="setup__summary-value">
                  {timerEnabled ? `${timerMinutes} min` : 'No limit'}
                </div>
              </div>

              <div className="setup__summary-divider"></div>

              {isReviewer && (
                <p style={{ fontSize: 13, color: '#b45309', marginBottom: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '8px 12px' }}>
                  Group sessions are not available for reviewer accounts.
                </p>
              )}
              <button
                className="setup__start-btn"
                onClick={createSession}
                disabled={isCreateDisabled || isReviewer}
                title={isReviewer ? 'Group sessions are not available for reviewer accounts' : undefined}
              >
                <LuUsers size={20} />
                Create Group Session
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
