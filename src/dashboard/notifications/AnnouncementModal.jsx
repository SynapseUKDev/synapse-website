import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LuMegaphone, LuLoader } from 'react-icons/lu'
import '../../components/consent/TermsConsentModal.css'
import './AnnouncementModal.css'
import { isAllowedAnnouncementCtaUrl, normalizeAnnouncementCtaUrl } from './announcementLinks'
import AnnouncementMarkdown from './AnnouncementMarkdown'

export default function AnnouncementModal({ open, announcement, onDismiss, onCta, busy, preview = false }) {
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
  const subtitle =
    (typeof announcement?.metadata?.subtitle === 'string' && announcement.metadata.subtitle.trim()) ||
    (typeof announcement?.subtitle === 'string' && announcement.subtitle.trim()) ||
    ''
  const body = announcement?.body || ''
  const ctaUrl = isAllowedAnnouncementCtaUrl(announcement?.action_url)
    ? normalizeAnnouncementCtaUrl(announcement.action_url)
    : ''
  const ctaLabel =
    typeof announcement?.metadata?.cta_label === 'string' && announcement.metadata.cta_label.trim()
      ? announcement.metadata.cta_label.trim()
      : 'Open'
  const hasCtaLabel = typeof announcement?.metadata?.cta_label === 'string' && announcement.metadata.cta_label.trim()
  const showCta = Boolean(ctaUrl) || (preview && hasCtaLabel)
  const dismissLabel =
    typeof announcement?.metadata?.dismiss_label === 'string' && announcement.metadata.dismiss_label.trim()
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
        <div className={`consent-modal-overlay announcement-modal-overlay${preview ? ' announcement-modal-overlay--preview' : ''}`}>
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
                {preview ? <p className="announcement-modal-preview-badge">Preview</p> : null}
                <h2 id="announcement-modal-title" className="consent-modal-title">
                  {title}
                </h2>
                {subtitle ? <p className="announcement-modal-subtitle">{subtitle}</p> : null}
              </div>

              <div className="consent-modal-content">
                <div className="consent-modal-text announcement-modal-body">
                  <AnnouncementMarkdown>{body}</AnnouncementMarkdown>
                </div>
              </div>

              {error && (
                <div className="consent-modal-error-box">
                  <span>{error}</span>
                </div>
              )}

              <div className="announcement-modal-actions">
                {showCta ? (
                  <button
                    type="button"
                    className="consent-modal-btn-primary"
                    disabled={busy}
                    onClick={() => run(() => (ctaUrl ? onCta(ctaUrl) : onDismiss()))}
                  >
                    {busy ? <LuLoader className="consent-modal-spinner" size={18} /> : null}
                    {ctaLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  className={showCta ? 'announcement-modal-btn-secondary' : 'consent-modal-btn-primary'}
                  disabled={busy}
                  onClick={() => run(onDismiss)}
                >
                  {busy && !showCta ? <LuLoader className="consent-modal-spinner" size={18} /> : null}
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
