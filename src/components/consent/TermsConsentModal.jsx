import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LuFileText, LuLogOut, LuLoader } from 'react-icons/lu'
import './TermsConsentModal.css'

export default function TermsConsentModal({ open, onAccept, onLogout }) {
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  React.useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!agreed || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      await onAccept()
    } catch (err) {
      console.error(err)
      setError(err.message || 'An error occurred while saving your consent. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="consent-modal-overlay">
          <motion.div
            className="consent-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
          <div className="consent-modal-container">
            <motion.div
              className="consent-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            >
              <div className="consent-modal-header">
                <div className="consent-modal-icon-wrapper">
                  <div className="consent-modal-icon-glow" />
                  <LuFileText className="consent-modal-icon" size={32} />
                </div>
                <h2 className="consent-modal-title">Terms & Conditions Update</h2>
                <p className="consent-modal-subtitle">
                  We've updated our terms to improve your experience and ensure compliance under UK GDPR.
                </p>
              </div>

              <div className="consent-modal-content">
                <p className="consent-modal-text">
                  To continue using <strong>EduSynapse</strong>, please review and accept our updated 
                  policies. These updates cover platform-specific data practices (such as study progress tracking 
                  and question bank analytics), billing integration, and data retention schedules.
                </p>

                <div className="consent-modal-links-grid">
                  <a
                    href="https://www.synapseuk.org/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="consent-modal-link-card"
                  >
                    <span className="consent-modal-link-title">Terms & Conditions</span>
                    <span className="consent-modal-link-url">synapseuk.org/terms-and-conditions</span>
                  </a>
                  <a
                    href="https://www.synapseuk.org/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="consent-modal-link-card"
                  >
                    <span className="consent-modal-link-title">Privacy Policy</span>
                    <span className="consent-modal-link-url">synapseuk.org/privacy-policy</span>
                  </a>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="consent-modal-form">
                {error && (
                  <div className="consent-modal-error-box">
                    <span>{error}</span>
                  </div>
                )}

                <label className={`consent-modal-checkbox-label ${agreed ? 'is-checked' : ''}`}>
                  <div className="consent-modal-checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      disabled={submitting}
                      className="consent-modal-hidden-checkbox"
                    />
                    <div className="consent-modal-custom-checkbox">
                      {agreed && (
                        <svg className="consent-modal-check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span className="consent-modal-checkbox-text">
                    I agree to the Terms & Conditions and have read the Privacy Policy.
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={!agreed || submitting}
                  className="consent-modal-btn-primary"
                >
                  {submitting ? (
                    <>
                      <LuLoader className="consent-modal-spinner" size={18} />
                      Saving consent...
                    </>
                  ) : (
                    'Accept & Continue'
                  )}
                </button>
              </form>

              <div className="consent-modal-footer">
                <button
                  type="button"
                  onClick={onLogout}
                  disabled={submitting}
                  className="consent-modal-btn-logout"
                >
                  <LuLogOut size={16} />
                  <span>Sign out of your account</span>
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
