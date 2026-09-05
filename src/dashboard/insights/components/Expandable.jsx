import { useState } from 'react'

/**
 * Renders children(open) and a centred toggle button.
 * The child decides what to hide; this only owns the open state and the button.
 */
export default function Expandable({ collapsedLabel, openLabel, initiallyOpen = false, children }) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <>
      {children(open)}
      <div className="an-more">
        <button type="button" className="an-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          {open ? openLabel : collapsedLabel}
          <span aria-hidden="true" className={`an-more__chev ${open ? 'is-open' : ''}`}>⌄</span>
        </button>
      </div>
    </>
  )
}
