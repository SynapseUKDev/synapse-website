import React, { useState } from 'react'
import { authHeaders } from '../../auth/token'
import './Practice.css'

const CATEGORY_OPTIONS = [
  { value: '', label: 'Select category' },
  { value: 'typo', label: 'Typo' },
  { value: 'wrong_answer', label: 'Wrong answer' },
  { value: 'unclear', label: 'Unclear' },
  { value: 'other', label: 'Other' },
]

export default function ReportIssueButton({ questionId, API_BASE }) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const resetForm = () => {
    setDescription('')
    setCategory('')
    setErrorMessage('')
  }

  const handleCancel = () => {
    setOpen(false)
    resetForm()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!questionId || !description.trim() || submitting) return

    setSubmitting(true)
    setErrorMessage('')
    try {
      const res = await fetch(`${API_BASE}/qbank/questions/${questionId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          description: description.trim(),
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

  if (!questionId) return null

  return (
    <div className="report-issue-wrap">
      <button
        type="button"
        className="report-issue-btn"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Report an issue with this question"
      >
        Report issue
      </button>
      {successMessage && (
        <p className="report-issue-success" role="status">
          {successMessage}
        </p>
      )}
      {open && (
        <div className="report-issue-card card">
          <div className="card__body">
            <form onSubmit={handleSubmit} className="report-issue-form">
              <label htmlFor="report-issue-desc" className="report-issue-label">
                Describe the issue (required)
              </label>
              <textarea
                id="report-issue-desc"
                className="report-issue-textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the issue…"
                rows={4}
                maxLength={2000}
                required
              />
              <label htmlFor="report-issue-category" className="report-issue-label">
                Category (optional)
              </label>
              <select
                id="report-issue-category"
                className="report-issue-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value || 'none'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {errorMessage && (
                <p className="report-issue-error" role="alert">
                  {errorMessage}
                </p>
              )}
              <div className="report-issue-actions">
                <button type="button" className="report-issue-cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="report-issue-submit" disabled={submitting || !description.trim()}>
                  {submitting ? 'Submitting…' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
