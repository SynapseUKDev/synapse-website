import React, { useEffect } from 'react'
import { LuHeadset } from 'react-icons/lu'
import ContactSupportForm from './ContactSupportForm.jsx'
import './Settings.css'
import './question-bank/QuestionBank.css'

export default function ContactSupportModal({ replyToEmail, onClose, onSent }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div className="delete-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="cs-modal-title">
      <div className="delete-confirm-backdrop" onClick={onClose} />
      <div className="delete-confirm-container cs-modal">
        <div className="delete-confirm-card cs-modal__card">
          <div className="cs-modal__icon" aria-hidden>
            <LuHeadset size={26} />
          </div>
          <h2 id="cs-modal-title" className="delete-confirm-title">
            Contact support
          </h2>
          <p className="cs-modal__lead">
            Tell us what is going wrong and we will get back to you by email.
            {replyToEmail && (
              <>
                {' '}
                We will reply to <strong>{replyToEmail}</strong>.
              </>
            )}
          </p>
          <ContactSupportForm
            onCancel={onClose}
            onSuccess={onSent}
          />
        </div>
      </div>
    </div>
  )
}
