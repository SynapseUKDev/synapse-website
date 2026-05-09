import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuChevronDown, LuPlay, LuPause, LuSquare, LuEye, LuEyeOff, LuMinus, LuPlus, LuRotateCcw } from 'react-icons/lu'
import { io } from 'socket.io-client'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import OsceBlockRenderer from './OsceBlockRenderer'
import './Osce.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TYPE_LABELS = {
  history_taking: 'History Taking',
  examination: 'Examination',
  communication: 'Communication',
  procedural: 'Procedural',
  emergency: 'Emergency',
  data_interpretation: 'Data Interpretation',
  prescribing: 'Prescribing',
  documentation: 'Documentation',
  paeds_obs_gynae: 'Paeds / Obs & Gynae',
}

export default function OsceStationActive() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useOutletContext()
  const role = searchParams.get('role') || 'all'

  const [station, setStation] = useState(null)
  const [sections, setSections] = useState([])
  const [blocks, setBlocks] = useState([])
  const [domains, setDomains] = useState([])
  const [items, setItems] = useState([])
  const [failCriteria, setFailCriteria] = useState([])
  const [loading, setLoading] = useState(true)
  const [roomCode] = useState(searchParams.get('room'))
  const [session, setSession] = useState(null)
  const [socket, setSocket] = useState(null)

  // Section collapse state
  const [collapsed, setCollapsed] = useState({})
  // Revealed hidden sections (for solo mode progressive reveal)
  const [revealed, setRevealed] = useState({})

  // Timer
  const [timerState, setTimerState] = useState('idle') // idle | running | paused | done
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef(null)

  // Mark scheme scores (examiner mode)
  const [scores, setScores] = useState({})

  // Examiner forms
  const [globalRating, setGlobalRating] = useState('')
  const [patientImpression, setPatientImpression] = useState(null) // true/false
  const [feedback, setFeedback] = useState('')
  const [showDiagnosis, setShowDiagnosis] = useState(false) // hidden by default

  // Candidate forms
  const [candidateNotes, setCandidateNotes] = useState('')

  // Viva Questions (Examiner mode)
  const [vivaState, setVivaState] = useState({})

  // Custom Timer State
  const [customSeconds, setCustomSeconds] = useState(0)

  useEffect(() => {
    window.scrollTo(0, 0)
    loadStation()
    if (roomCode) loadGroupSession()
  }, [slug, roomCode])

  useEffect(() => {
    if (roomCode && user) {
      const SOCKET_URL = API_BASE.replace(/^http/, 'ws').replace(/:\d+$/, ':4000')
      const s = io(SOCKET_URL, { transports: ['websocket', 'polling'] })
      
      s.on('connect', () => {
        s.emit('join-osce-session', { 
          room_code: roomCode, 
          user_id: user.id, 
          username: user.username || user.email 
        })
      })

      s.on('osce-session-completed', () => {
        navigate(`/dashboard/osce/group/${roomCode}/results`)
      })

      s.on('osce-timer-sync', ({ action, elapsed }) => {
        if (action === 'start') {
          setTimerState('running')
          if (elapsed !== undefined) setElapsed(elapsed)
          if (timerRef.current) clearInterval(timerRef.current)
          timerRef.current = setInterval(() => {
            setElapsed((prev) => prev + 1)
          }, 1000)
        } else if (action === 'pause') {
          setTimerState('paused')
          clearInterval(timerRef.current)
          if (elapsed !== undefined) setElapsed(elapsed)
        } else if (action === 'reset') {
          setTimerState('idle')
          setElapsed(0)
          clearInterval(timerRef.current)
        }
      })

      setSocket(s)
      return () => s.disconnect()
    }
  }, [roomCode, user])

  async function loadGroupSession() {
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/group-session/${roomCode}`)
      if (res.ok) {
        const d = await res.json()
        setSession(d.session)
      }
    } catch (e) { console.error('Failed to load group session:', e) }
  }

  async function loadStation() {
    try {
      setLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/osce/stations/${slug}`)
      if (!res.ok) {
        navigate('/dashboard/osce')
        return
      }
      const data = await res.json()
      setStation(data.station)
      setSections(data.sections || [])
      setBlocks(data.blocks || [])
      setDomains(data.domains || [])
      setItems(data.items || [])
      setFailCriteria(data.fail_criteria || [])

      // Auto-collapse hidden sections
      const initialCollapsed = {}
        ; (data.sections || []).forEach((s) => {
          if (s.initially_hidden) initialCollapsed[s.id] = true
        })
      setCollapsed(initialCollapsed)
    } catch (e) {
      console.error('Failed to load station:', e)
    } finally {
      setLoading(false)
    }
  }

  // Timer logic
  const startTimer = useCallback(() => {
    setTimerState('running')
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    if (socket && roomCode) socket.emit('osce-timer-control', { room_code: roomCode, action: 'start', elapsed: elapsed })
  }, [socket, roomCode, elapsed])

  const pauseTimer = useCallback(() => {
    setTimerState('paused')
    clearInterval(timerRef.current)
    if (socket && roomCode) socket.emit('osce-timer-control', { room_code: roomCode, action: 'pause', elapsed: elapsed })
  }, [socket, roomCode, elapsed])

  const resumeTimer = useCallback(() => {
    setTimerState('running')
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)
    if (socket && roomCode) socket.emit('osce-timer-control', { room_code: roomCode, action: 'start', elapsed: elapsed })
  }, [socket, roomCode, elapsed])

  const stopTimer = useCallback(() => {
    setTimerState('done')
    clearInterval(timerRef.current)
    if (socket && roomCode) socket.emit('osce-timer-control', { room_code: roomCode, action: 'pause', elapsed: elapsed })
  }, [socket, roomCode, elapsed])

  useEffect(() => {
    return () => clearInterval(timerRef.current)
  }, [])

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const totalSeconds = customSeconds || ((station?.time_minutes || 8) * 60)
  const remaining = Math.max(0, totalSeconds - elapsed)
  const pct = totalSeconds > 0 ? Math.min(100, (elapsed / totalSeconds) * 100) : 0

  // Auto-stop when time runs out
  useEffect(() => {
    if (elapsed >= totalSeconds && timerState === 'running') {
      stopTimer()
    }
  }, [elapsed, totalSeconds, timerState, stopTimer])

  const addMinute = useCallback(() => {
    setCustomSeconds((prev) => (prev || ((station?.time_minutes || 8) * 60)) + 60)
  }, [station])

  const subtractMinute = useCallback(() => {
    setCustomSeconds((prev) => Math.max(60, (prev || ((station?.time_minutes || 8) * 60)) - 60))
  }, [station])

  const restartTimer = useCallback(() => {
    setElapsed(0)
    setTimerState('idle')
    clearInterval(timerRef.current)
    if (socket && roomCode) socket.emit('osce-timer-control', { room_code: roomCode, action: 'reset' })
  }, [socket, roomCode])

  async function handleEndSession() {
    if (!socket || !roomCode) return
    
    // Collect final state
    const results = {
      scores,
      feedback,
      globalRating,
      patientImpression,
      vivaState,
      total_marks: Object.values(scores).reduce((a, b) => a + (b ? 1 : 0), 0),
      max_marks: items.length
    }

    socket.emit('osce-complete', { 
      room_code: roomCode,
      results 
    })
  }

  const toggleSection = (sectionId) => {
    setCollapsed((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }))
  }

  const revealSection = (sectionId) => {
    setRevealed((prev) => ({ ...prev, [sectionId]: true }))
    setCollapsed((prev) => ({ ...prev, [sectionId]: false }))
  }

  const toggleScore = (itemId) => {
    setScores((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  const toggleViva = (qId) => {
    setVivaState((prev) => ({ ...prev, [qId]: !prev[qId] }))
  }

  // Calculate total score
  const totalMarks = Object.entries(scores).reduce((sum, [itemId, achieved]) => {
    if (!achieved) return sum
    const item = items.find((i) => i.id === itemId)
    return sum + (item?.marks || 0)
  }, 0)
  const maxMarks = items.reduce((sum, i) => sum + (i.marks || 0), 0)

  const renderSections = (roleFilter) => {
    return sections.filter(s => s.visible_to && s.visible_to.includes(roleFilter)).map((section) => {
      const sectionBlocks = blocks
        .filter((b) => b.section_id === section.id)
        .sort((a, b) => a.position - b.position)
      const isForceExpanded = (role === 'patient' && section.visible_to.includes('patient')) || (role === 'candidate' && section.visible_to.includes('candidate'))
      const isCollapsed = isForceExpanded ? false : collapsed[section.id]
      const isHidden = role === 'all' ? (section.initially_hidden && !revealed[section.id]) : false

      return (
        <div key={section.id} className="osce-section">
          <div className="osce-section__header" onClick={() => {
            if (isHidden || isForceExpanded) return
            toggleSection(section.id)
          }} style={{ borderBottom: !isCollapsed && !isHidden ? '1px solid var(--syn-border)' : 'none', cursor: isForceExpanded ? 'default' : 'pointer' }}>
            <div className="osce-section__title">
              {section.title}
              {section.initially_hidden && !revealed[section.id] && (
                <span className="osce-section__hidden-badge">Hidden</span>
              )}
            </div>
            {isHidden ? (
              <button
                className="osce-timer__btn"
                onClick={(e) => { e.stopPropagation(); revealSection(section.id) }}
                style={{ fontSize: '0.75rem' }}
              >
                <LuEye size={14} /> Reveal
              </button>
            ) : !isForceExpanded ? (
              <LuChevronDown
                size={18}
                className={`osce-section__toggle ${!isCollapsed ? 'osce-section__toggle--open' : ''}`}
              />
            ) : null}
          </div>
          {!isCollapsed && !isHidden && sectionBlocks.length > 0 && (
            <div className="osce-section__body" style={{ paddingTop: 20 }}>
              {sectionBlocks.map((block) => (
                <OsceBlockRenderer key={block.id} block={block} interactive />
              ))}
            </div>
          )}
        </div>
      )
    })
  }

  if (loading) {
    return (
      <div className="osce-station">
        <LoadingScreen message="Loading station..." inline />
      </div>
    )
  }

  if (!station) {
    return (
      <div className="osce-station">
        <div className="osce__empty">Station not found.</div>
      </div>
    )
  }

  return (
    <div className="osce-station" style={{ maxWidth: '100%', padding: '32px 48px' }}>
      <button className="osce-station__back" onClick={() => navigate(`/dashboard/osce/station/${station.slug}`)}>
        <LuChevronLeft size={16} /> Back to Station Options
      </button>

      <div className="osce-station__header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="osce-station__title">{station.title}</h1>
            <div className="osce-station__meta">
              <span className="osce__tag osce__tag--type">
                {TYPE_LABELS[station.station_type] || station.station_type}
              </span>
              {station.difficulty && (
                <span className="osce__tag osce__tag--difficulty" data-diff={station.difficulty}>
                  {station.difficulty}
                </span>
              )}
            </div>
          </div>

          {(session?.host_user_id === user?.id || role === 'examiner') && roomCode && (
            <button 
              className="osce-btn osce-btn--danger osce-btn--sm" 
              style={{ width: 'auto', background: '#ef4444', color: '#fff', border: 'none' }}
              onClick={handleEndSession}
            >
              End Session
            </button>
          )}
        </div>
      </div>

      <div className="osce-station__grid">
        <div className="osce-station__main">
          {/* ROLE-SPECIFIC SECTIONS */}
          {role !== 'all' ? (
            renderSections(role)
          ) : (
            // In 'All' view, show every section once
            sections.sort((a,b) => a.position - b.position).map(section => {
              const sectionBlocks = blocks.filter(b => b.section_id === section.id).sort((a,b) => a.position - b.position)
              const isCollapsed = collapsed[section.id]
              const isHidden = section.initially_hidden && !revealed[section.id]
              return (
                <div key={section.id} className="osce-section">
                  <div className="osce-section__header" onClick={() => { if (!isHidden) toggleSection(section.id) }} style={{ borderBottom: !isCollapsed && !isHidden ? '1px solid var(--syn-border)' : 'none', cursor: 'pointer' }}>
                    <div className="osce-section__title">
                      {section.title}
                      {section.initially_hidden && !revealed[section.id] && <span className="osce-section__hidden-badge">Hidden</span>}
                      <span style={{ fontSize: 10, color: 'var(--syn-muted)', marginLeft: 8, fontWeight: 400 }}>
                        ({section.visible_to?.join(', ')})
                      </span>
                    </div>
                    {isHidden ? (
                      <button className="osce-timer__btn" onClick={(e) => { e.stopPropagation(); revealSection(section.id) }} style={{ fontSize: '0.75rem' }}><LuEye size={14} /> Reveal</button>
                    ) : (
                      <LuChevronDown size={18} className={`osce-section__toggle ${!isCollapsed ? 'osce-section__toggle--open' : ''}`} />
                    )}
                  </div>
                  {!isCollapsed && !isHidden && (
                    <div className="osce-section__body" style={{ paddingTop: 20 }}>
                      {sectionBlocks.map(block => <OsceBlockRenderer key={block.id} block={block} interactive />)}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* CANDIDATE NOTES */}
          {(role === 'candidate' || role === 'all') && (
            <div className="osce-section">
              <div className="osce-section__header" style={{ borderBottom: '1px solid var(--syn-border)' }}>
                <div className="osce-section__title">My Notes</div>
              </div>
              <div className="osce-section__body" style={{ padding: '20px' }}>
                <textarea
                  className="osce-group__input"
                  style={{ minHeight: 150, resize: 'vertical', margin: 0, padding: '16px' }}
                  placeholder="Jot down your notes, differential diagnosis, and management plan here..."
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* EXAMINER VIEW */}
          {(role === 'examiner' || role === 'all') && (
            <>
              {/* Viva Questions */}
              {station.viva_questions && station.viva_questions.length > 0 && (
                <div className="osce-marks" style={{ padding: 24, margin: '0 0 16px 0' }}>
                  <h3 className="osce-marks__title" style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>Viva Questions</h3>
                  {station.viva_questions.sort((a,b) => a.position - b.position).map((q, i) => (
                    <div key={q.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px 0', borderBottom: i === station.viva_questions.length - 1 ? 'none' : '1px solid var(--syn-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                        <div style={{ flex: 1, color: 'var(--syn-navy-700)', fontSize: '15px' }}>
                          {q.question_text}
                        </div>
                        <div 
                          onClick={() => toggleViva(q.id)}
                          style={{ 
                            width: 44, height: 24, borderRadius: 12, 
                            background: vivaState[q.id] ? 'var(--syn-cyan)' : 'var(--syn-border)', 
                            position: 'relative', cursor: 'pointer', transition: 'all 0.2s', flexShrink: 0 
                          }}
                        >
                          <div style={{ 
                            width: 20, height: 20, borderRadius: 10, background: 'white', 
                            position: 'absolute', top: 2, left: vivaState[q.id] ? 22 : 2, 
                            transition: 'all 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' 
                          }} />
                        </div>
                      </div>
                      
                      {vivaState[q.id] && q.answer_text && (
                        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px dashed var(--syn-border)' }}>
                          <OsceBlockRenderer block={{ block_type: 'markdown', content: { text: q.answer_text } }} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Mark Scheme */}
              {domains.length > 0 && (
                <div className="osce-marks" style={{ margin: '0 0 16px 0' }}>
                  <h3 className="osce-marks__title" style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
                    Mark Scheme
                  </h3>
                  {domains.sort((a, b) => a.position - b.position).map((domain) => {
                    const domainItems = items.filter((i) => i.domain_id === domain.id).sort((a, b) => a.position - b.position)
                    const domainScore = domainItems.reduce((sum, item) => sum + (scores[item.id] ? item.marks : 0), 0)

                    return (
                      <div key={domain.id} className="osce-marks__domain">
                        <div className="osce-marks__domain-header">
                          <div className="osce-marks__domain-title">{domain.title}</div>
                          <div className="osce-marks__domain-score">{domainScore}/{domain.max_marks}</div>
                        </div>
                        {domainItems.map((item) => (
                          <div
                            key={item.id}
                            className={`osce-marks__item ${item.is_critical ? 'osce-marks__item--critical' : ''}`}
                            onClick={() => toggleScore(item.id)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className={`osce-checklist__checkbox ${scores[item.id] ? 'osce-checklist__checkbox--checked' : ''}`}>
                              {scores[item.id] && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                            </div>
                            <span style={{ flex: 1 }}>
                              {item.description}
                              {item.is_critical && <span style={{ color: '#f87171', marginLeft: 4, fontSize: '0.75rem' }}>(Critical)</span>}
                            </span>
                            <span style={{ fontSize: '0.78rem', color: 'var(--syn-muted)', minWidth: 40, textAlign: 'right' }}>
                              {item.marks} {item.marks === 1 ? 'mark' : 'marks'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                  <div className="osce-marks__total" style={{ borderTop: '2px solid var(--syn-border)', paddingTop: 16, marginTop: 16 }}>
                    <span>Total</span>
                    <span>{totalMarks}/{maxMarks}</span>
                  </div>
                </div>
              )}

              {/* Final Assessment */}
              <div className="osce-marks" style={{ padding: 24, margin: '0 0 16px 0' }}>
                <h3 className="osce-marks__title" style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>Final Assessment</h3>

                <div style={{ marginBottom: 24 }}>
                  <label className="osce-group__label">Global Impression</label>
                  <div className="osce-roles" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                    {['excellent', 'pass', 'borderline', 'fail'].map(r => (
                      <button key={r} className={`osce-role ${globalRating === r ? 'osce-role--active' : ''}`} style={{ textAlign: 'center', padding: '12px' }} onClick={() => setGlobalRating(r)}>
                        <div className="osce-role__name" style={{ textTransform: 'capitalize' }}>{r}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label className="osce-group__label">Would you be happy to see this doctor again? (Ask Patient)</label>
                  <div className="osce-roles" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <button className={`osce-role ${patientImpression === true ? 'osce-role--active' : ''}`} style={{ textAlign: 'center', padding: '12px' }} onClick={() => setPatientImpression(true)}>
                      <div className="osce-role__name">Yes</div>
                    </button>
                    <button className={`osce-role ${patientImpression === false ? 'osce-role--active' : ''}`} style={{ textAlign: 'center', padding: '12px' }} onClick={() => setPatientImpression(false)}>
                      <div className="osce-role__name">No</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="osce-group__label">Feedback & Learning Points</label>
                  <textarea
                    className="osce-group__input"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="What went well? What could be improved?"
                    style={{ minHeight: 100, resize: 'vertical', margin: 0 }}
                  />
                </div>
              </div>
            </>
          )}

          {/* PATIENT VIEW handled by generic renderSections above */}
        </div>

        <div className="osce-station__sidebar">
          {/* Timer - visible to all roles in group sessions */}
          {(role !== 'patient' || roomCode) && (
            <div className="osce-timer" style={{ marginBottom: 16, flexDirection: 'column', alignItems: 'stretch' }}>
              <div
                className={`osce-timer__display ${remaining <= 60 && timerState === 'running'
                  ? 'osce-timer__display--danger'
                  : remaining <= 120 && timerState === 'running'
                    ? 'osce-timer__display--warn'
                    : ''
                  }`}
                style={{ fontSize: '48px', padding: '16px 0' }}
              >
                {formatTime(remaining)}
              </div>
              <div className="osce-timer__progress" style={{ width: '100%' }}>
                <div className="osce-timer__bar" style={{ width: `${pct}%` }} />
              </div>
              <div className="osce-timer__controls" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 16 }}>
                {(!roomCode || session?.host_user_id === user?.id || role === 'examiner') ? (
                  <>
                    <button className="osce-timer__btn" onClick={subtractMinute} style={{ justifyContent: 'center', height: 48, fontSize: 24 }}><LuMinus size={20} /></button>
                    
                    {timerState === 'idle' && (
                      <button className="osce-timer__btn osce-timer__btn--primary" onClick={startTimer} style={{ justifyContent: 'center', height: 48 }}>
                        <LuPlay size={20} />
                      </button>
                    )}
                    {timerState === 'running' && (
                      <button className="osce-timer__btn" onClick={pauseTimer} style={{ justifyContent: 'center', height: 48 }}>
                        <LuPause size={20} />
                      </button>
                    )}
                    {timerState === 'paused' && (
                      <button className="osce-timer__btn osce-timer__btn--primary" onClick={resumeTimer} style={{ justifyContent: 'center', height: 48 }}>
                        <LuPlay size={20} />
                      </button>
                    )}
                    {(timerState === 'done' || timerState === 'paused' || timerState === 'running') && (
                      <button className="osce-timer__btn" onClick={restartTimer} style={{ justifyContent: 'center', height: 48 }}><LuRotateCcw size={20} /></button>
                    )}
                    {timerState === 'idle' && <div />} {/* Placeholder to keep grid layout */}
                    
                    <button className="osce-timer__btn" onClick={addMinute} style={{ justifyContent: 'center', height: 48, fontSize: 24 }}><LuPlus size={20} /></button>
                  </>
                ) : (
                  <div style={{ gridColumn: 'span 4', fontSize: '0.85rem', color: 'var(--syn-muted)', textAlign: 'center', padding: '12px', background: 'var(--surface-app)', borderRadius: 12 }}>
                    Timer controlled by examiner/host
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fail Criteria - only for examiner/all */}
          {(role === 'examiner' || role === 'all') && failCriteria.length > 0 && (
            <div className="osce-block--callout" data-variant="danger" style={{ margin: '0 0 16px 0' }}>
              <div className="osce-callout__title" style={{ borderBottom: '1px solid #fca5a5', paddingBottom: 8, marginBottom: 8 }}>Automatic Fail Criteria</div>
              <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
                {failCriteria.map((c) => (
                  <li key={c.id} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>{c.description}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Final Diagnosis - Show if examiner, patient, or all AND actual_diagnosis is present */}
          {(role === 'examiner' || role === 'patient' || role === 'all') && station.actual_diagnosis && (
            <div className="osce-marks" style={{ padding: '20px 24px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="osce-marks__title" style={{ margin: 0 }}>Final Diagnosis</h3>
                <button className="osce-timer__btn" onClick={() => setShowDiagnosis(!showDiagnosis)} style={{ padding: '4px 10px' }}>
                  {showDiagnosis ? <LuEyeOff size={14} /> : <LuEye size={14} />} {showDiagnosis ? 'Hide' : 'Reveal'}
                </button>
              </div>
              {showDiagnosis && (
                <div style={{ marginTop: 16, padding: '16px', background: 'var(--surface-tint-cyan)', color: 'var(--syn-cyan)', borderRadius: 12, fontWeight: 800, fontSize: '18px', textAlign: 'center' }}>
                  {station.actual_diagnosis}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
