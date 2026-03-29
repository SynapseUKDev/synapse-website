import React, { useEffect, useRef, useState } from 'react'
import './HighlightPopover.css'

const COLORS = ['yellow', 'green', 'pink', 'blue']

/**
 * Shared highlight popover for both textbook and qbank.
 *
 * Props:
 *  - anchorRect: { top, left, width, height } from getBoundingClientRect()
 *  - highlight: { id, note?, color?, text/quote? }
 *  - showColors: boolean (true for textbook, false for qbank)
 *  - onSave: ({ note, color }) => void
 *  - onDelete: () => void
 *  - onClose: () => void
 */
export default function HighlightPopover({
  anchorRect,
  highlight,
  showColors = false,
  onSave,
  onDelete,
  onClose,
}) {
  const [note, setNote] = useState(highlight?.note || '')
  const [color, setColor] = useState(highlight?.color || 'yellow')
  const popRef = useRef(null)
  const noteRef = useRef(null)

  // Position the popover below the highlight
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!anchorRect) return
    const popW = 300
    const pad = 12
    let left = anchorRect.left + anchorRect.width / 2 - popW / 2
    let top = anchorRect.top + anchorRect.height + 10

    // Keep within viewport
    if (left < pad) left = pad
    if (left + popW > window.innerWidth - pad) left = window.innerWidth - pad - popW
    if (top + 200 > window.innerHeight) {
      top = anchorRect.top - 200 - 10
    }
    setPos({ top, left })
  }, [anchorRect])

  // Focus note textarea on open
  useEffect(() => {
    setTimeout(() => noteRef.current?.focus(), 50)
  }, [])

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

  const quotePreview = highlight?.quote || highlight?.text || ''

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
                aria-label={`${c} highlight`}
              />
            ))}
          </div>
        )}

        <textarea
          ref={noteRef}
          className="hl-popover__note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a note… (Cmd+Enter to save)"
        />

        <div className="hl-popover__actions">
          <button type="button" className="hl-popover__btn hl-popover__btn--delete" onClick={onDelete}>
            Delete
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" className="hl-popover__btn hl-popover__btn--close" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="hl-popover__btn hl-popover__btn--save" onClick={() => handleSave()}>
            Save
          </button>
        </div>
      </div>
    </>
  )
}
