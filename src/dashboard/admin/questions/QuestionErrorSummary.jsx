import React from 'react'
import './AdminQuestions.css'

function focusById(id) {
  const element = document.getElementById(id)
  if (!element) return
  element.scrollIntoView?.({ block: 'center' })
  element.focus({ preventScroll: true })
}

/** Top-of-form list of blocking errors; each entry links to and focuses its field. */
export default function QuestionErrorSummary({ entries, summaryRef }) {
  if (!entries.length) return null
  return (
    <div className="admin-alert aqe-summary" role="alert" tabIndex={-1} ref={summaryRef}>
      <strong>The question was not saved. Fix {entries.length === 1 ? 'this field' : `these ${entries.length} fields`}:</strong>
      <ul>
        {entries.map((entry, idx) => (
          <li key={`${entry.id}-${idx}`}>
            {entry.id ? (
              <a
                href={`#${entry.id}`}
                onClick={(event) => {
                  event.preventDefault()
                  focusById(entry.id)
                }}
              >
                {entry.label}: {entry.message}
              </a>
            ) : (
              `${entry.label}: ${entry.message}`
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
