import { useEffect, useId, useRef } from 'react'

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Modal dialog: focus moves inside on open, Tab/Shift+Tab stay inside, Escape closes, and focus
 * returns to whatever had it before (normally the button that opened it).
 */
export default function Dialog({ title, onClose, children }) {
  const ref = useRef(null)
  const titleId = useId()

  useEffect(() => {
    const previous = document.activeElement
    const node = ref.current
    const first = node?.querySelector(FOCUSABLE)
    ;(first ?? node)?.focus()
    return () => {
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) previous.focus()
    }
  }, [])

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose?.()
      return
    }
    if (event.key !== 'Tab') return
    const items = [...(ref.current?.querySelectorAll(FOCUSABLE) ?? [])]
    if (items.length === 0) {
      event.preventDefault()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="fcv2a-backdrop">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} className="fcv2a-dialog" onKeyDown={onKeyDown}>
        <h3 id={titleId} className="fcv2a-dialog__title">
          {title}
        </h3>
        {children}
      </div>
    </div>
  )
}
