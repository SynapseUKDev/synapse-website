import React, { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import HighlightPopover from '../../components/highlight/HighlightPopover'
import {
  getFlatTextFromStem,
  mapFlatRangeToMarkdownRange,
  reconcileSelectionRangeToFlat,
  splitFlatRangeByTableCellsAndSnap,
} from '../../utils/questionStemHighlight'

function hasMarkdown(text = '') {
  return /(^|\n)\s{0,3}#{1,6}\s+|(^|\n)\s*([-*+]\s+|\d+\.\s+)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\)|\|[^|]+\|/m.test(text)
}

function mergeOverlappingHighlights(highlights, stemText = '') {
  if (highlights.length <= 1) return highlights

  const sorted = [...highlights].sort((a, b) => a.start - b.start)
  const merged = []
  let current = sorted[0]

  const canBridge = (a, b) => {
    if (b.start <= a.end) return true
    if (!stemText || b.start > stemText.length) return false
    const between = stemText.slice(a.end, b.start)
    if (/\n\n/.test(between)) return false
    return /^\s*$/.test(between)
  }

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    if (canBridge(current, next)) {
      current = {
        start: current.start,
        end: Math.max(current.end, next.end),
        text: current.text,
        id: current.id,
        note: current.note || next.note || '',
        color: current.color || next.color || 'yellow',
      }
    } else {
      merged.push(current)
      current = next
    }
  }

  merged.push(current)
  return merged
}

const markdownComponents = (questionId, { openHighlightPopover, removeHighlight, options = {} }) => ({
  span: ({ node, children, ...props }) => {
    if (props.className === 'highlight-wrapper') {
      const highlightId =
        props.dataHighlightId ??
        props['data-highlight-id'] ??
        node?.properties?.dataHighlightId ??
        node?.properties?.['data-highlight-id']
      return (
        <span
          {...props}
          className="highlight-wrapper"
          data-highlight-id={highlightId}
          onClick={(e) => {
            e.preventDefault()
            if (options.isReviewer) {
              options.onReviewCommentClick?.(highlightId, e)
            } else {
              const id = parseInt(highlightId, 10)
              if (id) openHighlightPopover(questionId, id, e)
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {children}
        </span>
      )
    }
    return <span {...props}>{children}</span>
  },
  mark: ({ node, children, ...props }) => {
    if (props.className?.includes('hl-mark') || props.className?.includes('rv-mark')) {
      const highlightId =
        props.dataHighlightId ??
        props['data-highlight-id'] ??
        node?.properties?.dataHighlightId ??
        node?.properties?.['data-highlight-id']
      
      if (options.isReviewer) {
        return (
          <mark className="rv-mark" {...props}>
            {children}
          </mark>
        )
      }

      return (
        <mark {...props}>
          {children}
          <button
            className="hl-mark__delete"
            title="Delete highlight"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const id = parseInt(highlightId, 10)
              if (id) removeHighlight(questionId, id)
            }}
          >
            &times;
          </button>
        </mark>
      )
    }
    return <mark {...props}>{children}</mark>
  },
  p: ({ node, ...props }) => <p style={{ marginBottom: '12px', lineHeight: '1.6' }} {...props} />,
  h1: ({ node, ...props }) => (
    <h1 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: '12px', marginTop: '16px' }} {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 style={{ fontSize: '1.3em', fontWeight: 800, marginBottom: '10px', marginTop: '14px' }} {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '8px', marginTop: '12px' }} {...props} />
  ),
  ul: ({ node, ...props }) => <ul style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
  ol: ({ node, ...props }) => <ol style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
  li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
  table: ({ node, ...props }) => (
    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          border: '1px solid var(--stem-md-table-border)',
          color: 'var(--stem-md-td-fg)',
        }}
        {...props}
      />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      style={{
        border: '1px solid var(--stem-md-table-border)',
        padding: '8px',
        backgroundColor: 'var(--stem-md-th-bg)',
        color: 'var(--stem-md-th-fg)',
        fontWeight: 700,
        textAlign: 'left',
      }}
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      style={{
        border: '1px solid var(--stem-md-table-border)',
        padding: '8px',
        textAlign: 'left',
        color: 'var(--stem-md-td-fg)',
      }}
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      style={{ borderLeft: '4px solid #cbd5e1', paddingLeft: '12px', margin: '12px 0', color: '#64748b' }}
      {...props}
    />
  ),
  code: ({ node, inline, ...props }) => {
    if (inline) {
      return (
        <code
          style={{
            backgroundColor: '#f1f5f9',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.9em',
          }}
          {...props}
        />
      )
    }
    return (
      <code
        style={{
          display: 'block',
          backgroundColor: '#f1f5f9',
          padding: '12px',
          borderRadius: '8px',
          overflowX: 'auto',
          marginBottom: '12px',
        }}
        {...props}
      />
    )
  },
})

/**
 * Shared question-stem highlighting (selection → mark, popover, clear).
 * Used by mock exams; mirrors solo study-set practice behaviour.
 */
export default function useQuestionStemHighlight(options = {}) {
  const [highlights, setHighlights] = useState({})
  const [popoverHl, setPopoverHl] = useState(null)
  const stemRef = useRef(null)
  const activeQuestionRef = useRef(null)

  const getOffsetWithinStem = useCallback((targetNode, nodeOffset) => {
    if (!stemRef.current || !targetNode) return null

    const isIgnored = (n) => {
      let el = n && n.parentNode
      while (el && el.nodeType === 1) {
        if (el.classList && el.classList.contains('hl-mark__delete')) return true
        el = el.parentNode
      }
      return false
    }
    const walker = document.createTreeWalker(stemRef.current, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        return isIgnored(n) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      },
    })

    if (targetNode.nodeType === Node.TEXT_NODE) {
      let pos = 0
      let node = walker.nextNode()
      while (node) {
        if (node === targetNode) return pos + nodeOffset
        pos += node.textContent.length
        node = walker.nextNode()
      }
      return null
    }

    if (targetNode.nodeType === Node.ELEMENT_NODE) {
      const r = document.createRange()
      try {
        r.setStart(targetNode, nodeOffset)
        r.collapse(true)
      } catch {
        return null
      }
      let pos = 0
      let node = walker.nextNode()
      while (node) {
        const nodeLen = (node.textContent || '').length
        for (let i = 0; i <= nodeLen; i++) {
          try {
            if (r.comparePoint(node, i) === 0) return pos + i
          } catch {
            // not comparable
          }
        }
        pos += nodeLen
        node = walker.nextNode()
      }
      return null
    }

    return null
  }, [])

  const removeHighlight = useCallback((questionId, highlightId) => {
    setHighlights((prev) => {
      const current = prev[questionId] || []
      const filtered = current.filter((hl) => hl.id !== highlightId)
      if (filtered.length === 0) {
        const next = { ...prev }
        delete next[questionId]
        return next
      }
      return { ...prev, [questionId]: filtered }
    })
    setPopoverHl(null)
  }, [])

  const openHighlightPopover = useCallback(
    (questionId, highlightId, e) => {
      const mark = e?.target?.closest?.('mark.hl-mark') || e?.target?.closest?.('.highlight-wrapper')
      if (!mark) return
      const rect = mark.getBoundingClientRect()
      const hl = (highlights[questionId] || []).find((h) => h.id === highlightId)
      if (!hl) return
      setPopoverHl({
        questionId,
        highlight: hl,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
      })
    },
    [highlights],
  )

  const clearHighlights = useCallback((questionId) => {
    setHighlights((prev) => {
      const next = { ...prev }
      delete next[questionId]
      return next
    })
    setPopoverHl(null)
  }, [])

  const applyHighlightsToMarkdown = useCallback(
    (text, questionHighlights) => {
      if (questionHighlights.length === 0) return text

      const expandedHighlights = []
      questionHighlights.forEach((hl) => {
        const highlightedText = text.slice(hl.start, hl.end)
        if (highlightedText.includes('\n\n')) {
          let currentPos = hl.start
          const parts = highlightedText.split(/(\n\n+)/)
          parts.forEach((part) => {
            if (part.match(/^\n\n+$/)) {
              currentPos += part.length
            } else if (part.length > 0) {
              expandedHighlights.push({
                start: currentPos,
                end: currentPos + part.length,
                text: part,
                id: hl.id,
                note: hl.note,
                color: hl.color,
              })
              currentPos += part.length
            }
          })
        } else {
          expandedHighlights.push(hl)
        }
      })

      const sorted = [...expandedHighlights].sort((a, b) => b.start - a.start)
      let result = text
      sorted.forEach((hl) => {
        const before = result.slice(0, hl.start)
        const highlighted = result.slice(hl.start, hl.end)
        const after = result.slice(hl.end)
        const highlightedWithBr = highlighted.replace(/\n(?!\n)/g, '<br/>')
        if (options.isReviewer) {
          result =
            before +
            `<span class="highlight-wrapper" data-highlight-id="${hl.id}"><mark class="rv-mark" data-highlight-id="${hl.id}">${highlightedWithBr}</mark></span>` +
            after
        } else {
          const hlColor = hl.color || 'yellow'
          const hasNoteClass = hl.note ? ' hl-mark--has-note' : ''
          result =
            before +
            `<span class="highlight-wrapper" data-highlight-id="${hl.id}"><mark class="hl-mark hl-mark--${hlColor}${hasNoteClass}" data-highlight-id="${hl.id}">${highlightedWithBr}</mark></span>` +
            after
        }
      })

      return result
    },
    [options.isReviewer],
  )

  const renderHighlightedText = useCallback(
    (text, questionId) => {
      const questionHighlights = options.isReviewer
        ? (options.reviewComments || []).map(rc => ({
            start: rc.start_offset,
            end: rc.end_offset,
            text: rc.quote,
            id: rc.id,
            note: rc.comment_text,
            color: 'reviewer'
          })).concat(
            options.reviewPopover && !options.reviewPopover.comment ? [{
              start: options.reviewPopover.start_offset,
              end: options.reviewPopover.end_offset,
              text: options.reviewPopover.quote,
              id: 'pending-review',
              note: '',
              color: 'reviewer'
            }] : []
          )
        : (highlights[questionId] || [])
      const isMarkdown = hasMarkdown(text)

      if (questionHighlights.length === 0 && !isMarkdown) {
        return <span style={{ whiteSpace: 'pre-wrap' }}>{text}</span>
      }

      if (isMarkdown) {
        const textWithHighlights =
          questionHighlights.length > 0 ? applyHighlightsToMarkdown(text, questionHighlights) : text

        return (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={markdownComponents(questionId, { openHighlightPopover, removeHighlight, options })}
          >
            {textWithHighlights}
          </ReactMarkdown>
        )
      }

      if (questionHighlights.length === 0) {
        return <span>{text}</span>
      }

      const sorted = [...questionHighlights].sort((a, b) => a.start - b.start)
      const parts = []
      let lastIndex = 0

      sorted.forEach((hl, idx) => {
        if (hl.start > lastIndex) {
          parts.push({ text: text.slice(lastIndex, hl.start), highlighted: false, key: `text-${idx}`, highlightId: null })
        }
        if (hl.start < lastIndex) return
        parts.push({ text: text.slice(hl.start, hl.end), highlighted: true, key: `hl-${hl.id}`, highlightId: hl.id })
        lastIndex = hl.end
      })

      if (lastIndex < text.length) {
        parts.push({ text: text.slice(lastIndex), highlighted: false, key: 'text-end', highlightId: null })
      }

      return (
        <span style={{ whiteSpace: 'pre-line' }}>
          {parts.map((part) =>
            part.highlighted ? (
              (() => {
                const hl = questionHighlights.find((h) => h.id === part.highlightId)
                if (options.isReviewer) {
                  return (
                    <span
                      key={part.key}
                      className="highlight-wrapper"
                      onClick={(e) => {
                        e.preventDefault()
                        options.onReviewCommentClick?.(part.highlightId, e)
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <mark className="rv-mark">
                        {part.text}
                      </mark>
                    </span>
                  )
                }

                const hlColor = hl?.color || 'yellow'
                const hasNoteClass = hl?.note ? ' hl-mark--has-note' : ''
                return (
                  <span
                    key={part.key}
                    className="highlight-wrapper"
                    onClick={(e) => {
                      e.preventDefault()
                      openHighlightPopover(questionId, part.highlightId, e)
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <mark className={`hl-mark hl-mark--${hlColor}${hasNoteClass}`}>
                      {part.text}
                      <button
                        className="hl-mark__delete"
                        title="Delete highlight"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                        }}
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          removeHighlight(questionId, part.highlightId)
                        }}
                      >
                        &times;
                      </button>
                    </mark>
                  </span>
                )
              })()
            ) : (
              <React.Fragment key={part.key}>{part.text}</React.Fragment>
            ),
          )}
        </span>
      )
    },
    [highlights, applyHighlightsToMarkdown, openHighlightPopover, removeHighlight, options],
  )

  const addHighlightFromSelection = useCallback(
    (e) => {
      const selection = window.getSelection()
      const currentQ = activeQuestionRef.current
      if (!selection || selection.isCollapsed || !currentQ || !stemRef.current) return

      const selectedText = selection.toString()
      if (!selectedText || /^\s*$/.test(selectedText)) return

      const range = selection.getRangeAt(0)
      if (!stemRef.current.contains(range.commonAncestorContainer)) return

      const stemText = currentQ.stem || ''
      const flat = getFlatTextFromStem(stemRef.current)

      const startA = getOffsetWithinStem(range.startContainer, range.startOffset)
      const endA = getOffsetWithinStem(range.endContainer, range.endOffset)
      if (startA == null || endA == null) return

      let rawStart = Math.min(startA, endA)
      let rawEnd = Math.max(startA, endA)
      if (rawStart === rawEnd) return

      {
        const r = reconcileSelectionRangeToFlat(flat, rawStart, rawEnd, selectedText)
        rawStart = r.start
        rawEnd = r.end
        if (rawStart >= rawEnd) return
      }

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

      setHighlights((prev) => {
        const current = prev[currentQ.id] || []
        const merged = mergeOverlappingHighlights([...current, ...newHighlights], stemText)
        return { ...prev, [currentQ.id]: merged }
      })

      selection.removeAllRanges()
    },
    [getOffsetWithinStem],
  )

  const handleTextSelection = useCallback(
    (ev) => {
      addHighlightFromSelection(ev)
    },
    [addHighlightFromSelection],
  )

  useEffect(() => {
    if (options.isReviewer) {
      const handleReviewerSelection = (e) => {
        const selection = window.getSelection()
        const currentQ = activeQuestionRef.current
        if (!selection || selection.isCollapsed || !currentQ || !stemRef.current) return
        const selectedText = selection.toString()
        if (!selectedText || /^\s*$/.test(selectedText)) return
        const range = selection.getRangeAt(0)
        if (!stemRef.current.contains(range.commonAncestorContainer)) return

        const rect = range.getBoundingClientRect()
        options.onReviewPopoverOpen?.({
          quote: selectedText,
          anchorRect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          start_offset: range.startOffset,
          end_offset: range.endOffset,
        })
      }
      document.addEventListener('mouseup', handleReviewerSelection)
      return () => {
        document.removeEventListener('mouseup', handleReviewerSelection)
      }
    } else {
      document.addEventListener('mouseup', handleTextSelection)
      document.addEventListener('touchend', handleTextSelection)
      return () => {
        document.removeEventListener('mouseup', handleTextSelection)
        document.removeEventListener('touchend', handleTextSelection)
      }
    }
  }, [handleTextSelection, options.isReviewer, options.onReviewPopoverOpen])

  const setActiveQuestion = useCallback((question) => {
    activeQuestionRef.current = question
    setPopoverHl(null)
  }, [])

  const hasHighlights = useCallback(
    (questionId) => (highlights[questionId]?.length ?? 0) > 0,
    [highlights],
  )

  const renderPopover = () => {
    if (!popoverHl) return null
    return (
      <HighlightPopover
        anchorRect={popoverHl.rect}
        highlight={popoverHl.highlight}
        showColors={true}
        showNote={false}
        onSave={({ note, color }) => {
          setHighlights((prev) => {
            const current = prev[popoverHl.questionId] || []
            return {
              ...prev,
              [popoverHl.questionId]: current.map((hl) =>
                hl.id === popoverHl.highlight.id ? { ...hl, note, color } : hl,
              ),
            }
          })
          setPopoverHl(null)
        }}
        onClose={() => setPopoverHl(null)}
      />
    )
  }

  return {
    stemRef,
    renderHighlightedText,
    renderPopover,
    clearHighlights,
    hasHighlights,
    setActiveQuestion,
  }
}
