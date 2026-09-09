import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LuMegaphone, LuLoader } from 'react-icons/lu'
import '../../components/consent/TermsConsentModal.css'
import './AnnouncementModal.css'

export default function AnnouncementModal({ open, announcement, onDismiss, onCta, busy }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    setError(null)
  }, [announcement?.id])

  const title = announcement?.title || 'Announcement'
  const body = announcement?.body || ''
  const ctaUrl = typeof announcement?.action_url === 'string' && announcement.action_url.startsWith('/')
    ? announcement.action_url
    : null
  const ctaLabel = announcement?.metadata?.cta_label || 'Open'
  const dismissLabel = (typeof announcement?.metadata?.dismiss_label === 'string' && announcement.metadata.dismiss_label.trim())
    ? announcement.metadata.dismiss_label.trim()
    : 'Got it'

  const run = async (fn) => {
    if (busy) return
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.')
    }
  }

  return (
    <AnimatePresence>
      {open && announcement && (
        <div className="consent-modal-overlay announcement-modal-overlay">
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
              role="dialog"
              aria-modal="true"
              aria-labelledby="announcement-modal-title"
            >
              <div className="consent-modal-header">
                <div className="consent-modal-icon-wrapper">
                  <div className="consent-modal-icon-glow" />
                  <LuMegaphone className="consent-modal-icon" size={32} />
                </div>
                <h2 id="announcement-modal-title" className="consent-modal-title">
                  {title}
                </h2>
              </div>

              <div className="consent-modal-content">
                <p className="consent-modal-text announcement-modal-body">{body}</p>
              </div>

              {error && (
                <div className="consent-modal-error-box">
                  <span>{error}</span>
                </div>
              )}

              <div className="announcement-modal-actions">
                {ctaUrl ? (
                  <button
                    type="button"
                    className="consent-modal-btn-primary"
                    disabled={busy}
                    onClick={() => run(() => onCta(ctaUrl))}
                  >
                    {busy ? <LuLoader className="consent-modal-spinner" size={18} /> : null}
                    {ctaLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={ctaUrl ? 'announcement-modal-btn-secondary' : 'consent-modal-btn-primary'}
                  disabled={busy}
                  onClick={() => run(onDismiss)}
                >
                  {busy && !ctaUrl ? <LuLoader className="consent-modal-spinner" size={18} /> : null}
                  {dismissLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
