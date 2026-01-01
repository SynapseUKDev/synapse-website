import React, { useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders } from '../../auth/token'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import './Practice.css'
import { LuSave, LuFlag, LuChevronLeft, LuArrowRight, LuPause, LuPlay, LuBookOpen, LuShare2, LuPlus, LuCircleCheck, LuCircleAlert, LuLightbulb, LuX, LuSlash, LuHighlighter, LuEraser, LuExternalLink, LuUsers } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import DiscussionPanel from './DiscussionPanel'
import { io } from 'socket.io-client'

// Server-synced countdown for group sessions
function useCountdown(initialSec = 1800, serverEndTime = null) {
  const [seconds, setSeconds] = useState(initialSec)
  const [running, setRunning] = useState(true)
  const timerRef = useRef(null)
  
  useEffect(() => {
    if (!running) return
    
    // If serverEndTime is provided, sync with server time
    if (serverEndTime) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.floor((serverEndTime - Date.now()) / 1000))
        setSeconds(remaining)
        if (remaining === 0) {
          setRunning(false)
        }
      }, 1000)
    } else {
      // Local countdown
      timerRef.current = setInterval(() => setSeconds((s) => {
        const newVal = Math.max(0, s - 1)
        if (newVal === 0) setRunning(false)
        return newVal
      }), 1000)
    }
    
    return () => clearInterval(timerRef.current)
  }, [running, serverEndTime])
  
  const toggle = () => setRunning((r) => !r)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return { seconds, display: `${mm}:${ss}`, running, toggle, setSeconds }
}

export default function GroupPractice() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const params = new URLSearchParams(location.search)
  const roomCode = params.get('room_code')
  const studySetId = params.get('study_set_id')
  const studySetName = params.get('study_set_name') || 'Group Study'
  const numQuestions = parseInt(params.get('num_questions') || '25')
  const timerMinutes = parseInt(params.get('timer_minutes') || '0')
  const includeAttempted = params.get('include_attempted') !== '0'
  
  // Session state
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState([]) // All questions loaded at start
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState({}) // Store user answers by question ID
  const [submittedAnswers, setSubmittedAnswers] = useState(new Set()) // Track submitted questions
  const [flagged, setFlagged] = useState(new Set())
  const [struckOut, setStruckOut] = useState({}) // Track struck out options per question: { questionId: Set([optionId1, optionId2]) }
  const [highlights, setHighlights] = useState({}) // Track highlighted text ranges per question: { questionId: [{ start, end, text }] }
  const [showHighlightBtn, setShowHighlightBtn] = useState(false)
  const [highlightBtnPos, setHighlightBtnPos] = useState({ x: 0, y: 0 })
  const stemRef = useRef(null)
  
  // Group session state
  const [serverTimerEndTime, setServerTimerEndTime] = useState(null)
  const [participants, setParticipants] = useState([])
  const [isHost, setIsHost] = useState(false)
  const [questionAnswers, setQuestionAnswers] = useState({})
  const socketRef = useRef(null)
  // Reference ranges
  const [refRanges, setRefRanges] = useState([])
  const [showRef, setShowRef] = useState(false)
  const [openGroupId, setOpenGroupId] = useState(null)
  // Image carousel state for question assets
  const [assetIdx, setAssetIdx] = useState(0)
  
  // Current question state
  const [selected, setSelected] = useState(null)
  const [saqText, setSaqText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  
  // UI state
  const [tab, setTab] = useState('quick')
  const [trkFilter, setTrkFilter] = useState('All') // All | Unanswered | Correct | Wrong | Flagged
  const [trkJump, setTrkJump] = useState('')
  
  // Session stats
  const [sessionAnswered, setSessionAnswered] = useState(0)
  const [sessionCorrect, setSessionCorrect] = useState(0)
  const [sessionTotalMs, setSessionTotalMs] = useState(0)
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  
  // Responsive tracker grid size
  const [trackerChunkSize, setTrackerChunkSize] = useState(35)
  
  const { display, running, toggle, seconds } = useCountdown(timerMinutes * 60, serverTimerEndTime)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const SOCKET_URL = API_BASE.replace(/^http/, 'ws').replace(/:\d+$/, ':4000')

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Setup socket connection for group sessions
  useEffect(() => {
    if (roomCode) {
      // Check for server timer end time from session storage
      const storedEndTime = sessionStorage.getItem('group_timer_end')
      if (storedEndTime) {
        setServerTimerEndTime(parseInt(storedEndTime))
        sessionStorage.removeItem('group_timer_end') // Clean up
      }
      
      connectSocket()
    }
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect()
      }
    }
  }, [roomCode])

  // Load all questions for the session
  useEffect(() => {
    if (!roomCode) {
      navigate('/dashboard/question-bank')
      return
    }
    loadGroupSession()
  }, [roomCode])
  
  const connectSocket = () => {
    const userId = user.id
    const username = user.username || user.email || 'Anonymous'

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    })

    socketRef.current.on('connect', () => {
      console.log('Socket connected for group practice')
      
      // Join the group session room
      socketRef.current.emit('join-group-session', {
        room_code: roomCode,
        user_id: userId,
        username: username
      })
    })

    // Listen for peer answers (peer-to-peer updates)
    socketRef.current.on('peer-answered', (data) => {
      console.log('Peer answered:', data)
      // Update local answer tracking
      const key = `${data.question_id}_${data.question_index}`
      setQuestionAnswers(prev => {
        const updated = { ...prev }
        const existing = updated[key] || []
        // Remove existing answer from this user (in case they changed it)
        const filtered = existing.filter((a) => a.user_id !== data.user_id)
        // Add the new answer
        filtered.push({
          user_id: data.user_id,
          username: data.username,
          answer: data.answer,
          is_correct: data.is_correct
        })
        updated[key] = filtered
        return updated
      })
    })
    
    socketRef.current.on('question-changed', (data) => {
      console.log('Question changed by host:', data)
      // Server controls question progression
      setCurrentIndex(data.question_index)
      loadCurrentQuestion(data.question_index, questions)
      
      // Clear local answer list for new question (all clients clear)
      setQuestionAnswers({})
      
      // If host, we already saved answers before emitting next-question
      // If participant, answers were cleared by this event
    })
    
    socketRef.current.on('question-answers', (data) => {
      const key = `${data.question_id}_${data.question_index}`
      setQuestionAnswers(prev => {
        // Preserve all existing answers
        const updated = { ...prev }
        // Add/update answers for this question
        updated[key] = data.answers || []
        return updated
      })
    })
    
    socketRef.current.on('session-completed', () => {
      // Wait for scores before navigating
    })
    
    socketRef.current.on('session-scores', (data) => {
      console.log('Session scores received:', JSON.stringify(data, null, 2))
      // Navigate to leaderboard with scores
      navigate('/dashboard/question-bank/group-leaderboard', {
        state: {
          room_code: data.room_code || roomCode,
          session_id: data.session_id,
          total_questions: data.total_questions,
          scores: data.scores || []
        }
      })
    })

    socketRef.current.on('session-time-up', () => {
      // Wait for scores - server will send session-scores event
      console.log('Time is up! Waiting for scores...')
    })

    socketRef.current.on('session-ended', (data) => {
      console.log('Session ended by host:', data)
      // Wait for scores - server will send session-scores event
      console.log('Session ended, waiting for scores...')
    })

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error)
      alert(error.message || 'An error occurred')
    })
  }
  
  const handleExit = () => {
    const message = isHost 
      ? 'Are you sure you want to exit? As the host, this will end the session for all participants.'
      : 'Are you sure you want to exit the group session?'
    
    if (window.confirm(message)) {
      // Emit end session event
      if (socketRef.current) {
        socketRef.current.emit('end-session', {
          room_code: roomCode,
          user_id: user.id
        })
      }
      
      // Navigate to question bank
      navigate('/dashboard/question-bank')
    }
  }
  
  const loadGroupSession = async () => {
    try {
      setLoading(true)
      
      // Load session details to check if user is host
      const sessionRes = await fetch(`${API_BASE}/qbank/group-session/${roomCode}`, {
        credentials: 'include',
        headers: authHeaders()
      })
      
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json()
        setIsHost(sessionData.is_host || false)
      }
      
      // Load questions
      const res = await fetch(`${API_BASE}/qbank/group-session/${roomCode}/questions`, {
        credentials: 'include',
        headers: authHeaders()
      })
      
      if (!res.ok) {
        throw new Error('Failed to load group session')
      }
      
      const data = await res.json()
      
      if (!data.questions || data.questions.length === 0) {
        alert('No questions available for this session')
        navigate('/dashboard/question-bank')
        return
      }
      
      setQuestions(data.questions)
      // Start at question 0 - server will control progression
      setCurrentIndex(0)
      loadCurrentQuestion(0, data.questions)
      setQuestionStartTime(Date.now())
      
      // Load any existing answers for the current question from database
      if (socketRef.current && data.questions[0]) {
        socketRef.current.emit('get-question-answers', {
          room_code: roomCode,
          question_id: data.questions[0].id,
          question_index: 0
        })
      }
      
      // Load reference ranges
      const rRes = await fetch(`${API_BASE}/reference-ranges`, {
        credentials: 'include',
        headers: authHeaders()
      })
      if (rRes.ok) {
        const rData = await rRes.json()
        setRefRanges(Array.isArray(rData?.groups) ? rData.groups : [])
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Error loading group session:', error)
      alert('Failed to load group session')
      navigate('/dashboard/question-bank')
    }
  }

  // Not used in group practice - using loadGroupSession instead
  const loadSession = () => {}

  // Load the current question and restore user's previous answer if any
  const loadCurrentQuestion = (index, questionList = questions) => {
    if (!questionList || index < 0 || index >= questionList.length) return
    
    const question = questionList[index]
    const questionId = question.id
    const userAnswer = userAnswers[questionId]
    
    // Restore user's previous answer
    if (userAnswer) {
      setSelected(userAnswer.selected)
      setSaqText(userAnswer.saqText || '')
    } else {
      setSelected(null)
      setSaqText('')
    }
    
    setTab('quick')
    setQuestionStartTime(Date.now())
    // Reset carousel index when question changes
    setAssetIdx(0)
  }

  const goToPrevious = () => {
    // Disabled in group mode - server controls progression
    if (!isHost) return
    // Host can't go back in group mode either - only forward
  }

  const goToNext = () => {
    // In group mode, only host can advance questions via server
    if (!isHost) return
    
    // Before moving to next question, host collects all answers and saves to server
    const currentQuestion = questions[currentIndex]
    if (currentQuestion && socketRef.current) {
      const answerKey = `${currentQuestion.id}_${currentIndex}`
      const answersForThisQuestion = questionAnswers[answerKey] || []
      
      // Save answers to server
      socketRef.current.emit('save-question-answers', {
        room_code: roomCode,
        user_id: user.id,
        question_id: currentQuestion.id,
        question_index: currentIndex,
        answers: answersForThisQuestion
      })
      
      // Then move to next question
      socketRef.current.emit('next-question', {
        room_code: roomCode,
        user_id: user.id,
        current_index: currentIndex
      })
    }
  }

  const toggleStrikeOut = (questionId, optionId) => {
    setStruckOut(prev => {
      const current = prev[questionId] || new Set()
      const next = new Set(current)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        next.add(optionId)
      }
      return { ...prev, [questionId]: next }
    })
  }

  // Text highlighting functionality
  const handleTextSelection = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !stemRef.current) {
      setShowHighlightBtn(false)
      return
    }

    const selectedText = selection.toString().trim()
    if (!selectedText || selectedText.length === 0) {
      setShowHighlightBtn(false)
      return
    }

    // Check if selection is within the stem
    const range = selection.getRangeAt(0)
    if (!stemRef.current.contains(range.commonAncestorContainer)) {
      setShowHighlightBtn(false)
      return
    }

    // Get position for highlight button
    const rect = range.getBoundingClientRect()
    setHighlightBtnPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 10
    })
    setShowHighlightBtn(true)
  }

  const applyHighlight = () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !currentQuestion) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    const range = selection.getRangeAt(0)
    const start = range.startOffset
    const end = range.endOffset
    const container = range.startContainer

    // Get the text content and position relative to stem
    let fullText = stemRef.current?.textContent || ''
    let actualStart = 0
    
    // Find position in full text
    const walker = document.createTreeWalker(
      stemRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )
    
    let currentPos = 0
    let node = walker.nextNode()
    while (node) {
      if (node === container) {
        actualStart = currentPos + start
        break
      }
      currentPos += node.textContent.length
      node = walker.nextNode()
    }

    const actualEnd = actualStart + selectedText.length

    const newHighlight = {
      start: actualStart,
      end: actualEnd,
      text: selectedText,
      id: Date.now()
    }

    setHighlights(prev => {
      const current = prev[currentQuestion.id] || []
      
      // Add new highlight and merge overlapping ones
      const allHighlights = [...current, newHighlight]
      const merged = mergeOverlappingHighlights(allHighlights)
      
      return { ...prev, [currentQuestion.id]: merged }
    })

    setShowHighlightBtn(false)
    selection.removeAllRanges()
  }

  // Merge overlapping or adjacent highlights
  const mergeOverlappingHighlights = (highlights) => {
    if (highlights.length <= 1) return highlights

    // Sort by start position
    const sorted = [...highlights].sort((a, b) => a.start - b.start)
    const merged = []
    let current = sorted[0]

    for (let i = 1; i < sorted.length; i++) {
      const next = sorted[i]
      
      // Check if current and next overlap or are adjacent
      if (next.start <= current.end) {
        // Merge them
        current = {
          start: current.start,
          end: Math.max(current.end, next.end),
          text: '', // Will be recalculated from stem
          id: current.id // Keep the original ID
        }
      } else {
        // No overlap, add current to merged and move to next
        merged.push(current)
        current = next
      }
    }
    
    // Add the last one
    merged.push(current)
    
    return merged
  }

  const removeHighlight = (questionId, highlightId) => {
    setHighlights(prev => {
      const current = prev[questionId] || []
      const filtered = current.filter(hl => hl.id !== highlightId)
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[questionId]
        return next
      }
      return { ...prev, [questionId]: filtered }
    })
  }

  const clearHighlights = (questionId) => {
    setHighlights(prev => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
  }

  const renderHighlightedText = (text, questionId) => {
    const questionHighlights = highlights[questionId] || []
    if (questionHighlights.length === 0) return text

    // Sort highlights by start position
    const sorted = [...questionHighlights].sort((a, b) => a.start - b.start)
    
    const parts = []
    let lastIndex = 0
    
    sorted.forEach((hl, idx) => {
      // Add text before highlight
      if (hl.start > lastIndex) {
        parts.push({ text: text.slice(lastIndex, hl.start), highlighted: false, key: `text-${idx}`, highlightId: null })
      }
      // Add highlighted text
      parts.push({ text: text.slice(hl.start, hl.end), highlighted: true, key: `hl-${hl.id}`, highlightId: hl.id })
      lastIndex = hl.end
    })
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlighted: false, key: 'text-end', highlightId: null })
    }
    
    return parts.map(part => 
      part.highlighted 
        ? (
          <span key={part.key} className="highlight-wrapper">
            <mark className="highlight">{part.text}</mark>
            <button
              className="highlight-remove-btn"
              onClick={(e) => {
                e.preventDefault()
                removeHighlight(questionId, part.highlightId)
              }}
              title="Remove this highlight"
              aria-label="Remove highlight"
            >
              ×
            </button>
          </span>
        )
        : <span key={part.key}>{part.text}</span>
    )
  }

  // Listen for text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection)
    return () => document.removeEventListener('mouseup', handleTextSelection)
  }, [])

  // Calculate topic-level performance
  const calculateTopicPerformance = () => {
    const topicStats = {}
    
    questions.forEach((q) => {
      const topicId = q.topic_id
      const topicName = q.topic_name || 'Unknown Topic'
      const topicSlug = q.topic_slug || null
      const specialtyId = q.specialty_id || null
      
      if (!topicStats[topicId]) {
        topicStats[topicId] = {
          topic_id: topicId,
          topic_name: topicName,
          topic_slug: topicSlug,
          specialty_id: specialtyId,
          total: 0,
          correct: 0,
          incorrect: 0,
          skipped: 0
        }
      }
      
      const userAnswer = userAnswers[q.id]
      topicStats[topicId].total += 1
      
      if (userAnswer?.submitted) {
        if (userAnswer.isCorrect) {
          topicStats[topicId].correct += 1
        } else {
          topicStats[topicId].incorrect += 1
        }
      } else {
        topicStats[topicId].skipped += 1
      }
    })
    
    // Calculate accuracy and identify weak topics
    const topicPerformance = Object.values(topicStats).map((stats) => {
      const attempted = stats.correct + stats.incorrect
      const accuracy = attempted > 0 ? Math.round((stats.correct / attempted) * 100) : null
      
      return {
        ...stats,
        attempted,
        accuracy
      }
    })
    
    // Filter weak topics:
    // - At least 2 questions attempted AND accuracy < 70%, OR
    // - At least 3 incorrect answers (regardless of accuracy)
    const weakTopics = topicPerformance
      .filter(t => {
        const hasLowAccuracy = t.attempted >= 2 && (t.accuracy === null || t.accuracy < 70)
        const hasManyIncorrect = t.incorrect >= 3
        return hasLowAccuracy || hasManyIncorrect
      })
      .sort((a, b) => {
        // Sort by accuracy (null/0 first), then by incorrect count (highest first)
        const aAcc = a.accuracy ?? 0
        const bAcc = b.accuracy ?? 0
        if (aAcc !== bAcc) return aAcc - bAcc
        return b.incorrect - a.incorrect
      })
      .slice(0, 5) // Limit to top 5 weak topics
    
    return { topicPerformance, weakTopics }
  }

  // Navigate to results with partial stats (for Exit or early finish)
  const navigateToResults = () => {
    const totalQuestions = questions.length
    const correct = sessionCorrect
    const skipped = Math.max(totalQuestions - sessionAnswered, 0)
    const totalMs = sessionTotalMs
    const perQuestionMs = sessionAnswered ? sessionTotalMs / sessionAnswered : 0
    const { topicPerformance, weakTopics } = calculateTopicPerformance()
    
    navigate('/dashboard/question-bank/results', {
      state: { 
        totalQuestions, 
        correct, 
        skipped, 
        totalMs, 
        perQuestionMs,
        topicPerformance,
        weakTopics,
        specialtyId,
        specialtyName,
        studySetId,
        studySetName
      }
    })
  }

  const submit = async () => {
    if (!questions[currentIndex] || submitting) return
    
    const currentQuestion = questions[currentIndex]
    const questionId = currentQuestion.id
    
    // Don't submit if already submitted
    if (submittedAnswers.has(questionId)) return
    
    setSubmitting(true)
    
    try {
      console.log('=== FRONTEND SUBMIT ===')
      console.log('Selected:', selected, 'Question type:', currentQuestion.type)
      
      // Calculate if answer is correct on frontend
      let isCorrect = false
      if (currentQuestion.type === 'MCQ') {
        isCorrect = selected === currentQuestion.correct_answer
      } else {
        // For SAQ, we'd need to implement the checking logic here
        // For now, assume it's handled elsewhere or simplified
        isCorrect = false // Placeholder
      }
      
      const timeTaken = Date.now() - questionStartTime
      
      // Save user's answer locally
      setUserAnswers(prev => ({
        ...prev,
        [questionId]: {
          selected,
          saqText,
          isCorrect,
          timeTaken,
          submitted: true
        }
      }))
      
      // Mark as submitted
      setSubmittedAnswers(prev => new Set([...prev, questionId]))
      
      // Clear strikethrough state for this question
      setStruckOut(prev => {
        const next = { ...prev }
        delete next[questionId]
        return next
      })
      
      // Update session stats
      const newAnswered = sessionAnswered + 1
      setSessionAnswered(newAnswered)
      setSessionCorrect(prev => prev + (isCorrect ? 1 : 0))
      setSessionTotalMs(prev => prev + timeTaken)
      
      // Submit to backend for tracking
      const payload = {
        question_id: questionId,
        selected_option_id: currentQuestion.type === 'MCQ' ? selected : undefined,
        text_answer: currentQuestion.type === 'SAQ' ? saqText : undefined,
        time_taken_ms: timeTaken,
        is_correct: isCorrect
      }
      
      // Don't await this - let it happen in background
      fetch(`${API_BASE}/qbank/practice/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify(payload)
      }).catch(error => {
        console.error('Error submitting to backend:', error)
      })
      
      // Emit socket event for group sessions (peer-to-peer)
      if (socketRef.current) {
        const username = user.username || user.email || 'Anonymous'
        socketRef.current.emit('group-answer', {
          room_code: roomCode,
          user_id: user.id,
          username: username,
          question_id: questionId,
          question_index: currentIndex,
          answer: selected,
          is_correct: isCorrect,
          time_taken: timeTaken
        })
        // Also update local state immediately (don't wait for peer broadcast)
        const key = `${questionId}_${currentIndex}`
        setQuestionAnswers(prev => {
          const updated = { ...prev }
          const existing = updated[key] || []
          const filtered = existing.filter((a) => a.user_id !== user.id)
          filtered.push({
            user_id: user.id,
            username: username,
            answer: selected,
            is_correct: isCorrect
          })
          updated[key] = filtered
          return updated
        })
      }
      
      console.log('Answer submitted successfully')
      
    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setSubmitting(false)
    }
  }

  // Update tracker chunk size based on window width
  useEffect(() => {
    const updateChunkSize = () => {
      if (window.innerWidth <= 768) {
        setTrackerChunkSize(25)
      } else if (window.innerWidth <= 1024) {
        setTrackerChunkSize(35)
      } else {
        setTrackerChunkSize(35)
      }
    }
    
    updateChunkSize()
    window.addEventListener('resize', updateChunkSize)
    return () => window.removeEventListener('resize', updateChunkSize)
  }, [])

  // Keyboard shortcuts: 1-5 to select options, Enter to submit/next
  useEffect(() => {
    const handleKeyDown = (e) => {
      // ignore when typing in inputs/textareas/contentEditable or with modifiers
      const tag = e.target?.tagName?.toLowerCase()
      const isEditable = e.target?.isContentEditable
      if (tag === 'input' || tag === 'textarea' || isEditable) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const cq = questions[currentIndex]
      if (!cq) return

      // number keys 1-5 -> select option if available and not submitted
      if (e.key >= '1' && e.key <= '5') {
        if (submittedAnswers.has(cq.id)) return
        const idx = parseInt(e.key, 10) - 1
        if (Array.isArray(cq.options) && cq.options[idx]) {
          setSelected(cq.options[idx].id)
          e.preventDefault()
        }
        return
      }

      // Enter -> submit if not submitted and answer present; otherwise go next
      if (e.key === 'Enter') {
        const alreadySubmitted = submittedAnswers.has(cq.id)
        if (!alreadySubmitted) {
          const hasAnswer = Array.isArray(cq.options) && cq.options.length > 0
            ? (selected !== null && selected !== undefined)
            : (saqText.trim() !== '')
          if (hasAnswer && !submitting) {
            e.preventDefault()
            submit()
          }
        } else {
          e.preventDefault()
          goToNext()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [questions, currentIndex, selected, saqText, submittedAnswers, submitting])

  if (loading) return (
    <div className="pr">
      <LoadingScreen message="Loading practice session..." inline />
    </div>
  )

  if (!questions.length) {
    return <div>No questions available</div>
  }

  const currentQuestion = questions[currentIndex]
  const questionId = currentQuestion?.id
  const userAnswer = userAnswers[questionId]
  const isSubmitted = submittedAnswers.has(questionId)
  
  // Get result data for explanation display
  const result = isSubmitted ? {
    is_correct: userAnswer?.isCorrect || false,
    correct_option: currentQuestion.type === 'MCQ' ? {
      id: currentQuestion.correct_answer,
      label: String.fromCharCode(65 + currentQuestion.correct_answer),
      body: currentQuestion.options[currentQuestion.correct_answer]?.body
    } : null,
    explanations: currentQuestion.explanations
  } : null

  // Build list of all five per-option quick points (always show all)
  const pointsByOption = currentQuestion?.explanations?.points_by_option || null
  const allQuickPoints = pointsByOption
    ? [0,1,2,3,4].map((idx)=>({
        label: String.fromCharCode(65 + idx),
        text: (pointsByOption[String(idx)]?.[0]) || null,
        isCorrect: currentQuestion?.correct_answer === idx,
      }))
      .filter((p)=>p.text)
    : []

  return (
    <div className="pr">
      <div className="pr__top">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Question Bank</h2>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '4px 12px',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700
            }}>
              <LuUsers size={14} />
              Group Session
            </div>
          </div>
          <div style={{ color: '#64748b', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #06b6d4 100%)',
              color: '#fff',
              fontWeight: 800,
              fontSize: 18
            }}>
              {currentIndex + 1}
            </div>
            <div>
              <div>Round {currentIndex + 1} of {questions.length}</div>
              {roomCode && <div style={{ fontSize: 12 }}>Room: {roomCode}</div>}
            </div>
          </div>
        </div>
        <div className="pr__top-right">
          {timerMinutes > 0 && (
            <div className="pr__timer">
              <div className="pr__time" style={seconds <= 60 && seconds > 0 ? { color: '#ef4444' } : {}}>{display}</div>
              <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>Server Synced</div>
            </div>
          )}
          <button onClick={handleExit} className="btn btn--exit btn--icon" title="Exit and view results"><LuX />Exit</button>
        </div>
      </div>

          {currentQuestion && (
        <div className="pr__grid">
          <div className="card question-card">
            <div className="card__body">
              <div className="question-content">
                <div className="question-stem-wrapper">
                  <div ref={stemRef} className="question-stem" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>
                    {renderHighlightedText(currentQuestion.stem, currentQuestion.id)}
                  </div>
                </div>
                {Array.isArray(currentQuestion.assets) && currentQuestion.assets.length > 0 && (
                  (() => {
                    const assets = currentQuestion.assets.filter(a => a && a.url)
                    const cur = assets[Math.min(assetIdx, Math.max(assets.length - 1, 0))]
                    const prev = () => setAssetIdx((i) => assets.length > 0 ? (i - 1 + assets.length) % assets.length : 0)
                    const next = () => setAssetIdx((i) => assets.length > 0 ? (i + 1) % assets.length : 0)
                    if (!cur) return null
                    return (
                      <div className="q-carousel" role="region" aria-label="Question images">
                        <button
                          type="button"
                          className="qc-nav qc-prev"
                          onClick={prev}
                          aria-label="Previous image"
                          disabled={assets.length <= 1}
                        >
                          ‹
                        </button>
                        <figure key={cur.id} className="q-asset">
                          {cur.type === 'image' ? (
                            <img src={cur.url} alt={cur.alt || ''} loading="lazy" decoding="async" />
                          ) : null}
                          {(cur.caption || cur.credit) && (
                            <figcaption className="q-asset__cap">
                              {cur.caption && <div className="q-asset__caption">{cur.caption}</div>}
                              {cur.credit && <div className="q-asset__credit">{cur.credit}</div>}
                            </figcaption>
                          )}
                        </figure>
                        <button
                          type="button"
                          className="qc-nav qc-next"
                          onClick={next}
                          aria-label="Next image"
                          disabled={assets.length <= 1}
                        >
                          ›
                        </button>
                        {assets.length > 1 && (
                          <div className="qc-dots" role="tablist" aria-label="Image selector">
                            {assets.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`qc-dot ${i === assetIdx ? 'is-active' : ''}`}
                                aria-label={`Go to image ${i + 1}`}
                                aria-selected={i === assetIdx ? 'true' : 'false'}
                                onClick={() => setAssetIdx(i)}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })()
                )}
                {currentQuestion.options?.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {currentQuestion.options.map((o) => {
                      const isCorrect = result?.correct_option?.label === o.label;
                      const isSelectedIncorrect = selected === o.id && result && !result.is_correct;
                      const isStruckOut = (struckOut[questionId] || new Set()).has(o.id);
                      const className = `option ${selected === o.id ? 'option--selected' : ''} ${result ? (isCorrect ? 'option--correct' : isSelectedIncorrect ? 'option--incorrect' : '') : ''} ${isStruckOut ? 'option--struck' : ''}`;
                      
                      return (
                        <div key={o.id} className="option-wrapper">
                          <label className={className}>
                            <input 
                              type="radio" 
                              name="opt" 
                              value={o.id} 
                              checked={selected === o.id} 
                              onChange={() => !isStruckOut && setSelected(o.id)} 
                              disabled={isSubmitted || isStruckOut} 
                            />
                            <div className="option__label">{o.label}.</div>
                            <div className="option__body">{o.body}</div>
                          </label>
                          {!isSubmitted && (
                            <button
                              type="button"
                              className={`option-strike-btn ${isStruckOut ? 'is-active' : ''}`}
                              onClick={() => toggleStrikeOut(questionId, o.id)}
                              title={isStruckOut ? 'Remove elimination' : 'Eliminate option'}
                              aria-label={isStruckOut ? 'Remove elimination' : 'Eliminate option'}
                            >
                              <LuSlash size={16} />
                            </button>
                          )}
                          {/* Show who answered this option */}
                          {isSubmitted && (() => {
                            const answerKey = `${questionId}_${currentIndex}`
                            const answersForOption = (questionAnswers[answerKey] || []).filter(a => a.answer === o.id)
                            if (answersForOption.length === 0) return null
                            return (
                              <div style={{ 
                                marginTop: 8, 
                                padding: 8, 
                                background: isCorrect ? '#dcfce7' : '#fef3c7', 
                                borderRadius: 6,
                                fontSize: 13
                              }}>
                                <div style={{ fontWeight: 700, marginBottom: 4, color: isCorrect ? '#166534' : '#92400e' }}>
                                  {answersForOption.length} {answersForOption.length === 1 ? 'person' : 'people'} chose {o.label}
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                  {answersForOption.map((a) => (
                                    <span 
                                      key={a.user_id}
                                      style={{
                                        padding: '4px 8px',
                                        background: a.is_correct ? '#22c55e' : '#f59e0b',
                                        color: '#fff',
                                        borderRadius: 4,
                                        fontSize: 12,
                                        fontWeight: 600
                                      }}
                                    >
                                      {a.username}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <textarea className="saq-input" placeholder="Type your answer here..." value={saqText} onChange={(e)=>setSaqText(e.target.value)} disabled={isSubmitted} />
                )}
              </div>
              <div className="controls">
                <div className="controls__left">
                  {/* <button className="btn btn--ghost btn--icon"><LuSave />Save</button> */}
                  <button className={`btn btn--ghost btn--icon ${flagged.has(questionId) ? 'is-flagged' : ''}`} onClick={()=>{
                    setFlagged(prev => {
                      const next = new Set(prev)
                      if (next.has(questionId)) next.delete(questionId); else next.add(questionId)
                      return next
                    })
                  }}><LuFlag />{flagged.has(questionId) ? 'Flagged' : 'Flag'}</button>
                  {(highlights[currentQuestion.id]?.length > 0) && (
                    <button 
                      className="btn btn--ghost btn--icon"
                      onClick={() => clearHighlights(currentQuestion.id)}
                      title="Clear all highlights"
                    >
                      <LuEraser />Clear Highlights
                    </button>
                  )}
                </div>
                <div className="controls__right">
                  {!isSubmitted ? (
                    <button onClick={submit} disabled={submitting || (currentQuestion.options?.length > 0 ? selected === null || selected === undefined : saqText.trim() === '')} className="btn btn--primary">
                      {submitting ? 'Submitting...' : 'Submit'}
                    </button>
                  ) : (
                    <>
                      {isHost && (
                        <button onClick={goToNext} className="btn btn--primary btn--icon">
                          {currentIndex === questions.length - 1 ? 'Finish Session' : 'Next Question'} <LuArrowRight />
                        </button>
                      )}
                      {!isHost && (
                        <div style={{ padding: '8px 16px', background: '#f1f5f9', borderRadius: 8, fontSize: 14, color: '#64748b' }}>
                          Waiting for host to move to next question...
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {result && (
            <div className="card explanation-card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={`ex-card__status ${result.is_correct ? 'ex-card__status--correct' : 'ex-card__status--incorrect'}`}>
                  {result.is_correct ? <LuCircleCheck /> : <LuCircleAlert />}
                  {result.is_correct ? 'Correct' : 'Incorrect'}
                </div>
                <div className="tabs">
                  <div className={`tab ${tab==='quick' ? 'tab--active' : ''}`} onClick={()=>setTab('quick')}>Quick</div>
                  <div className={`tab ${tab==='detailed' ? 'tab--active' : ''}`} onClick={()=>setTab('detailed')}>Detailed</div>
                  <div className={`tab ${tab==='eli5' ? 'tab--active' : ''}`} onClick={()=>setTab('eli5')}>ELI5</div>
                </div>
              </div>
              <div className="card__body explain">
                {!result.is_correct && result.correct_option && (
                  <div className="correct-answer-banner">
                    <LuCircleCheck className="correct-answer-icon" />
                    <div>
                      <div className="correct-answer-title">Correct Answer</div>
                      <div className="correct-answer-text">{result.correct_option.label}. {result.correct_option.body}</div>
                    </div>
                  </div>
                )}
                {tab==='quick' && (
                  <div>
                    {allQuickPoints && allQuickPoints.length > 0 ? (
                      <div className="explain__section">
                        <div className="explain__label">Explanations:</div>
                        <ul className="key-points">
                          {allQuickPoints.map((p, idx) => (
                            <li key={idx} className={`key-point ${p.isCorrect ? 'key-point--correct' : ''}`}>
                              <div className={`key-point-badge ${p.isCorrect ? 'is-correct' : 'is-wrong'}`}>{p.label}</div>
                              <div>{p.text}</div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="explain__section">
                        <div className="explain__label">Explanations:</div>
                        <div>No quick points available</div>
                      </div>
                    )}
                  </div>
                )}
                {tab==='detailed' && (
                  <div>
                    <div className="explain__section">
                      <div className="explain__label">Detailed Explanation:</div>
                      <div>{result?.explanations?.detailed || 'No detailed explanation available'}</div>
                    </div>
                  </div>
                )}
                {tab==='eli5' && (
                  <div>
                    <div className="eli5-section">
                      <div className="eli5-header">
                        <LuLightbulb className="eli5-icon" />
                        <span className="eli5-title">Explain Like I'm 5</span>
                      </div>
                      <div className="eli5-content">{result?.explanations?.eli5 || 'No ELI5 explanation available'}</div>
                    </div>
                  </div>
                )}
                
                {/* Textbook Link */}
                {currentQuestion?.textbook_slug && (
                  <div className="textbook-link-section">
                    <a
                      href={`/dashboard/textbook/topic/${currentQuestion.textbook_slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="textbook-link-btn"
                    >
                      <LuBookOpen size={18} />
                      <span>View {currentQuestion.topic_name} in Textbook</span>
                      <LuExternalLink size={14} className="external-icon" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ gridColumn: '1', gridRow: result ? '3' : '2' }}>
            {isSubmitted ? (
              <DiscussionPanel questionId={currentQuestion.id} API_BASE={API_BASE} />
            ) : (
              <div className="card discussion-card discussion-card--locked">
                <div className="card__header discussion-card__header">
                  <div className="discussion-card__title">Student Discussion</div>
                  <div className="discussion-card__lock-badge">
                    <LuCircleAlert size={16} />
                    Locked
                  </div>
                </div>
                <div className="card__body discussion-card__placeholder">
                  <div className="discussion-placeholder">
                    <LuBookOpen size={32} className="discussion-placeholder__icon" />
                    <p className="discussion-placeholder__text">
                      Answer this question to view and participate in student discussions
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pr__aside">
            <div className="card">
              <div className="card__header">Session Progress</div>
              <div className="card__body progress">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#1f2937' }}>
                  <div>Questions Completed</div>
                  <div>{sessionAnswered}/{questions.length}</div>
                </div>
                <div className="progress__bar"><div className="progress__fill" style={{ width: `${Math.round((sessionAnswered / questions.length) * 100)}%` }} /></div>
                <div className="progress__stats" style={{ justifyContent: 'space-around' }}>
                  <div>
                    <div className="stat--green">{sessionAnswered ? Math.round((sessionCorrect/sessionAnswered)*100) : 0}%</div>
                    <div className="stat-label">Accuracy</div>
                  </div>
                  <div>
                    <div className="stat--blue">{sessionAnswered ? Math.round((sessionTotalMs/sessionAnswered)/1000) : 0}s</div>
                    <div className="stat-label">Avg Time</div>
                  </div>
                </div>
                {/* <div style={{ height: 8, borderTop: '1px solid #eef2f7', marginTop: 10 }} />
                <div style={{ color: '#1f2937', fontWeight: 700 }}>Weak Areas Detected</div>
                <div style={{ height: 8 }} /> */}
              </div>
            </div>

            {/* Reference Ranges */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>Reference Ranges</div>
                <button className="btn btn--ghost btn--icon" onClick={()=> setShowRef(s=>!s)}>{showRef ? 'Hide' : 'Show'}</button>
              </div>
              <div className={`refcard__content ${showRef ? 'is-open' : ''}`}>
                <div className="refcard__inner">
                  {refRanges && refRanges.length > 0 ? (
                    <div className="refacc">
                      {refRanges.map((grp) => {
                        const isOpen = openGroupId === grp.id
                        return (
                          <div key={grp.id} className={`refacc__section ${isOpen ? 'is-open' : ''}`}>
                            <button className="refacc__btn" onClick={() => {
                              setOpenGroupId(prev => (prev === grp.id ? null : grp.id))
                            }}>
                              <span className="refacc__title">{grp.title}</span>
                              <span className="refacc__caret" aria-hidden>▾</span>
                            </button>
                            <div className="refacc__panel" style={{ maxHeight: isOpen ? 'none' : 0 }}>
                              <div className="refcat__items">
                                {(() => {
                                  const groups = {};
                                  for (const it of (grp.items || [])) {
                                    const key = `${it.analyte}||${it.unit || ''}`;
                                    if (!groups[key]) {
                                      groups[key] = { analyte: it.analyte, unit: it.unit || null, populations: [] };
                                    }
                                    const label = (it.population || '').trim();
                                    groups[key].populations.push({
                                      label: label,
                                      isGeneral: label.toLowerCase() === 'general' || label === ''
                                    , value: it.value_text });
                                  }
                                  const rows = Object.values(groups);
                                  return rows.map((row, idx) => {
                                    const specific = row.populations.filter(p => !p.isGeneral);
                                    const general = row.populations.find(p => p.isGeneral) || null;
                                    const toShow = specific.length > 0 ? specific : (general ? [general] : []);
                                    const weight = (label) => {
                                      const L = (label || '').toLowerCase().trim();
                                      if (L === 'male') return 0;
                                      if (L === 'female') return 1;
                                      return 2;
                                    };
                                    const sortedToShow = Array.isArray(toShow)
                                      ? [...toShow].sort((a, b) => {
                                          const dw = weight(a.label) - weight(b.label);
                                          if (dw !== 0) return dw;
                                          return String(a.label || '').localeCompare(String(b.label || ''), undefined, { sensitivity: 'base' });
                                        })
                                      : toShow;
                                    return (
                                      <div key={idx} className="refrow refrow--grouped">
                                        <div className="refrow__left">
                                          <div className="refrow__analyte">{row.analyte}</div>
                                        </div>
                                        <div className="refrow__right refrow__right--groups">
                                          {toShow.length === 1 && toShow[0].isGeneral ? (
                                            <div className="refrow__valueblock">
                                              <div className="refrow__value">{toShow[0].value}</div>
                                              {row.unit && <div className="refrow__unit">{row.unit}</div>}
                                            </div>
                                          ) : (
                                            sortedToShow.map((p, j) => (
                                              <div key={j} className="refrow__valueblock">
                                                <div className="refrow__poplabel">{p.label}</div>
                                                <div className="refrow__value">{p.value}</div>
                                                {row.unit && <div className="refrow__unit">{row.unit}</div>}
                                              </div>
                                            ))
                                          )}
                                        </div>
                                      </div>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="refcard__empty">No reference ranges available</div>
                  )}
                </div>
              </div>
            </div>

            {/* Track Questions */}
            <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header">Track Questions</div>
              <div className="card__body">
                <div className="trk-controls">
                  <div className="trk-filters">
                    {['All','Unanswered','Correct','Wrong','Flagged'].map((f)=> (
                      <button key={f} className={`chip ${trkFilter===f ? 'is-active' : ''}`} onClick={()=>setTrkFilter(f)}>{f}</button>
                    ))}
                  </div>
                  <div className="trk-jump">
                    <input
                      type="number"
                      min="1"
                      max={questions.length}
                      placeholder="#"
                      className="trk-input"
                      value={trkJump}
                      onChange={(e)=> setTrkJump(e.target.value)}
                      onKeyDown={(e)=>{
                        if (e.key === 'Enter') {
                          const val = parseInt(trkJump || '0', 10)
                          if (val >= 1 && val <= questions.length) {
                            const idx = val - 1
                            setCurrentIndex(idx); loadCurrentQuestion(idx)
                            setTimeout(()=>{ window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                          }
                        }
                      }}
                    />
                    <button className="btn btn--ghost btn--icon" onClick={()=>{
                      const val = parseInt(trkJump || '0', 10)
                      if (val >= 1 && val <= questions.length) {
                        const idx = val - 1
                        setCurrentIndex(idx); loadCurrentQuestion(idx)
                        setTimeout(()=>{ window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                      }
                    }}>Go</button>
                  </div>
                </div>

                <div className="trk-rows">
                  {Array.from({ length: Math.ceil(questions.length / trackerChunkSize) }).map((_, rowIdx) => {
                    const start = rowIdx * trackerChunkSize
                    const end = Math.min(start + trackerChunkSize, questions.length)
                    return (
                      <div key={rowIdx} className="trk-row">
                        <div className="trk-row__label">{start + 1}–{end}</div>
                        <div className="trk-row__grid">
                          {questions.slice(start, end).map((q, localIdx) => {
                            const idx = start + localIdx
                            const qid = q.id
                            const ua = userAnswers[qid]
                            const isCurrent = idx === currentIndex
                            const isFlag = flagged.has(qid)
                            let status = 'Unanswered'
                            if (ua?.submitted) status = ua.isCorrect ? 'Correct' : 'Wrong'
                            const matchesFilter = trkFilter==='All' || (trkFilter==='Flagged' ? isFlag : trkFilter===status)
                            const classes = `seg seg--${status.toLowerCase()} ${isCurrent ? 'seg--current' : ''} ${isFlag ? 'seg--flagged' : ''} ${matchesFilter ? '' : 'seg--dim'}`
                            return (
                              <button
                                key={qid}
                                className={classes}
                                aria-label={`Go to question ${idx+1}. Status: ${status}. ${isFlag ? 'Flagged.' : ''}`}
                                title={`Q${idx+1} • ${status}${isFlag ? ' • flagged' : ''}`}
                                onClick={() => {
                                  setCurrentIndex(idx); loadCurrentQuestion(idx)
                                  setTimeout(()=>{ window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                                }}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {Array.from(flagged).length > 0 && (
                  <div className="trk-flagged-rail">
                    <div className="trk-rail__label">Flagged</div>
                    <div className="trk-rail__list">
                      {questions.map((q, idx)=> flagged.has(q.id) ? (
                        <button key={q.id} className="pill" onClick={()=>{ setCurrentIndex(idx); loadCurrentQuestion(idx); setTimeout(()=>{ window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0) }}>{idx+1}</button>
                      ) : null)}
                    </div>
                  </div>
                )}

                <div className="trk-legend">
                  <span className="legend-item"><span className="legend-swatch swatch--correct" /> Correct</span>
                  <span className="legend-item"><span className="legend-swatch swatch--wrong" /> Wrong</span>
                  <span className="legend-item"><span className="legend-swatch swatch--unanswered" /> Unanswered</span>
                  <span className="legend-item"><span className="legend-swatch swatch--current" /> Current</span>
                  <span className="legend-item"><span className="legend-swatch swatch--flagged" /> Flagged</span>
                </div>
              </div>
            </div>

            {/* <div className="card" style={{ marginTop: 16 }}>
              <div className="card__header">Quick Actions</div>
              <div className="card__body quick-actions">
                <button className="qa-btn"><LuBookOpen /> View in Textbook</button>
                <button className="qa-btn"><LuShare2 /> Share Question</button>
                <button className="qa-btn"><LuPlus /> Add to Review Deck</button>
              </div>
            </div> */}

          </div>
        </div>
      )}

      {/* Floating highlight button */}
      {showHighlightBtn && (
        <button
          className="highlight-btn-float"
          style={{
            position: 'fixed',
            left: `${highlightBtnPos.x}px`,
            top: `${highlightBtnPos.y}px`,
            transform: 'translate(-50%, -100%)',
            zIndex: 1000
          }}
          onClick={applyHighlight}
          onMouseDown={(e) => e.preventDefault()}
        >
          <LuHighlighter size={16} />
          Highlight
        </button>
      )}
    </div>
  )
}


