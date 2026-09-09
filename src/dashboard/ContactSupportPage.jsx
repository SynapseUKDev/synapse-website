import React, { useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { LuChevronLeft, LuCheck, LuHeadset } from 'react-icons/lu'
import ContactSupportForm from './ContactSupportForm.jsx'
import './Dashboard.css'
import './question-bank/QuestionBank.css'
import './Settings.css'

export default function ContactSupportPage() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const [sent, setSent] = useState(false)

  const goBack = () => navigate('/dashboard/settings')

  return (
    <div className="qb">
      <button type="button" className="cs-page__back" onClick={goBack}>
        <LuChevronLeft size={18} aria-hidden />
        Settings
      </button>
      <div className="cs-page__head">
        <div className="qb-card__icon cs-page__icon" aria-hidden>
          <LuHeadset size={20} />
        </div>
        <div>
          <h1 className="qb__title" style={{ margin: 0 }}>Contact support</h1>
          <p className="qb__subtitle" style={{ marginTop: 6 }}>
            Tell us what is going wrong and we will get back to you by email.
          </p>
        </div>
      </div>

      <div className="qb-card cs-page__card">
        {sent ? (
          <div className="cs-page__done">
            <LuCheck size={22} aria-hidden />
            <div>
              <div className="cs-page__done-title">Message sent</div>
              <p>We will reply to {user?.email || 'your account email'}.</p>
            </div>
            <button type="button" className="qb-btn qb-btn--sm" onClick={goBack}>
              Back to settings
            </button>
          </div>
        ) : (
          <ContactSupportForm
            replyToEmail={user?.email}
            onCancel={goBack}
            onSuccess={() => setSent(true)}
            cancelLabel="Back"
          />
        )}
      </div>
    </div>
  )
}
