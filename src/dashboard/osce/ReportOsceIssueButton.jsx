import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { LuMessageSquareWarning } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import '../practice/Practice.css'
import { OSCE_ISSUE_CATEGORY_OPTIONS } from './osceIssueOptions.js'


/**
 * Report button + modal for an OSCE station.
 * sectionOptions: [{ value, label }] — value is 'section:<id>' or a fixed key
 * (general | viva_questions | mark_scheme | auto_fail_criteria | final_diagnosis).
 */
export default function ReportOsceIssueButton({ stationId, sectionOptions = [], API_BASE }) {
  const [open, setOpen] = useState(false)
  const [sectionKey, setSectionKey] = useState('')
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const resetForm = () => {
    setSectionKey('')
    setCategory('')
    setDetails('')
    setErrorMessage('')
  }

  const handleCancel = () => {
    setOpen(false)
    resetForm()
  }

  useEffect(() => {
    if (!open) return
    const handleEscape = (e) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      setSectionKey('')
      setCategory('')
      setDetails('')
      setErrorMessage('')
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open])

  const canSubmit = !!sectionKey && !!category && !!details.trim() && !submitting

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!stationId || !canSubmit) return

    setSubmitting(true)
    setErrorMessage('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/stations/${stationId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_key: sectionKey, category, details: details.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErrorMessage(typeof data.error === 'string' ? data.error : 'Failed to submit report')
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

  if (!stationId) return null

  return (
    <>
      <button
        type="button"
        className={`btn btn--ghost btn--icon report-trigger-btn ${successMessage ? 'has-success' : ''}`}
        onClick={() => setOpen(true)}
        title="Report an issue with this station"
        aria-label="Report an issue"
      >
        <LuMessageSquareWarning />
        <span className="report-trigger-text">Report</span>
      </button>

      {successMessage && createPortal(
        <div className="report-toast" role="status">{successMessage}</div>,
        document.body
      )}

      {open && createPortal(
        <div className="report-modal-overlay" onClick={handleCancel}>
          <div className="report-modal ph-no-capture" role="dialog" aria-modal="true" aria-labelledby="report-osce-title" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal__header">
              <h3 id="report-osce-title" className="report-modal__title">Report an Issue</h3>
              <button type="button" className="report-modal__close" onClick={handleCancel} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit} className="report-modal__form">
              <div className="report-modal__field">
                <label htmlFor="report-osce-section" className="report-modal__label">
                  Which section? <span className="required">*</span>
                </label>
                <select
                  id="report-osce-section"
                  className="report-modal__select"
                  value={sectionKey}
                  onChange={(e) => setSectionKey(e.target.value)}
                  required
                  autoFocus
                >
                  <option value="">Select section</option>
                  {sectionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="report-modal__field">
                <label htmlFor="report-osce-category" className="report-modal__label">
                  Type of issue <span className="required">*</span>
                </label>
                <select
                  id="report-osce-category"
                  className="report-modal__select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                >
                  <option value="">Select type</option>
                  {OSCE_ISSUE_CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div className="report-modal__field">
                <label htmlFor="report-osce-details" className="report-modal__label">
                  Describe the issue <span className="required">*</span>
                </label>
                <textarea
                  id="report-osce-details"
                  className="report-modal__textarea"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="What's wrong with this section?"
                  rows={4}
                  maxLength={2000}
                  required
                />
              </div>
              {errorMessage && <p className="report-modal__error" role="alert">{errorMessage}</p>}
              <div className="report-modal__actions">
                <button type="button" className="report-modal__btn report-modal__btn--cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="submit" className="report-modal__btn report-modal__btn--submit" disabled={!canSubmit}>
                  {submitting ? 'Submitting…' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
