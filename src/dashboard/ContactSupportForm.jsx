import React, { useState } from 'react'
import { LuLoader } from 'react-icons/lu'
import { authHeaders } from '../auth/token'

const SUBJECT_MAX = 120
const MESSAGE_MIN = 10
const MESSAGE_MAX = 4000

export default function ContactSupportForm({ replyToEmail, onCancel, onSuccess, cancelLabel = 'Cancel' }) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const canSend =
    subject.trim().length > 0 &&
    subject.trim().length <= SUBJECT_MAX &&
    message.trim().length >= MESSAGE_MIN &&
    message.trim().length <= MESSAGE_MAX &&
    !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSend) return
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/me/support`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json?.error || 'Could not send your message. Please try again.')
        return
      }
      onSuccess?.()
    } catch {
      setError('A connection error occurred. Please check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="csf">
      {replyToEmail && (
        <p className="csf__hint">
          We will reply to <strong>{replyToEmail}</strong>
        </p>
      )}
      <label className="csf__label" htmlFor="csf-subject">
        Subject
      </label>
      <input
        id="csf-subject"
        type="text"
        className="db-input csf__input"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={SUBJECT_MAX}
        placeholder="What do you need help with?"
        disabled={submitting}
        autoFocus
        required
      />
      <label className="csf__label" htmlFor="csf-message">
        Message
      </label>
      <textarea
        id="csf-message"
        className="db-input csf__textarea"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={MESSAGE_MAX}
        minLength={MESSAGE_MIN}
        rows={7}
        placeholder="Give us as much detail as you can."
        disabled={submitting}
        required
      />
      <div className="csf__count">
        {message.trim().length}/{MESSAGE_MAX}
      </div>
      {error && (
        <p className="csf__error" role="alert">
          {error}
        </p>
      )}
      <div className="csf__actions">
        {onCancel && (
          <button type="button" className="qb-btn qb-btn--sm csf__cancel" onClick={onCancel} disabled={submitting}>
            {cancelLabel}
          </button>
        )}
        <button type="submit" className="qb-btn qb-btn--sm csf__submit" disabled={!canSend}>
          {submitting ? (
            <>
              <LuLoader className="consent-modal-spinner" size={16} />
              Sending…
            </>
          ) : (
            'Send message'
          )}
        </button>
      </div>
    </form>
  )
}
