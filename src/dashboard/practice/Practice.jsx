import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { authHeaders } from '../../auth/token'
import { useLocation, useNavigate } from 'react-router-dom'
import './Practice.css'
import { LuSave, LuFlag, LuChevronLeft, LuArrowRight, LuPause, LuPlay, LuBookOpen, LuShare2, LuPlus, LuCircleCheck, LuCircleAlert, LuLightbulb, LuX, LuSlash, LuHighlighter, LuEraser, LuExternalLink, LuEye } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import DiscussionPanel from './DiscussionPanel'
import ReportIssueButton from './ReportIssueButton'
import ReferenceRangesPanel from './ReferenceRangesPanel'
import HighlightPopover from '../../components/highlight/HighlightPopover'
import {
  getFlatTextFromStem,
  mapFlatRangeToMarkdownRange,
  splitFlatRangeByTableCellsAndSnap,
} from '../../utils/questionStemHighlight'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import remarkGfm from 'remark-gfm'

// Custom Rehype plugin to apply highlights to text nodes
const rehypeHighlightPlugin = (options) => {
  const { highlights } = options || {}

  return (tree) => {
    if (!highlights || highlights.length === 0) return

    let currentIndex = 0
    const sortedHighlights = [...highlights].sort((a, b) => a.start - b.start)

    const getTextLength = (node) => {
      if (node.type === 'text') return node.value.length
      if (node.children) return node.children.reduce((acc, child) => acc + getTextLength(child), 0)
      return 0
    }

    const traverse = (node) => {
      // Skip our own highlight wrappers to avoid checking inside them
      if (node.tagName === 'span' && node.properties?.className?.includes('highlight-wrapper')) {
        currentIndex += getTextLength(node)
        return
      }

      if (node.children) {
        let i = 0
        while (i < node.children.length) {
          const child = node.children[i]

          if (child.type === 'text') {
            const text = child.value
            const start = currentIndex
            const end = start + text.length

            const highlight = sortedHighlights.find(h => h.start < end && h.end > start)

            if (highlight) {
              const relStart = Math.max(0, highlight.start - start)
              const relEnd = Math.min(text.length, highlight.end - start)

              const newNodes = []

              if (relStart > 0) {
                newNodes.push({ type: 'text', value: text.slice(0, relStart) })
              }

              const hlText = text.slice(relStart, relEnd)
              newNodes.push({
                type: 'element',
                tagName: 'span',
                properties: {
                  className: ['highlight-wrapper'],
                  'data-highlight-id': highlight.id
                },
                children: [{
                  type: 'element',
                  tagName: 'mark',
                  properties: { className: ['highlight'] },
                  children: [{ type: 'text', value: hlText }]
                }]
              })

              if (relEnd < text.length) {
                newNodes.push({ type: 'text', value: text.slice(relEnd) })
              }

              node.children.splice(i, 1, ...newNodes)
              continue
            }

            currentIndex += text.length
            i++

          } else {
            traverse(child)
            i++
          }
        }
      }
    }

    traverse(tree)
  }
}

function useCountdown(initialSec = 1800) {
  const [seconds, setSeconds] = useState(initialSec)
  const [running, setRunning] = useState(true)
  const timerRef = useRef(null)
  useEffect(() => {
    if (!running) return
    timerRef.current = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timerRef.current)
  }, [running])
  const toggle = () => setRunning((r) => !r)
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  return { seconds, display: `${mm}:${ss}`, running, toggle, setSeconds }
}

export default function Practice() {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)

  // Check if we're in review mode (navigated from results page)
  const reviewModeData = location.state?.reviewMode ? location.state : null
  const isReviewMode = !!reviewModeData

  const specialtyId = params.get('specialty_id') || reviewModeData?.sessionStats?.specialtyId
  const specialtyName = params.get('specialty_name') || reviewModeData?.sessionStats?.specialtyName || null
  const studySetId = params.get('study_set_id') || reviewModeData?.sessionStats?.studySetId
  const studySetName = params.get('study_set_name') || reviewModeData?.sessionStats?.studySetName || null
  const topicIds = params.get('topic_ids')
  const numQuestions = parseInt(params.get('num_questions') || '25')
  const timerMinutes = parseInt(params.get('timer_minutes') || '25')
  const includeAttempted = params.get('include_attempted') === '1'
  const includeIncorrect =
    (params.get('include_incorrect') === '1' || params.get('incorrect_only') === '1') && !includeAttempted

  // Session state
  const [loading, setLoading] = useState(!isReviewMode) // Don't show loading in review mode
  const [questions, setQuestions] = useState(reviewModeData?.questions || []) // Pre-populate in review mode
  const [currentIndex, setCurrentIndex] = useState(0)
  const [userAnswers, setUserAnswers] = useState(reviewModeData?.userAnswers || {}) // Pre-populate in review mode
  const [submittedAnswers, setSubmittedAnswers] = useState(() => {
    // In review mode, mark all answered questions as submitted
    if (reviewModeData?.userAnswers) {
      return new Set(Object.keys(reviewModeData.userAnswers).filter(id => reviewModeData.userAnswers[id]?.submitted).map(id => parseInt(id) || id))
    }
    return new Set()
  })
  const [flagged, setFlagged] = useState(new Set())
  const [struckOut, setStruckOut] = useState({}) // Track struck out options per question: { currentQuestionId: Set([optionId1, optionId2]) }
  const [highlights, setHighlights] = useState({}) // { questionId: [{ start, end, text, id, note }] }
  const [popoverHl, setPopoverHl] = useState(null) // { questionId, highlight, rect }
  const [showHighlightBtn, setShowHighlightBtn] = useState(false)
  const [highlightBtnPos, setHighlightBtnPos] = useState({ x: 0, y: 0 })
  const stemRef = useRef(null)
  const hasLoadedRef = useRef(false) // Prevent double-loading of session

  // Review mode filter state
  const [reviewFilter, setReviewFilter] = useState('All') // All | Correct | Incorrect | Skipped

  const getOffsetWithinStem = (targetNode, nodeOffset) => {
    if (!stemRef.current) return null
    if (!stemRef.current) return null

    const walker = document.createTreeWalker(
      stemRef.current,
      NodeFilter.SHOW_TEXT,
      null
    )

    let pos = 0
    let node = walker.nextNode()

    while (node) {
      if (node === targetNode) return pos + nodeOffset
      pos += node.textContent.length
      node = walker.nextNode()
    }

    return null
  }

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

  // Responsive tracker grid size - 50 questions per page for pagination
  const QUESTIONS_PER_PAGE = 50
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(0)

  const { display, running, toggle } = useCountdown(timerMinutes * 60)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Scroll to top on component mount
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Load all questions for the session (skip if in review mode)
  useEffect(() => {
    if (isReviewMode) {
      // In review mode, questions are already loaded from state
      // Just load reference ranges
      loadReferenceRanges()
      return
    }
    if (!specialtyId && !studySetId) {
      navigate('/dashboard/question-bank')
      return
    }
    // Prevent double-loading (can happen in StrictMode or rapid re-renders)
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true
    loadSession()
  }, [specialtyId, studySetId, isReviewMode])

  const loadReferenceRanges = async () => {
    try {
      const rRes = await fetch(`${API_BASE}/reference-ranges`, { credentials: 'include', headers: authHeaders() })
      if (rRes.ok) {
        const rData = await rRes.json()
        setRefRanges(Array.isArray(rData?.groups) ? rData.groups : [])
      }
    } catch (error) {
      console.error('Error loading reference ranges:', error)
    }
  }

  const loadSession = async () => {
    try {
      setLoading(true)
      let url = `${API_BASE}/qbank/practice/session?num_questions=${numQuestions}&include_attempted=${includeAttempted ? '1' : '0'}`
      if (includeIncorrect) url += '&include_incorrect=1'

      if (studySetId) {
        url += `&study_set_id=${studySetId}`
      } else {
        url += `&specialty_id=${specialtyId}`
        if (topicIds) {
          url += `&topic_ids=${topicIds}`
        }
      }

      // Load questions and reference ranges in parallel
      const [qRes, rRes] = await Promise.all([
        fetch(url, { credentials: 'include', headers: authHeaders() }),
        fetch(`${API_BASE}/reference-ranges`, { credentials: 'include', headers: authHeaders() })
      ])

      if (!qRes.ok) {
        let errorMessage = 'Failed to load session'
        try {
          const errorData = await qRes.json()
          errorMessage = errorData.details || errorData.error || errorMessage
          console.error('Session error details:', errorData)
        } catch (_e) {
          const errorText = await qRes.text()
          console.error('Session error response:', errorText)
        }
        throw new Error(errorMessage)
      }

      if (!rRes.ok) {
        console.warn('Failed to load reference ranges, continuing without them')
      }

      const [data, rData] = await Promise.all([
        qRes.json(),
        rRes.ok ? rRes.json() : Promise.resolve({ groups: [] })
      ])
      console.log('Loaded session with', data.questions?.length, 'questions')

      if (!data.questions || data.questions.length === 0) {
        if (data.all_attempted) {
          const setupParams = new URLSearchParams()
          if (studySetId) {
            setupParams.set('study_set_id', studySetId)
            if (params.get('study_set_name')) setupParams.set('study_set_name', params.get('study_set_name'))
          } else if (specialtyId) {
            setupParams.set('specialty_id', specialtyId)
            if (specialtyName) setupParams.set('specialty_name', specialtyName)
            if (topicIds) setupParams.set('topic_ids', topicIds)
          }
          if (data.incorrect_available > 0) {
            const useMix = window.confirm(
              `You have attempted every question here with "New questions only." Open setup to include unattempted and incorrectly answered questions together (${data.incorrect_available} incorrect available), or include all previous questions instead.`
            )
            if (useMix) {
              setupParams.set('include_incorrect', '1')
            } else {
              setupParams.set('include_attempted', '1')
            }
          } else {
            alert("You've attempted all questions in this set with \"New questions only.\" Use \"Include previously answered\" to keep practicing.")
            setupParams.set('include_attempted', '1')
          }
          navigate(`/dashboard/question-bank/setup?${setupParams.toString()}`)
          return
        }
        alert('No questions available for the selected criteria')
        navigate('/dashboard/question-bank')
        return
      }

      setQuestions(data.questions)
      setCurrentIndex(0)
      loadCurrentQuestion(0, data.questions)
      setQuestionStartTime(Date.now())
      setRefRanges(Array.isArray(rData?.groups) ? rData.groups : [])

      // Debug: Log first question to check textbook_slug
      if (data.questions && data.questions[0]) {
        console.log('First question data:', {
          id: data.questions[0].id,
          topic_name: data.questions[0].topic_name,
          textbook_slug: data.questions[0].textbook_slug,
          topic_slug: data.questions[0].topic_slug
        })
      }
    } catch (error) {
      console.error('Error loading session:', error)
      alert(`Failed to load practice session: ${error.message || 'Unknown error'}`)
      navigate('/dashboard/question-bank')
    } finally {
      setLoading(false)
    }
  }

  // Load the current question and restore user's previous answer if any
  const loadCurrentQuestion = (index, questionList = questions) => {
    if (!questionList || index < 0 || index >= questionList.length) return

    const question = questionList[index]
    const currentQuestionId = question.id
    const userAnswer = userAnswers[currentQuestionId]

    // Restore user's previous answer
    if (userAnswer) {
      setSelected(userAnswer.selected)
      setSaqText(userAnswer.saqText || '')
    } else {
      setSelected(null)
      setSaqText('')
    }

    setTab('quick')
    if (!isReviewMode) {
      setQuestionStartTime(Date.now())
    }
    setShowRef(false) // Reset reference ranges to collapsed on question change
    // Reset carousel index when question changes
    setAssetIdx(0)
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1
      setCurrentIndex(newIndex)
      loadCurrentQuestion(newIndex)
      // Auto-update range if navigating to a different range
      const newRange = Math.floor(newIndex / QUESTIONS_PER_PAGE)
      if (newRange !== selectedRangeIdx) {
        setSelectedRangeIdx(newRange)
      }
    }
  }

  const goToNext = () => {
    if (currentIndex < questions.length - 1) {
      const newIndex = currentIndex + 1
      setCurrentIndex(newIndex)
      loadCurrentQuestion(newIndex)
      // Auto-update range if navigating to a different range
      const newRange = Math.floor(newIndex / QUESTIONS_PER_PAGE)
      if (newRange !== selectedRangeIdx) {
        setSelectedRangeIdx(newRange)
      }
    } else {
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
          studySetName,
          questions,
          userAnswers
        }
      })
    }
  }

  const toggleStrikeOut = (currentQuestionId, optionId) => {
    setStruckOut(prev => {
      const current = prev[currentQuestionId] || new Set()
      const next = new Set(current)
      if (next.has(optionId)) {
        next.delete(optionId)
      } else {
        next.add(optionId)
      }
      return { ...prev, [currentQuestionId]: next }
    })
  }

  // Text highlighting functionality
  const addHighlightFromSelection = useCallback(() => {
    const selection = window.getSelection()
    const currentQ = questions[currentIndex]
    if (!selection || selection.isCollapsed || !currentQ || !stemRef.current) return

    const selectedText = selection.toString()
    if (!selectedText || /^\s*$/.test(selectedText)) return

    const range = selection.getRangeAt(0)

    // Only act if selection is inside the stem
    if (!stemRef.current.contains(range.commonAncestorContainer)) return

    const stemText = currentQ.stem || ''
    const flat = getFlatTextFromStem(stemRef.current)

    const startA = getOffsetWithinStem(range.startContainer, range.startOffset)
    const endA = getOffsetWithinStem(range.endContainer, range.endOffset)
    if (startA == null || endA == null) return

    const rawStart = Math.min(startA, endA)
    const rawEnd = Math.max(startA, endA)
    if (rawStart === rawEnd) return

    const snappedRanges = splitFlatRangeByTableCellsAndSnap(stemRef.current, flat, rawStart, rawEnd)
    if (snappedRanges.length === 0) return

    const isMd = hasMarkdown(stemText)
    const newHighlights = []
    let idBase = Date.now()
    for (const snapped of snappedRanges) {
      let hlStart
      let hlEnd
      let matchedText

      if (isMd) {
        const mapped = mapFlatRangeToMarkdownRange(stemText, flat, snapped.start, snapped.end)
        if (!mapped) continue
        hlStart = mapped.start
        hlEnd = mapped.end
        matchedText = stemText.slice(hlStart, hlEnd)
      } else {
        hlStart = snapped.start
        hlEnd = snapped.end
        matchedText = stemText.slice(hlStart, hlEnd)
      }

      newHighlights.push({
        start: hlStart,
        end: hlEnd,
        text: matchedText,
        id: idBase++,
      })
    }

    if (newHighlights.length === 0) return

    setHighlights(prev => {
      const current = prev[currentQ.id] || []
      const merged = mergeOverlappingHighlights([...current, ...newHighlights])
      return { ...prev, [currentQ.id]: merged }
    })

    // Clear blue selection
    selection.removeAllRanges()
  }, [questions, currentIndex])

  const handleTextSelection = useCallback(() => {
    addHighlightFromSelection()
    setShowHighlightBtn(false)
  }, [addHighlightFromSelection])

  const applyHighlight = () => {
    const selection = window.getSelection()
    const currentQ = questions[currentIndex]
    if (!selection || selection.isCollapsed || !currentQ || !stemRef.current) return

    const selectedText = selection.toString()
    if (!selectedText || !selectedText.trim()) return

    const range = selection.getRangeAt(0)
    if (!stemRef.current.contains(range.commonAncestorContainer)) return

    const stemText = currentQ.stem || ''
    const flat = getFlatTextFromStem(stemRef.current)

    const startA = getOffsetWithinStem(range.startContainer, range.startOffset)
    const endA = getOffsetWithinStem(range.endContainer, range.endOffset)
    if (startA == null || endA == null) return

    const rawStart = Math.min(startA, endA)
    const rawEnd = Math.max(startA, endA)
    if (rawStart === rawEnd) return

    const snappedRanges = splitFlatRangeByTableCellsAndSnap(stemRef.current, flat, rawStart, rawEnd)
    if (snappedRanges.length === 0) return

    const isMd = hasMarkdown(stemText)
    const newHighlights = []
    let idBase = Date.now()
    for (const snapped of snappedRanges) {
      let hlStart
      let hlEnd
      let matchedText

      if (isMd) {
        const mapped = mapFlatRangeToMarkdownRange(stemText, flat, snapped.start, snapped.end)
        if (!mapped) continue
        hlStart = mapped.start
        hlEnd = mapped.end
        matchedText = stemText.slice(hlStart, hlEnd)
      } else {
        hlStart = snapped.start
        hlEnd = snapped.end
        matchedText = stemText.slice(hlStart, hlEnd)
      }

      newHighlights.push({
        start: hlStart,
        end: hlEnd,
        text: matchedText,
        id: idBase++,
        note: '',
        color: 'yellow',
      })
    }

    if (newHighlights.length === 0) return

    const rect = range.getBoundingClientRect()

    setHighlights(prev => {
      const current = prev[currentQ.id] || []
      const merged = mergeOverlappingHighlights([...current, ...newHighlights])
      return { ...prev, [currentQ.id]: merged }
    })

    setPopoverHl({
      questionId: currentQ.id,
      highlight: newHighlights[newHighlights.length - 1],
      rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
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

      // Overlap only (not adjacent): keeps separate highlights for neighbouring table cells, etc.
      if (next.start < current.end) {
        // Merge them
        current = {
          start: current.start,
          end: Math.max(current.end, next.end),
          text: current.text, // Text will be derived from stem during render/save
          id: current.id,
          note: current.note || next.note || '',
          color: current.color || next.color || 'yellow'
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

  const removeHighlight = (currentQuestionId, highlightId) => {
    setHighlights(prev => {
      const current = prev[currentQuestionId] || []
      const filtered = current.filter(hl => hl.id !== highlightId)
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[currentQuestionId]
        return next
      }
      return { ...prev, [currentQuestionId]: filtered }
    })
    setPopoverHl(null)
  }

  const updateHighlightNote = (questionId, highlightId, note) => {
    setHighlights(prev => {
      const current = prev[questionId] || []
      return { ...prev, [questionId]: current.map(hl => hl.id === highlightId ? { ...hl, note } : hl) }
    })
    setPopoverHl(null)
  }

  const openHighlightPopover = (questionId, highlightId, e) => {
    const mark = e?.target?.closest?.('mark.hl-mark') || e?.target?.closest?.('.highlight-wrapper')
    if (!mark) return
    const rect = mark.getBoundingClientRect()
    const hl = (highlights[questionId] || []).find(h => h.id === highlightId)
    if (!hl) return
    setPopoverHl({ questionId, highlight: hl, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height } })
  }

  const clearHighlights = (currentQuestionId) => {
    setHighlights(prev => {
      const next = { ...prev }
      delete next[currentQuestionId]
      return next
    })
  }

  const hasMarkdown = (text = '') => {
    // Detect headers, lists, bold, italics, code, links, and tables (|---|)
    return /(^|\n)\s{0,3}#{1,6}\s+|(^|\n)\s*([-*+]\s+|\d+\.\s+)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\)|\|[^|]+\|/m.test(text)
  }

  const applyHighlightsToMarkdown = (text, currentQuestionId) => {
    const questionHighlights = highlights[currentQuestionId] || []
    if (questionHighlights.length === 0) return text

    // Split highlights at paragraph boundaries (\n\n) to prevent breaking markdown structure
    const expandedHighlights = []
    questionHighlights.forEach((hl) => {
      const highlightedText = text.slice(hl.start, hl.end)

      // Check if highlight contains paragraph breaks
      if (highlightedText.includes('\n\n')) {
        // Split into segments at paragraph breaks
        let currentPos = hl.start
        const parts = highlightedText.split(/(\n\n+)/)

        parts.forEach((part) => {
          if (part.match(/^\n\n+$/)) {
            // This is a paragraph break, skip it (don't highlight)
            currentPos += part.length
          } else if (part.length > 0) {
            // This is text content, create a highlight for it
            expandedHighlights.push({
              start: currentPos,
              end: currentPos + part.length,
              text: part,
              id: hl.id
            })
            currentPos += part.length
          }
        })
      } else {
        // No paragraph breaks, keep highlight as-is
        expandedHighlights.push(hl)
      }
    })

    // Sort highlights by start position (reverse to insert from end to start)
    const sorted = [...expandedHighlights].sort((a, b) => b.start - a.start)

    let result = text
    sorted.forEach((hl) => {
      const before = result.slice(0, hl.start)
      const highlighted = result.slice(hl.start, hl.end)
      const after = result.slice(hl.end)

      // Replace single newlines with <br/> within highlights (but not paragraph breaks)
      const highlightedWithBr = highlighted.replace(/\n(?!\n)/g, '<br/>')

      // Insert HTML with wrapper span that has the highlight ID
      const hlColor = hl.color || 'yellow'
      const hasNoteClass = hl.note ? ' hl-mark--has-note' : ''
      result = before +
        `<span class="highlight-wrapper" data-highlight-id="${hl.id}"><mark class="hl-mark hl-mark--${hlColor}${hasNoteClass}" data-highlight-id="${hl.id}">${highlightedWithBr}</mark></span>` +
        after
    })

    return result
  }

  const renderHighlightedText = (text, currentQuestionId) => {
    const questionHighlights = highlights[currentQuestionId] || []
    const isMarkdown = hasMarkdown(text)

    // If no highlights and no markdown, return plain text with preserved line breaks
    if (questionHighlights.length === 0 && !isMarkdown) {
      return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
    }

    // If markdown, apply highlights and render with ReactMarkdown
    if (isMarkdown) {
      const textWithHighlights = questionHighlights.length > 0
        ? applyHighlightsToMarkdown(text, currentQuestionId)
        : text

      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            // Custom renderer for span wrappers (highlights)
            span: ({ node, children, ...props }) => {
              if (props.className === 'highlight-wrapper') {
                const highlightId = props['data-highlight-id'] || node?.properties?.['data-highlight-id']
                return (
                  <span
                    className="highlight-wrapper"
                    data-highlight-id={highlightId}
                    {...props}
                    onClick={(e) => {
                      e.preventDefault()
                      const id = parseInt(highlightId)
                      if (id) openHighlightPopover(currentQuestionId, id, e)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    {children}
                  </span>
                )
              }
              return <span {...props}>{children}</span>
            },
            // Custom renderer for mark elements (within highlights) to add delete button
            mark: ({ node, children, ...props }) => {
              if (props.className?.includes('hl-mark')) {
                const highlightId = props['data-highlight-id']
                return (
                  <mark {...props}>
                    {children}
                    <button
                      className="hl-mark__delete"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const id = parseInt(highlightId)
                        if (id) removeHighlight(currentQuestionId, id)
                      }}
                    >
                      &times;
                    </button>
                  </mark>
                )
              }
              return <mark {...props}>{children}</mark>
            },
            // Style other markdown elements
            p: ({ node, ...props }) => <p style={{ marginBottom: '12px', lineHeight: '1.6' }} {...props} />,
            h1: ({ node, ...props }) => <h1 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: '12px', marginTop: '16px' }} {...props} />,
            h2: ({ node, ...props }) => <h2 style={{ fontSize: '1.3em', fontWeight: 800, marginBottom: '10px', marginTop: '14px' }} {...props} />,
            h3: ({ node, ...props }) => <h3 style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '8px', marginTop: '12px' }} {...props} />,
            ul: ({ node, ...props }) => <ul style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
            ol: ({ node, ...props }) => <ol style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
            li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
            table: ({ node, ...props }) => (
              <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', border: '1px solid #e5e7eb' }} {...props} />
              </div>
            ),
            th: ({ node, ...props }) => (
              <th style={{ border: '1px solid #e5e7eb', padding: '8px', backgroundColor: '#f8fafc', fontWeight: 700, textAlign: 'left' }} {...props} />
            ),
            td: ({ node, ...props }) => (
              <td style={{ border: '1px solid #e5e7eb', padding: '8px', textAlign: 'left' }} {...props} />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote style={{ borderLeft: '4px solid #cbd5e1', paddingLeft: '12px', margin: '12px 0', color: '#64748b' }} {...props} />
            ),
            code: ({ node, inline, ...props }) => {
              if (inline) {
                return <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }} {...props} />
              }
              return <code style={{ display: 'block', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', overflowX: 'auto', marginBottom: '12px' }} {...props} />
            },
          }}
        >
          {textWithHighlights}
        </ReactMarkdown>
      )
    }

    // Plain text with highlights (existing logic)
    if (questionHighlights.length === 0) {
      return <span>{text}</span>
    }

    // Sort highlights by start position
    const sorted = [...questionHighlights].sort((a, b) => a.start - b.start)

    const parts = []
    let lastIndex = 0

    sorted.forEach((hl, idx) => {
      // Add text before highlight
      if (hl.start > lastIndex) {
        parts.push({ text: text.slice(lastIndex, hl.start), highlighted: false, key: `text-${idx}`, highlightId: null })
      }
      
      // Robust guard: Skip if this highlight overlaps with the previous one (already rendered)
      if (hl.start < lastIndex) return

      // Add highlighted text
      parts.push({ text: text.slice(hl.start, hl.end), highlighted: true, key: `hl-${hl.id}`, highlightId: hl.id })
      lastIndex = hl.end
    })

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({ text: text.slice(lastIndex), highlighted: false, key: 'text-end', highlightId: null })
    }

    return (
      <span style={{ whiteSpace: 'pre-line' }}>
        {parts.map(part =>
          part.highlighted ? (
            (() => {
              const hl = questionHighlights.find(h => h.id === part.highlightId)
              const hlColor = hl?.color || 'yellow'
              const hasNoteClass = hl?.note ? ' hl-mark--has-note' : ''
              return (
                <span
                  key={part.key}
                  className="highlight-wrapper"
                  onClick={(e) => {
                    e.preventDefault()
                    openHighlightPopover(currentQuestionId, part.highlightId, e)
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <mark className={`hl-mark hl-mark--${hlColor}${hasNoteClass}`}>
                    {part.text}
                    <button 
                      className="hl-mark__delete"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        removeHighlight(currentQuestionId, part.highlightId)
                      }}
                      title="Delete highlight"
                    >
                      &times;
                    </button>
                  </mark>
                </span>
              )
            })()
          ) : (
            <React.Fragment key={part.key}>{part.text}</React.Fragment>
          )
        )}
      </span>
    )
  }

  // Listen for text selection
  useEffect(() => {
    document.addEventListener('mouseup', handleTextSelection)
    document.addEventListener('touchend', handleTextSelection)

    return () => {
      document.removeEventListener('mouseup', handleTextSelection)
      document.removeEventListener('touchend', handleTextSelection)
    }
  }, [handleTextSelection])

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
        studySetName,
        questions,
        userAnswers
      }
    })
  }

  const submit = async () => {
    if (!questions[currentIndex] || submitting) return

    const currentQuestion = questions[currentIndex]
    const currentQuestionId = currentQuestion.id

    // Don't submit if already submitted
    if (submittedAnswers.has(currentQuestionId)) return

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
        [currentQuestionId]: {
          selected,
          saqText,
          isCorrect,
          timeTaken,
          submitted: true
        }
      }))

      // Mark as submitted
      setSubmittedAnswers(prev => new Set([...prev, currentQuestionId]))

      // Clear strikethrough state for this question
      setStruckOut(prev => {
        const next = { ...prev }
        delete next[currentQuestionId]
        return next
      })

      // Update session stats
      const newAnswered = sessionAnswered + 1
      setSessionAnswered(newAnswered)
      setSessionCorrect(prev => prev + (isCorrect ? 1 : 0))
      setSessionTotalMs(prev => prev + timeTaken)

      // Submit to backend for tracking
      const payload = {
        question_id: currentQuestionId,
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

      console.log('Answer submitted successfully')

    } catch (error) {
      console.error('Error submitting answer:', error)
    } finally {
      setSubmitting(false)
    }
  }



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
  const currentQuestionId = currentQuestion?.id
  const userAnswer = userAnswers[currentQuestionId]
  const isSubmitted = submittedAnswers.has(currentQuestionId)

  // Get result data for explanation display (always show in review mode)
  const showExplanation = isSubmitted || isReviewMode
  const result = showExplanation ? {
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
    ? [0, 1, 2, 3, 4].map((idx) => ({
      label: String.fromCharCode(65 + idx),
      text: (pointsByOption[String(idx)]?.[0]) || null,
      isCorrect: currentQuestion?.correct_answer === idx,
    }))
      .filter((p) => p.text)
    : []

  // Calculate review stats
  const reviewStats = isReviewMode ? {
    correct: reviewModeData?.sessionStats?.correct || 0,
    totalQuestions: reviewModeData?.sessionStats?.totalQuestions || questions.length,
    skipped: reviewModeData?.sessionStats?.skipped || 0,
    accuracy: reviewModeData?.sessionStats?.totalQuestions
      ? Math.round((reviewModeData?.sessionStats?.correct / (reviewModeData?.sessionStats?.totalQuestions - reviewModeData?.sessionStats?.skipped)) * 100) || 0
      : 0
  } : null

  // Filter questions for review mode navigation
  const getFilteredQuestionIndices = () => {
    if (!isReviewMode) return questions.map((_, idx) => idx)
    return questions.map((q, idx) => {
      const answer = userAnswers[q.id]
      if (reviewFilter === 'All') return idx
      if (reviewFilter === 'Correct' && answer?.submitted && answer?.isCorrect) return idx
      if (reviewFilter === 'Incorrect' && answer?.submitted && !answer?.isCorrect) return idx
      if (reviewFilter === 'Skipped' && !answer?.submitted) return idx
      return -1
    }).filter(idx => idx !== -1)
  }

  const filteredIndices = getFilteredQuestionIndices()
  const currentFilteredPosition = filteredIndices.indexOf(currentIndex)

  return (
    <div className={`pr ${isReviewMode ? 'pr--review-mode' : ''}`}>
      <div className="pr__top">
        <div>
          <h2 style={{ margin: 0 }}>{isReviewMode ? 'Review Session' : 'Question Bank'}</h2>
          <div style={{ color: '#64748b' }}>
            Question {currentIndex + 1} of {questions.length}
            {isReviewMode && reviewFilter !== 'All' && ` (${currentFilteredPosition + 1} of ${filteredIndices.length} ${reviewFilter.toLowerCase()})`}
          </div>
        </div>
        <div className="pr__top-right">
          {!isReviewMode && timerMinutes > 0 && (
            <div className="pr__timer">
              <div className="pr__time">{display}</div>
              <button onClick={toggle} className="btn btn--ghost btn--icon">{running ? <LuPause /> : <LuPlay />}{running ? 'Pause' : 'Resume'}</button>
            </div>
          )}
          {isReviewMode ? (
            <button onClick={() => navigate('/dashboard/question-bank/results', {
              state: {
                ...reviewModeData.sessionStats,
                questions,
                userAnswers,
                weakTopics: [],
                topicPerformance: []
              }
            })} className="btn btn--ghost btn--icon" title="Back to results">
              <LuChevronLeft />Back to Results
            </button>
          ) : (
            <button onClick={navigateToResults} className="btn btn--exit btn--icon" title="Exit and view results"><LuX />Exit</button>
          )}
        </div>
      </div>

      {currentQuestion && (
        <div className="pr__grid">
          <div className="card question-card">
            <div className="card__body">
              <div className="question-content">
                <div className="question-stem-wrapper">
                  <div ref={stemRef} className="question-stem" >
                    {renderHighlightedText(currentQuestion.stem, currentQuestion.id)}
                  </div>
                </div>
                {popoverHl && (
                  <HighlightPopover
                    anchorRect={popoverHl.rect}
                    highlight={popoverHl.highlight}
                    showColors={false}
                    showNote={false}
                    onSave={({ note, color }) => {
                      setHighlights(prev => {
                        const current = prev[popoverHl.questionId] || []
                        return { ...prev, [popoverHl.questionId]: current.map(hl => hl.id === popoverHl.highlight.id ? { ...hl, note, color } : hl) }
                      })
                      setPopoverHl(null)
                    }}
                    onClose={() => setPopoverHl(null)}
                  />
                )}
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
                      // In review mode, always show correct/incorrect styling
                      const showResult = isReviewMode || result
                      const isCorrectOption = currentQuestion.correct_answer === o.id
                      const userSelected = userAnswers[currentQuestionId]?.selected === o.id
                      const isSelectedIncorrect = userSelected && !isCorrectOption
                      const isStruckOut = (struckOut[currentQuestionId] || new Set()).has(o.id)

                      let className = 'option'
                      if (userSelected) className += ' option--selected'
                      if (showResult) {
                        if (isCorrectOption) className += ' option--correct'
                        else if (isSelectedIncorrect) className += ' option--incorrect'
                      }
                      if (isStruckOut) className += ' option--struck'

                      return (
                        <div key={o.id} className="option-wrapper">
                          <label className={className}>
                            <input
                              type="radio"
                              name="opt"
                              value={o.id}
                              checked={userSelected || selected === o.id}
                              onChange={() => !isStruckOut && !isReviewMode && setSelected(o.id)}
                              disabled={isSubmitted || isStruckOut || isReviewMode}
                            />
                            <div className="option__label">{o.label}.</div>
                            <div className="option__body">{o.body}</div>
                          </label>
                          {!isSubmitted && !isReviewMode && (
                            <button
                              type="button"
                              className={`option-strike-btn ${isStruckOut ? 'is-active' : ''}`}
                              onClick={() => toggleStrikeOut(currentQuestionId, o.id)}
                              title={isStruckOut ? 'Remove elimination' : 'Eliminate option'}
                              aria-label={isStruckOut ? 'Remove elimination' : 'Eliminate option'}
                            >
                              <LuSlash size={16} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <textarea className="saq-input" placeholder="Type your answer here..." value={saqText} onChange={(e) => setSaqText(e.target.value)} disabled={isSubmitted || isReviewMode} />
                )}
              </div>
              <div className="controls">
                <div className="controls__left">
                  {!isReviewMode && (
                    <>
                      <button className={`btn btn--ghost btn--icon ${flagged.has(currentQuestionId) ? 'is-flagged' : ''}`} onClick={() => {
                        setFlagged(prev => {
                          const next = new Set(prev)
                          if (next.has(currentQuestionId)) next.delete(currentQuestionId); else next.add(currentQuestionId)
                          return next
                        })
                      }}><LuFlag />{flagged.has(currentQuestionId) ? 'Flagged' : 'Flag'}</button>
                      <ReportIssueButton questionId={currentQuestion.id} API_BASE={API_BASE} />
                      {(highlights[currentQuestion.id]?.length > 0) && (
                        <button
                          className="btn btn--ghost btn--icon"
                          onClick={() => clearHighlights(currentQuestion.id)}
                          title="Clear all highlights"
                        >
                          <LuEraser />Clear Highlights
                        </button>
                      )}
                    </>
                  )}
                  {isReviewMode && (
                    <div className="review-status-badge">
                      {userAnswers[currentQuestionId]?.submitted ? (
                        userAnswers[currentQuestionId]?.isCorrect ? (
                          <span className="review-status review-status--correct"><LuCircleCheck size={16} /> Correct</span>
                        ) : (
                          <span className="review-status review-status--incorrect"><LuCircleAlert size={16} /> Incorrect</span>
                        )
                      ) : (
                        <span className="review-status review-status--skipped">Skipped</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="controls__right">
                  {isReviewMode ? (
                    <>
                      <button
                        onClick={() => {
                          const prevIdx = filteredIndices[currentFilteredPosition - 1]
                          if (prevIdx !== undefined) {
                            setCurrentIndex(prevIdx)
                            loadCurrentQuestion(prevIdx)
                          }
                        }}
                        disabled={currentFilteredPosition <= 0}
                        className="btn btn--ghost btn--icon"
                      >
                        <LuChevronLeft />Previous
                      </button>
                      <button
                        onClick={() => {
                          const nextIdx = filteredIndices[currentFilteredPosition + 1]
                          if (nextIdx !== undefined) {
                            setCurrentIndex(nextIdx)
                            loadCurrentQuestion(nextIdx)
                          }
                        }}
                        disabled={currentFilteredPosition >= filteredIndices.length - 1}
                        className="btn btn--primary btn--icon"
                      >
                        Next <LuArrowRight />
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={goToPrevious} disabled={currentIndex <= 0} className="btn btn--ghost btn--icon"><LuChevronLeft />Previous</button>
                      {!isSubmitted ? (
                        <>
                          <button onClick={submit} disabled={submitting || (currentQuestion.options?.length > 0 ? selected === null || selected === undefined : saqText.trim() === '')} className="btn btn--primary">
                            {submitting ? 'Submitting...' : 'Submit'}
                          </button>
                          <button onClick={goToNext} disabled={submitting} className="btn btn--ghost">
                            {currentIndex === questions.length - 1 ? 'Finish' : 'Skip'}
                          </button>
                        </>
                      ) : (
                        <button onClick={goToNext} className="btn btn--primary btn--icon">
                          {currentIndex === questions.length - 1 ? 'Finish' : 'Next Question'} <LuArrowRight />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(result || isReviewMode) && (
            <div className="card explanation-card">
              <div className="card__header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className={`ex-card__status ${result.is_correct ? 'ex-card__status--correct' : 'ex-card__status--incorrect'}`}>
                  {result.is_correct ? <LuCircleCheck /> : <LuCircleAlert />}
                  {result.is_correct ? 'Correct' : 'Incorrect'}
                </div>
                <div className="tabs">
                  <div className={`tab ${tab === 'quick' ? 'tab--active' : ''}`} onClick={() => setTab('quick')}>Quick</div>
                  <div className={`tab ${tab === 'detailed' ? 'tab--active' : ''}`} onClick={() => setTab('detailed')}>Detailed</div>
                  <div className={`tab ${tab === 'eli5' ? 'tab--active' : ''}`} onClick={() => setTab('eli5')}>ELI5</div>
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
                {tab === 'quick' && (
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
                {tab === 'detailed' && (
                  <div>
                    <div className="explain__section">
                      <div className="explain__label">Detailed Explanation:</div>
                      <div>{result?.explanations?.detailed || 'No detailed explanation available'}</div>
                    </div>
                  </div>
                )}
                {tab === 'eli5' && (
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

          {isSubmitted && (
            <div className="discussion-panel-wrapper" style={{ gridColumn: '1', gridRow: result ? '3' : '2' }}>
              <DiscussionPanel questionId={currentQuestion.id} API_BASE={API_BASE} />
            </div>
          )}

          {/* Right Sidebar - Session Progress, Track Questions & Reference Ranges */}
          <div className="pr__aside">
            {/* Combined Session Progress & Track Questions */}
            <div className="card progress-tracker-card">
              <div className="card__body">
                {/* Session Progress Header */}
                <div className="progress-tracker-header">
                  {isReviewMode ? (
                    <div className="progress-stats-row review-stats-row">
                      <div className="progress-stat">
                        <div className="progress-stat__value stat--green">{reviewStats?.correct || 0}</div>
                        <div className="progress-stat__label">Correct</div>
                      </div>
                      <div className="progress-stat">
                        <div className="progress-stat__value stat--red">{(reviewStats?.totalQuestions || 0) - (reviewStats?.correct || 0) - (reviewStats?.skipped || 0)}</div>
                        <div className="progress-stat__label">Incorrect</div>
                      </div>
                      <div className="progress-stat">
                        <div className="progress-stat__value">{reviewStats?.skipped || 0}</div>
                        <div className="progress-stat__label">Skipped</div>
                      </div>
                      <div className="progress-stat">
                        <div className="progress-stat__value stat--blue">{reviewStats?.accuracy || 0}%</div>
                        <div className="progress-stat__label">Accuracy</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="progress-stats-row">
                        <div className="progress-stat">
                          <div className="progress-stat__value">{sessionAnswered}/{questions.length}</div>
                          <div className="progress-stat__label">Completed</div>
                        </div>
                        <div className="progress-stat">
                          <div className="progress-stat__value stat--green">{sessionAnswered ? Math.round((sessionCorrect / sessionAnswered) * 100) : 0}%</div>
                          <div className="progress-stat__label">Accuracy</div>
                        </div>
                        <div className="progress-stat">
                          <div className="progress-stat__value stat--blue">{sessionAnswered ? Math.round((sessionTotalMs / sessionAnswered) / 1000) : 0}s</div>
                          <div className="progress-stat__label">Avg Time</div>
                        </div>
                      </div>
                      <div className="progress__bar" style={{ marginTop: 12 }}><div className="progress__fill" style={{ width: `${Math.round((sessionAnswered / questions.length) * 100)}%` }} /></div>
                    </>
                  )}
                </div>

                {/* Track Questions Section - Paginated */}
                <div className="track-section" style={{ marginTop: 16 }}>
                  {/* Top row: Range selector + Filters */}
                  <div className="trk-top-row">
                    {/* Range dropdown */}
                    {(() => {
                      const totalRanges = Math.ceil(questions.length / QUESTIONS_PER_PAGE)
                      const ranges = Array.from({ length: totalRanges }, (_, i) => {
                        const start = i * QUESTIONS_PER_PAGE + 1
                        const end = Math.min((i + 1) * QUESTIONS_PER_PAGE, questions.length)
                        return { idx: i, label: `${start}-${end}` }
                      })
                      return (
                        <select
                          className="trk-range-select"
                          value={selectedRangeIdx}
                          onChange={(e) => setSelectedRangeIdx(parseInt(e.target.value, 10))}
                        >
                          {ranges.map((r) => (
                            <option key={r.idx} value={r.idx}>
                              Q {r.label}
                            </option>
                          ))}
                        </select>
                      )
                    })()}

                    {/* Jump input */}
                    <div className="trk-jump">
                      <input
                        type="number"
                        min="1"
                        max={questions.length}
                        placeholder="#"
                        className="trk-input"
                        value={trkJump}
                        onChange={(e) => setTrkJump(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = parseInt(trkJump || '0', 10)
                            if (val >= 1 && val <= questions.length) {
                              const idx = val - 1
                              setCurrentIndex(idx); loadCurrentQuestion(idx)
                              setSelectedRangeIdx(Math.floor(idx / QUESTIONS_PER_PAGE))
                              setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                            }
                          }
                        }}
                      />
                      <button className="btn btn--ghost btn--icon" onClick={() => {
                        const val = parseInt(trkJump || '0', 10)
                        if (val >= 1 && val <= questions.length) {
                          const idx = val - 1
                          setCurrentIndex(idx); loadCurrentQuestion(idx)
                          setSelectedRangeIdx(Math.floor(idx / QUESTIONS_PER_PAGE))
                          setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                        }
                      }}>Go</button>
                    </div>
                  </div>

                  {/* Filter chips - different for review mode */}
                  <div className="trk-filters">
                    {isReviewMode ? (
                      ['All', 'Correct', 'Incorrect', 'Skipped'].map((f) => (
                        <button
                          key={f}
                          className={`chip ${reviewFilter === f ? 'is-active' : ''}`}
                          onClick={() => {
                            setReviewFilter(f)
                            // Jump to first question matching filter
                            const firstMatch = questions.findIndex((q) => {
                              const answer = userAnswers[q.id]
                              if (f === 'All') return true
                              if (f === 'Correct') return answer?.submitted && answer?.isCorrect
                              if (f === 'Incorrect') return answer?.submitted && !answer?.isCorrect
                              if (f === 'Skipped') return !answer?.submitted
                              return true
                            })
                            if (firstMatch !== -1) {
                              setCurrentIndex(firstMatch)
                              loadCurrentQuestion(firstMatch)
                              setSelectedRangeIdx(Math.floor(firstMatch / QUESTIONS_PER_PAGE))
                            }
                          }}
                        >
                          {f}
                        </button>
                      ))
                    ) : (
                      ['All', 'Unanswered', 'Correct', 'Wrong', 'Flagged'].map((f) => (
                        <button key={f} className={`chip ${trkFilter === f ? 'is-active' : ''}`} onClick={() => setTrkFilter(f)}>{f}</button>
                      ))
                    )}
                  </div>

                  {/* Question grid for selected range */}
                  <div className="trk-grid-container">
                    {(() => {
                      const start = selectedRangeIdx * QUESTIONS_PER_PAGE
                      const end = Math.min(start + QUESTIONS_PER_PAGE, questions.length)
                      const rangeQuestions = questions.slice(start, end)

                      return (
                        <div className="trk-grid">
                          {rangeQuestions.map((q, localIdx) => {
                            const idx = start + localIdx
                            const qid = q.id
                            const ua = userAnswers[qid]
                            const isCurrent = idx === currentIndex
                            const isFlag = flagged.has(qid)
                            let status = 'Unanswered'
                            if (ua?.submitted) status = ua.isCorrect ? 'Correct' : 'Wrong'

                            // Filter logic differs for review mode
                            let matchesFilter
                            if (isReviewMode) {
                              const reviewStatus = ua?.submitted ? (ua.isCorrect ? 'Correct' : 'Incorrect') : 'Skipped'
                              matchesFilter = reviewFilter === 'All' || reviewFilter === reviewStatus
                            } else {
                              matchesFilter = trkFilter === 'All' || (trkFilter === 'Flagged' ? isFlag : trkFilter === status)
                            }

                            const classes = `seg seg--${status.toLowerCase()} ${isCurrent ? 'seg--current' : ''} ${isFlag && !isReviewMode ? 'seg--flagged' : ''} ${matchesFilter ? '' : 'seg--dim'}`
                            return (
                              <button
                                key={qid}
                                className={classes}
                                aria-label={`Go to question ${idx + 1}. Status: ${status}. ${isFlag ? 'Flagged.' : ''}`}
                                title={`Q${idx + 1} • ${status}${isFlag ? ' • flagged' : ''}`}
                                onClick={() => {
                                  setCurrentIndex(idx); loadCurrentQuestion(idx)
                                  setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                                }}
                              />
                            )
                          })}
                        </div>
                      )
                    })()}
                  </div>

                  {!isReviewMode && Array.from(flagged).length > 0 && (
                    <div className="trk-flagged-rail">
                      <div className="trk-rail__label">Flagged</div>
                      <div className="trk-rail__list">
                        {questions.map((q, idx) => flagged.has(q.id) ? (
                          <button key={q.id} className="pill" onClick={() => {
                            setCurrentIndex(idx); loadCurrentQuestion(idx)
                            setSelectedRangeIdx(Math.floor(idx / QUESTIONS_PER_PAGE))
                            setTimeout(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, 0)
                          }}>{idx + 1}</button>
                        ) : null)}
                      </div>
                    </div>
                  )}

                  <div className="trk-legend">
                    <span className="legend-item"><span className="legend-swatch swatch--correct" /> Correct</span>
                    <span className="legend-item"><span className="legend-swatch swatch--wrong" /> {isReviewMode ? 'Incorrect' : 'Wrong'}</span>
                    <span className="legend-item"><span className="legend-swatch swatch--unanswered" /> {isReviewMode ? 'Skipped' : 'Unanswered'}</span>
                    <span className="legend-item"><span className="legend-swatch swatch--current" /> Current</span>
                    {!isReviewMode && <span className="legend-item"><span className="legend-swatch swatch--flagged" /> Flagged</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Reference Ranges Card */}
            <ReferenceRangesPanel
              refRanges={refRanges}
              showRef={showRef}
              setShowRef={setShowRef}
              openGroupId={openGroupId}
              setOpenGroupId={setOpenGroupId}
            />
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
  );
}
