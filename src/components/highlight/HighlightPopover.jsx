import React, { useEffect, useRef, useState } from 'react'
import './HighlightPopover.css'

const COLORS = ['yellow', 'green', 'pink', 'blue', 'red', 'orange', 'purple', 'teal']

/**
 * Shared highlight popover for both textbook and qbank.
 *
 * Props:
 *  - anchorRect: { top, left, width, height } from getBoundingClientRect()
 *  - highlight: { id, note?, color?, text/quote? }
 *  - showColors: boolean (true for textbook, false for qbank)
 *  - onSave: ({ note, color }) => void
 *  - onClose: () => void
 */
export default function HighlightPopover({
  anchorRect,
  highlight,
  showColors = false,
  showNote = true,
  onSave,
  onClose,
}) {
  const [note, setNote] = useState(highlight?.note || '')
  const [color, setColor] = useState(highlight?.color || 'yellow')
  const [copyLabel, setCopyLabel] = useState('Copy')
  const popRef = useRef(null)
  const noteRef = useRef(null)

  const highlightText = (highlight && (highlight.quote || highlight.text)) || ''

  // Position the popover relative to the viewport, but adjusted for scroll
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const [scrollInit, setScrollInit] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!anchorRect) return
    setScrollInit({ x: window.scrollX, y: window.scrollY })

    const popW = 300
    const pad = 12
    let left = anchorRect.left + anchorRect.width / 2 - popW / 2
    let top = anchorRect.top + anchorRect.height + 10

    // Keep within viewport
    if (left < pad) left = pad
    if (left + popW > window.innerWidth - pad) left = window.innerWidth - pad - popW

    setPos({ top, left })
  }, [anchorRect])

  // Update position on scroll to stay with the text
  useEffect(() => {
    if (!anchorRect) return

    const handleScroll = () => {
      const dx = window.scrollX - scrollInit.x
      const dy = window.scrollY - scrollInit.y

      const popW = 300
      const pad = 12
      let left = (anchorRect.left - dx) + anchorRect.width / 2 - popW / 2
      let top = (anchorRect.top - dy) + anchorRect.height + 10

      // Keep within viewport horizontally
      if (left < pad) left = pad
      if (left + popW > window.innerWidth - pad) left = window.innerWidth - pad - popW

      setPos({ top, left })
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [anchorRect, scrollInit])

  // Focus note textarea on open
  useEffect(() => {
    if (showNote) {
      setTimeout(() => noteRef.current?.focus(), 50)
    }
  }, [showNote])

  useEffect(() => {
    setCopyLabel('Copy')
  }, [highlight?.id])

  // Escape to close
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSave = (c = color, n = note) => {
    onSave({ note: n.trim(), color: c })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleCopy = async () => {
    const t = highlightText.trim()
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
    } catch {
      try {
        const el = document.createElement('textarea')
        el.value = t
        el.setAttribute('readonly', '')
        el.style.position = 'fixed'
        el.style.left = '-9999px'
        document.body.appendChild(el)
        el.select()
        document.execCommand('copy')
        document.body.removeChild(el)
      } catch {
        return
      }
    }
    setCopyLabel('Copied!')
    setTimeout(() => setCopyLabel('Copy'), 2000)
  }

  return (
    <>
      <div className="hl-popover-backdrop" onClick={onClose} />
      <div
        ref={popRef}
        className="hl-popover"
        style={{ top: pos.top, left: pos.left }}
        onClick={(e) => e.stopPropagation()}
      >
        {showColors && (
          <div className="hl-popover__colors">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`hl-popover__color hl-popover__color--${c} ${color === c ? 'is-active' : ''}`}
                onClick={() => {
                  setColor(c)
                  handleSave(c, note)
                }}
                aria-label={`${c.charAt(0).toUpperCase() + c.slice(1)} highlight`}
              />
            ))}
          </div>
        )}

        {showNote && (
          <textarea
            ref={noteRef}
            className="hl-popover__note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note…"
          />
        )}

        <div className="hl-popover__actions">
          <button
            type="button"
            className="hl-popover__btn hl-popover__btn--copy"
            onClick={handleCopy}
            disabled={!highlightText.trim()}
            aria-label="Copy highlighted text"
          >
            {copyLabel}
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="hl-popover__btn hl-popover__btn--close" onClick={onClose}>
            {showNote ? 'Cancel' : 'Close'}
          </button>
          {showNote && (
            <button type="button" className="hl-popover__btn hl-popover__btn--save" onClick={() => handleSave()}>
              Save
            </button>
          )}
        </div>
      </div>
    </>
  )
}
