import React, { useEffect, useState, useRef } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useNavigate, useSearchParams, useOutletContext } from 'react-router-dom'
import { LuChevronLeft, LuUsers, LuCopy, LuCheck, LuPlay, LuCrown, LuUser } from 'react-icons/lu'
import './PracticeSetup.css'
import './GroupStudySetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { io } from 'socket.io-client'

export default function GroupStudySetup() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') // 'join' or null (create mode)
  const studySetId = searchParams.get('study_set_id')
  const studySetName = searchParams.get('study_set_name') || 'Unknown Set'
  
  const [loading, setLoading] = useState(true)
  const [studySetData, setStudySetData] = useState(null)
  
  // Session settings
  const [numQuestions, setNumQuestions] = useState(25)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [includeAttempted, setIncludeAttempted] = useState(false)
  
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
    // If in join mode, skip loading study set
    if (mode === 'join') {
      setLoading(false)
      return
    }
    
    // If in create mode, require study set
    if (!studySetId) {
      navigate('/dashboard/question-bank')
      return
    }
    loadStudySet()
  }, [studySetId, mode])

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

  const connectSocket = () => {
    // Get user info from local storage or context
    const userId = user.id
    const username = user.username || user.email || 'Anonymous'

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'], 
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id)
      
      // Join the group session room
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
        // Check if participant already exists
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
      // Navigate to GROUP practice page with session data
      const params = new URLSearchParams({
        room_code: data.room_code,
        study_set_id: data.study_set_id,
        study_set_name: data.study_set_name,
        num_questions: data.num_questions.toString(),
        timer_minutes: data.timer_minutes.toString(),
        include_attempted: data.include_attempted ? '1' : '0'
      })
      
      // Store timer end time in session storage for sync
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

  const loadStudySet = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${studySetId}`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load study set')
      const data = await res.json()
      setStudySetData(data.set)
      
      const totalAvailable = data.set.total_questions || 0
      if (totalAvailable > 0) {
        setNumQuestions(Math.min(totalAvailable, 25))
      } else {
        setNumQuestions(0)
      }
    } catch (error) {
      console.error('Error loading study set:', error)
    } finally {
      setLoading(false)
    }
  }

  const createSession = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/group-session/create`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...authHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          study_set_id: studySetId,
          num_questions: numQuestions,
          timer_minutes: timerEnabled ? timerMinutes : 0,
          include_attempted: includeAttempted
        })
      })
      
      if (!res.ok) throw new Error('Failed to create session')
      const data = await res.json()
      
      setRoomCode(data.room_code)
      setIsHost(true)
      
      setParticipants([{ id: data.host_id, name: data.host_name, is_host: true }])
      setSessionCreated(true)
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
        throw new Error(error.message || 'Failed to join session')
      }
      const data = await res.json()
      
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

  if (loading) {
    return <LoadingScreen message="Loading group study setup..." />
  }

  const totalAvailable = studySetData?.total_questions || 0
  const maxQuestions = totalAvailable
  const stepperMin = totalAvailable > 0 ? 1 : 0
  const isDisabled = totalAvailable === 0

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
              <p className="setup__subtitle">{studySetData?.name || studySetName}</p>
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
                <div className="setup__summary-label">Study Set:</div>
                <div className="setup__summary-value">{studySetData?.name || studySetName}</div>
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
              {mode === 'join' ? 'Join Group Study Session' : `${studySetName} Group Study`}
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
                    onKeyPress={(e) => e.key === 'Enter' && joinCode.trim() && joinSession()}
                    maxLength={6}
                    autoFocus
                  />
                  <button 
                    className="group-join__btn"
                    onClick={joinSession}
                    disabled={!joinCode.trim() || isJoining}
                  >
                    {isJoining ? 'Joining...' : 'Join Session'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Create Mode - Show create button
            <div className="setup__section">
              <h2 className="setup__section-title">Create Session</h2>
              <p className="setup__section-subtitle">Configure your settings below and create a new group session</p>
              
              <div className="group-create" style={{ marginTop: 24 }}>
                <button 
                  className="group-create__btn"
                  onClick={createSession}
                  disabled={isDisabled}
                >
                  <LuUsers size={20} />
                  Create New Session
                </button>
                <p className="group-create__hint">You'll be the host and can invite others with a room code</p>
              </div>
            </div>
          )}

          {/* Question Settings - Only show if creating (not join mode) */}
          {mode !== 'join' && (
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
                      <button className="qty__btn" disabled={isDisabled || numQuestions <= stepperMin} onClick={()=> setNumQuestions(Math.max(stepperMin, numQuestions - 1))}>−</button>
                      <input
                        type="number"
                        className="qty__input"
                        value={numQuestions}
                        min={stepperMin}
                        max={maxQuestions}
                        disabled={isDisabled}
                        onChange={(e)=>{
                          const v = parseInt(e.target.value || '0', 10)
                          if (Number.isNaN(v)) return
                          setNumQuestions(Math.max(stepperMin, Math.min(maxQuestions, v)))
                        }}
                      />
                      <button className="qty__btn" disabled={isDisabled || numQuestions >= maxQuestions} onClick={()=> setNumQuestions(Math.min(maxQuestions, numQuestions + 1))}>+</button>
                    </div>
                    <div className="qty__chips">
                      {[10,25,50,100].filter(n => n <= maxQuestions).map(n => (
                        <button key={n} className={`chip ${numQuestions===n ? 'is-active' : ''}`} disabled={isDisabled} onClick={()=> setNumQuestions(n)}>{n}</button>
                      ))}
                      <button className={`chip ${numQuestions===maxQuestions ? 'is-active' : ''}`} disabled={isDisabled} onClick={()=> setNumQuestions(maxQuestions)}>Max</button>
                    </div>
                  </div>
                  <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                    <label htmlFor="include-toggle" className="setup__toggle-label">Include previously answered</label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="include-toggle"
                        checked={includeAttempted}
                        onChange={(e) => setIncludeAttempted(e.target.checked)}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="include-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeAttempted ? 'Include' : 'New only'}</span>
                  </div>
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
                        style={{'--progress': `${updateSliderProgress(timerMinutes, 10, 120)}%`}}
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
              <div className="setup__summary-label">Study Set:</div>
              <div className="setup__summary-value">{studySetData?.name || studySetName}</div>
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

            <div className="group-summary-hint">
              <LuUsers size={16} />
              <span>Configure settings above, then create a session to invite others</span>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}

