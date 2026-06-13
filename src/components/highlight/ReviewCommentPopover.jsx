import React, { useEffect, useRef, useState, useCallback } from 'react'
import './ReviewCommentPopover.css'

/**
 * ReviewCommentPopover
 * Appears after a reviewer selects text anywhere in content areas.
 * Distinct from HighlightPopover — amber accent, no colour picker, review-only.
 *
 * Props:
 *   anchorRect   { top, left, width, height } — selection bounding rect
 *   quote        string — the selected text
 *   onSubmit     ({ comment_text }) => void
 *   onClose      () => void
 *   submitting   boolean
 */
export default function ReviewCommentPopover({
  anchorRect,
  quote,
  onSubmit,
  onClose,
  submitting = false,
  comment = null,
  onDelete = null
}) {
  const [commentText, setCommentText] = useState('')
  const textareaRef = useRef(null)
  const popoverRef = useRef(null)

  // Auto-focus textarea on mount
  useEffect(() => {
    if (!comment) {
      const t = setTimeout(() => {
        textareaRef.current?.focus()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [comment])

  // Cmd/Ctrl + Enter to submit
  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      if (commentText.trim() && !submitting) {
        onSubmit({ comment_text: commentText.trim() })
      }
    }
    if (e.key === 'Escape') {
      onClose()
    }
  }, [commentText, submitting, onSubmit, onClose])

  // Close on backdrop click
  const handleBackdropClick = useCallback((e) => {
    if (popoverRef.current && !popoverRef.current.contains(e.target)) {
      onClose()
    }
  }, [onClose])

  // Position the popover relative to the viewport, but adjusted for scroll
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [scrollInit, setScrollInit] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!anchorRect) return
    setScrollInit({ x: window.scrollX, y: window.scrollY })

    const popW = 320
    const popH = comment ? 200 : 260
    const pad = 12
    let left = anchorRect.left + anchorRect.width / 2 - popW / 2
    let top = anchorRect.top - popH - 8

    // Keep within viewport
    if (left < pad) left = pad
    if (left + popW > window.innerWidth - pad) left = window.innerWidth - pad - popW

    // If above is off-screen, show below
    if (anchorRect.top - popH - 8 < 0) {
      top = anchorRect.bottom + 8
    }

    setPos({ top, left })
  }, [anchorRect, comment])

  // Update position on scroll to stay with the text
  useEffect(() => {
    if (!anchorRect) return

    const handleScroll = () => {
      const dx = window.scrollX - scrollInit.x
      const dy = window.scrollY - scrollInit.y

      const popW = 320
      const popH = comment ? 200 : 260
      const pad = 12
      let left = (anchorRect.left - dx) + anchorRect.width / 2 - popW / 2
      let top = (anchorRect.top - dy) - popH - 8

      // Keep within viewport horizontally
      if (left < pad) left = pad
      if (left + popW > window.innerWidth - pad) left = window.innerWidth - pad - popW

      // If above is off-screen, show below
      if ((anchorRect.top - dy) - popH - 8 < 0) {
        top = (anchorRect.bottom - dy) + 8
      }

      setPos({ top, left })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [anchorRect, scrollInit, comment])

  const getStyle = () => {
    return { position: 'fixed', top: pos.top, left: pos.left, width: 320 }
  }

  return (
    <>
      <div
        className="rv-popover-backdrop"
        onClick={handleBackdropClick}
      />
      <div
        ref={popoverRef}
        className="rv-popover"
        style={getStyle()}
        role="dialog"
        aria-modal="true"
        aria-label="Review comment"
      >
        <div className="rv-popover__header">
          <span className="rv-popover__title">
            {comment ? 'Review Comment Details' : 'Review Comment'}
          </span>
          <button
            type="button"
            className="rv-popover__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {quote && (
          <blockquote className="rv-popover__quote">
            "{quote.length > 140 ? quote.slice(0, 140) + '…' : quote}"
          </blockquote>
        )}

        {comment ? (
          <div className="rv-popover__comment-text">
            {comment.comment_text}
          </div>
        ) : (
          <textarea
            ref={textareaRef}
            className="rv-popover__textarea"
            placeholder="Write your review comment… (Ctrl+Enter to submit)"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            disabled={submitting}
          />
        )}

        <div className="rv-popover__actions">
          {comment ? (
            <>
              {onDelete && (
                <button
                  type="button"
                  className="rv-popover__btn rv-popover__btn--danger"
                  onClick={onDelete}
                  disabled={submitting}
                >
                  {submitting ? 'Deleting…' : 'Delete'}
                </button>
              )}
              <button
                type="button"
                className="rv-popover__btn rv-popover__btn--close"
                onClick={onClose}
                disabled={submitting}
              >
                Close
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="rv-popover__btn rv-popover__btn--cancel"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rv-popover__btn rv-popover__btn--submit"
                onClick={() => onSubmit({ comment_text: commentText.trim() })}
                disabled={!commentText.trim() || submitting}
              >
                {submitting ? 'Saving…' : 'Submit'}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  )
}
