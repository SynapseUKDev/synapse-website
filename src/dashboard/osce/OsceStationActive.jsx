import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuChevronDown, LuPlay, LuPause, LuSquare, LuEye, LuEyeOff, LuMinus, LuPlus, LuRotateCcw } from 'react-icons/lu'
import { io } from 'socket.io-client'
import { authenticatedFetch, getAccessToken, getRefreshToken, setTokens, authHeaders } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import OsceBlockRenderer from './OsceBlockRenderer'
import './Osce.css'
import ReviewCommentPopover from '../../components/highlight/ReviewCommentPopover'

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
  const isReviewer = !!user?.capabilities?.can_review
  const effectiveRole = isReviewer ? 'all' : role
  const [reviewComments, setReviewComments] = useState([])
  const [reviewPopover, setReviewPopover] = useState(null)
  const [reviewSubmitting, setReviewSubmitting] = useState(false)

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

  // Fetch review comments
  useEffect(() => {
    if (!isReviewer || !station?.id) return
    authenticatedFetch(`${API_BASE}/reviewer/comments?content_type=osce_station&content_id=${station.id}`)
      .then((r) => r.ok ? r.json() : { comments: [] })
      .then((d) => setReviewComments(d.comments || []))
      .catch(() => {})
  }, [isReviewer, station?.id])

  // Listen for text selection
  useEffect(() => {
    if (!isReviewer || !station) return

    const onMouseUp = (e) => {
      if (e?.target?.closest?.('.rv-popover') || e?.target?.closest?.('.rv-popover-backdrop')) return
      const clickedEl = e?.target?.nodeType === Node.TEXT_NODE ? e.target.parentElement : e?.target
      if (clickedEl?.closest?.('mark.rv-mark')) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer?.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer?.parentElement
      const blockEl = node?.closest?.('[data-block-id]')
      if (!blockEl) return

      const blockId = blockEl.getAttribute('data-block-id')
      const sectionAnchor = blockEl.getAttribute('data-section-anchor') || ''
      const { start, end, quote: rawQuote } = computeSelectionOffsets(blockEl, range)
      if (!rawQuote || !rawQuote.trim()) return

      const selectionRect = range.getBoundingClientRect()
      try {
        sel.removeAllRanges()
      } catch { }

      setReviewPopover({
        quote: rawQuote,
        anchorRect: {
          top: selectionRect.top,
          left: selectionRect.left,
          width: selectionRect.width,
          height: selectionRect.height,
        },
        start_offset: start,
        end_offset: end,
        block_id: blockId,
        section_anchor: sectionAnchor,
      })
    }

    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('touchend', onMouseUp, true)
    return () => {
      document.removeEventListener('mouseup', onMouseUp, true)
      document.removeEventListener('touchend', onMouseUp, true)
    }
  }, [isReviewer, station])

  const handleReviewCommentSubmit = useCallback(async ({ comment_text }) => {
    if (!station?.id || !comment_text?.trim() || !reviewPopover) return
    setReviewSubmitting(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/reviewer/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_type: 'osce_station',
          content_id: station.id,
          content_title: station.title || '',
          quote: reviewPopover.quote || '',
          start_offset: reviewPopover.start_offset || null,
          end_offset: reviewPopover.end_offset || null,
          block_id: reviewPopover.block_id || null,
          section_anchor: reviewPopover.section_anchor || null,
          comment_text: comment_text.trim(),
        }),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.comment) {
          setReviewComments((prev) => [...prev, d.comment])
        }
      }
    } catch (e) {
      console.error('Failed to submit review comment:', e)
    } finally {
      setReviewSubmitting(false)
      setReviewPopover(null)
    }
  }, [station, reviewPopover])

  const handleReviewCommentDelete = useCallback(async (commentId) => {
    setReviewSubmitting(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/reviewer/comments/${commentId}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        setReviewComments((prev) => prev.filter((rc) => rc.id !== commentId))
        setReviewPopover(null)
      }
    } catch (e) {
      console.error('Failed to delete review comment:', e)
    } finally {
      setReviewSubmitting(false)
    }
  }, [])

  const handleContentClick = (e) => {
    if (!isReviewer) return
    const target = e.target.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target
    const mark = target?.closest('mark.rv-mark')
    if (mark) {
      e.preventDefault()
      e.stopPropagation()
      const commentId = mark.getAttribute('data-comment-id')
      const comment = reviewComments.find((rc) => rc.id === commentId)
      if (comment) {
        const rect = mark.getBoundingClientRect()
        setReviewPopover({
          comment,
          quote: comment.quote,
          anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
        })
      }
    }
  }

  useEffect(() => {
    if (roomCode && user) {
      const SOCKET_URL = API_BASE.replace(/^http/, 'ws').replace(/:\d+$/, ':4000')
      const s = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        auth: { 
          token: getAccessToken(),
          refreshToken: getRefreshToken()
        }
      })
      
      s.on('token-refreshed', (data) => {
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      })
      
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
      const isForceExpanded = isReviewer || (effectiveRole === 'patient' && section.visible_to.includes('patient')) || (effectiveRole === 'candidate' && section.visible_to.includes('candidate'))
      const isCollapsed = isForceExpanded ? false : collapsed[section.id]
      const isHidden = isReviewer ? false : (effectiveRole === 'all' ? (section.initially_hidden && !revealed[section.id]) : false)

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
                <div
                  key={block.id}
                  className="osce-block-wrapper"
                  data-block-id={block.id}
                  data-section-anchor={section.id}
                >
                  <OsceBlockRenderer
                    block={block}
                    interactive={!isReviewer}
                    isReviewer={isReviewer}
                    reviewComments={reviewComments.filter((rc) => rc.block_id === block.id)}
                  />
                </div>
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
    <div className="osce-station" style={{ maxWidth: '100%', padding: '32px 48px' }} onClick={handleContentClick}>
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

          {(session?.host_user_id === user?.id || effectiveRole === 'examiner') && roomCode && (
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
          {effectiveRole !== 'all' ? (
            renderSections(effectiveRole)
          ) : (
            // In 'All' view, show every section once
            sections.sort((a,b) => a.position - b.position).map(section => {
              const sectionBlocks = blocks.filter(b => b.section_id === section.id).sort((a,b) => a.position - b.position)
              const isCollapsed = isReviewer ? false : collapsed[section.id]
              const isHidden = isReviewer ? false : (section.initially_hidden && !revealed[section.id])
              return (
                <div key={section.id} className="osce-section">
                  <div className="osce-section__header" onClick={() => { if (!isHidden) toggleSection(section.id) }} style={{ borderBottom: !isCollapsed && !isHidden ? '1px solid var(--syn-border)' : 'none', cursor: isReviewer ? 'default' : 'pointer' }}>
                    <div className="osce-section__title">
                      {section.title}
                      {section.initially_hidden && !revealed[section.id] && <span className="osce-section__hidden-badge">Hidden</span>}
                      <span style={{ fontSize: 10, color: 'var(--syn-muted)', marginLeft: 8, fontWeight: 400 }}>
                        ({section.visible_to?.join(', ')})
                      </span>
                    </div>
                    {isHidden ? (
                      <button className="osce-timer__btn" onClick={(e) => { e.stopPropagation(); revealSection(section.id) }} style={{ fontSize: '0.75rem' }}><LuEye size={14} /> Reveal</button>
                    ) : !isReviewer ? (
                      <LuChevronDown size={18} className={`osce-section__toggle ${!isCollapsed ? 'osce-section__toggle--open' : ''}`} />
                    ) : null}
                  </div>
                  {!isCollapsed && !isHidden && (
                    <div className="osce-section__body" style={{ paddingTop: 20 }}>
                      {sectionBlocks.map(block => (
                        <div
                          key={block.id}
                          className="osce-block-wrapper"
                          data-block-id={block.id}
                          data-section-anchor={section.id}
                        >
                          <OsceBlockRenderer
                            block={block}
                            interactive={!isReviewer}
                            isReviewer={isReviewer}
                            reviewComments={reviewComments.filter((rc) => rc.block_id === block.id)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })
          )}

          {/* CANDIDATE NOTES */}
          {!isReviewer && (effectiveRole === 'candidate' || effectiveRole === 'all') && (
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
          {(effectiveRole === 'examiner' || effectiveRole === 'all') && (
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
                        {!isReviewer && (
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
                        )}
                      </div>
                      
                      {(vivaState[q.id] || isReviewer) && q.answer_text && (
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
                          {!isReviewer && <div className="osce-marks__domain-score">{domainScore}/{domain.max_marks}</div>}
                        </div>
                        {domainItems.map((item) => (
                          <div
                            key={item.id}
                            className={`osce-marks__item ${item.is_critical ? 'osce-marks__item--critical' : ''}`}
                            onClick={() => !isReviewer && toggleScore(item.id)}
                            style={{ cursor: isReviewer ? 'default' : 'pointer' }}
                          >
                            {!isReviewer && (
                              <div className={`osce-checklist__checkbox ${scores[item.id] ? 'osce-checklist__checkbox--checked' : ''}`}>
                                {scores[item.id] && <span style={{ color: 'white', fontSize: 10 }}>✓</span>}
                              </div>
                            )}
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
                  {!isReviewer && (
                    <div className="osce-marks__total" style={{ borderTop: '2px solid var(--syn-border)', paddingTop: 16, marginTop: 16 }}>
                      <span>Total</span>
                      <span>{totalMarks}/{maxMarks}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Final Assessment */}
              {!isReviewer && (
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
              )}
            </>
          )}

          {/* PATIENT VIEW handled by generic renderSections above */}
        </div>

        <div className="osce-station__sidebar">
          {/* Timer - visible to all roles in group sessions */}
          {!isReviewer && (effectiveRole !== 'patient' || roomCode) && (
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
                {(!roomCode || session?.host_user_id === user?.id || effectiveRole === 'examiner') ? (
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
          {(effectiveRole === 'examiner' || effectiveRole === 'all') && failCriteria.length > 0 && (
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
          {(effectiveRole === 'examiner' || effectiveRole === 'patient' || effectiveRole === 'all') && station.actual_diagnosis && (
            <div className="osce-marks" style={{ padding: '20px 24px', margin: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 className="osce-marks__title" style={{ margin: 0 }}>Final Diagnosis</h3>
                {!isReviewer && (
                  <button className="osce-timer__btn" onClick={() => setShowDiagnosis(!showDiagnosis)} style={{ padding: '4px 10px' }}>
                    {showDiagnosis ? <LuEyeOff size={14} /> : <LuEye size={14} />} {showDiagnosis ? 'Hide' : 'Reveal'}
                  </button>
                )}
              </div>
              {(showDiagnosis || isReviewer) && (
                <div style={{ marginTop: 16, padding: '16px', background: 'var(--surface-tint-cyan)', color: 'var(--syn-cyan)', borderRadius: 12, fontWeight: 800, fontSize: '18px', textAlign: 'center' }}>
                  {station.actual_diagnosis}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {isReviewer && reviewPopover && (
        <ReviewCommentPopover
          anchorRect={reviewPopover.anchorRect}
          quote={reviewPopover.quote}
          comment={reviewPopover.comment}
          submitting={reviewSubmitting}
          onSubmit={handleReviewCommentSubmit}
          onDelete={reviewPopover.comment ? () => handleReviewCommentDelete(reviewPopover.comment.id) : null}
          onClose={() => setReviewPopover(null)}
        />
      )}
    </div>
  )
}

/* ── Selection Offset Helpers ──────────────────────── */

function walkTextNodes(root) {
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute('data-tb-ignore')) {
        return NodeFilter.FILTER_REJECT
      }
      if (n.nodeType === Node.TEXT_NODE) {
        if (!n.nodeValue?.trim() && !n.nodeValue?.length) return NodeFilter.FILTER_REJECT
        if (n.parentElement?.closest?.('[data-tb-ignore]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
      return NodeFilter.FILTER_SKIP
    },
  })

  let n
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) nodes.push(n)
  }
  return nodes
}

function boundaryToFlatOffset(container, offset, textNodes) {
  if (!container) return null
  if (container.nodeType === Node.TEXT_NODE) {
    let acc = 0
    for (const tn of textNodes) {
      if (tn === container) {
        const L = (tn.nodeValue || '').length
        if (offset < 0 || offset > L) return null
        return acc + offset
      }
      acc += (tn.nodeValue || '').length
    }
    return null
  }
  const r = document.createRange()
  try {
    r.setStart(container, offset)
    r.collapse(true)
  } catch (e) {
    return null
  }
  let acc = 0
  for (const tn of textNodes) {
    const L = (tn.nodeValue || '').length
    for (let i = 0; i <= L; i++) {
      try {
        if (r.comparePoint(tn, i) === 0) {
          return acc + i
        }
      } catch (err) {
        // not comparable; try next
      }
    }
    acc += L
  }
  return null
}

function nbs(s) {
  return (s == null ? '' : String(s)).replace(/\u00a0/g, ' ')
}

function computeSelectionOffsets(blockEl, range) {
  const nodes = walkTextNodes(blockEl)
  const fullText = nodes.map(n => n.nodeValue).join('')

  const qRaw = range.toString()
  let start = boundaryToFlatOffset(range.startContainer, range.startOffset, nodes)
  let end = boundaryToFlatOffset(range.endContainer, range.endOffset, nodes)
  const nQ = nbs(qRaw)

  if (start == null && end != null && nQ.length > 0) {
    const a = end - qRaw.length
    if (a >= 0 && nbs(fullText.slice(a, end)) === nQ) start = a
  }
  if (end == null && start != null && nQ.length > 0) {
    const b = start + qRaw.length
    if (b <= fullText.length && nbs(fullText.slice(start, b)) === nQ) end = b
  }

  if (start == null && end == null && nQ.length > 0) {
    const flat = nbs(fullText)
    let idx = fullText.indexOf(qRaw)
    if (idx === -1) idx = flat.indexOf(nQ)
    if (idx !== -1) {
      const len = qRaw.length
      if (idx + len <= fullText.length) {
        start = idx
        end = idx + len
      }
    }
  }
  if (start == null) start = 0
  if (end == null) {
    if (nQ.length > 0) {
      const b = start + qRaw.length
      if (b <= fullText.length && nbs(fullText.slice(start, b)) === nQ) {
        end = b
      } else {
        const flat = nbs(fullText)
        const idx = flat.indexOf(nQ, start)
        if (idx !== -1) {
          start = idx
          end = idx + qRaw.length
        } else {
          end = Math.min(fullText.length, start + qRaw.length)
        }
      }
    } else {
      end = start
    }
  }
  if (end < start) {
    const t = start
    start = end
    end = t
  }

  const quote = qRaw
  const prefix = start != null ? fullText.slice(Math.max(0, start - 30), start) : ''
  const suffix = end != null ? fullText.slice(end, Math.min(fullText.length, end + 30)) : ''
  return { start, end, quote, prefix, suffix, fullText, textNodes: nodes }
}
