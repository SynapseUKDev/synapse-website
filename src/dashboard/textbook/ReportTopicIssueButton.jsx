import React, { useState, useEffect } from 'react'
import { LuMessageSquareWarning } from 'react-icons/lu'
import { authHeaders } from '../../auth/token'
import '../practice/Practice.css'

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category' },
  { value: 'typo', label: 'Typo or grammar' },
  { value: 'unclear_content', label: 'Unclear or hard to follow' },
  { value: 'factual_error', label: 'Incorrect or outdated information' },
  { value: 'broken_image_or_link', label: 'Broken image, table, or link' },
  { value: 'formatting', label: 'Layout or formatting' },
  { value: 'other', label: 'Other' },
]

export default function ReportTopicIssueButton({ topicSlug, API_BASE }) {
  const [open, setOpen] = useState(false)
  const [details, setDetails] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && open) {
        setOpen(false)
        resetForm()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const resetForm = () => {
    setDetails('')
    setCategory('')
    setErrorMessage('')
  }

  const handleCancel = () => {
    setOpen(false)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!topicSlug || !details.trim() || submitting) return

    setSubmitting(true)
    setErrorMessage('')
    try {
      const res = await fetch(`${API_BASE}/textbook/topic-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          topic_slug: topicSlug,
          details: details.trim(),
          category: category || undefined,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMessage(data.error || 'Failed to submit report')
        return
      }

      setSuccessMessage('Thanks, your report was submitted.')
      resetForm()
      setOpen(false)
      setTimeout(() => setSuccessMessage(''), 3000)
    } catch (err) {
      console.error(err)
      setErrorMessage('Failed to submit report')
    } finally {
      setSubmitting(false)
    }
  }

  if (!topicSlug) return null

  return (
    <>
      <button
        type="button"
        className={`btn btn--ghost btn--icon report-trigger-btn ${successMessage ? 'has-success' : ''}`}
        onClick={() => setOpen(true)}
        title="Report an issue with this topic"
        aria-label="Report an issue"
      >
        <LuMessageSquareWarning />
        <span className="report-trigger-text">Report</span>
      </button>

      {successMessage && (
        <div className="report-toast" role="status">
          {successMessage}
        </div>
      )}

      {open && (
        <div className="report-modal-overlay" onClick={handleCancel}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal__header">
              <h3 className="report-modal__title">Report an Issue</h3>
              <button
                type="button"
                className="report-modal__close"
                onClick={handleCancel}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit} className="report-modal__form">
              <div className="report-modal__field">
                <label htmlFor="report-topic-issue-desc" className="report-modal__label">
                  Describe the issue <span className="required">*</span>
                </label>
                <textarea
                  id="report-topic-issue-desc"
                  className="report-modal__textarea"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="What's wrong with this topic?"
                  rows={4}
                  maxLength={2000}
                  required
                  autoFocus
                />
              </div>
              <div className="report-modal__field">
                <label htmlFor="report-topic-issue-category" className="report-modal__label">
                  Category <span className="optional">(optional)</span>
                </label>
                <select
                  id="report-topic-issue-category"
                  className="report-modal__select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value || 'none'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              {errorMessage && (
                <p className="report-modal__error" role="alert">
                  {errorMessage}
                </p>
              )}
              <div className="report-modal__actions">
                <button type="button" className="report-modal__btn report-modal__btn--cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="report-modal__btn report-modal__btn--submit" disabled={submitting || !details.trim()}>
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
