import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './auth-panel/AuthPanel.css'
import AuthShell from './AuthShell.jsx'

function LinkExpired() {
  const navigate = useNavigate()
  const location = useLocation()

  const params = new URLSearchParams(
    (location.hash?.startsWith('#') ? location.hash.slice(1) : '') ||
      (location.search?.startsWith('?') ? location.search.slice(1) : '')
  )
  const code = params.get('error_code') || ''
  const description = params.get('error_description') || ''

  const expired = code === 'otp_expired'
  const title = expired ? 'This link has expired' : "This link didn't work"
  const detail = expired
    ? 'Invite and password links can only be opened once, and they stop working 24 hours after they are sent.'
    : description || 'The link was either changed on its way to you, or it has already been used.'

  return (
    <AuthShell>
      <div className="auth-panel">
        <div className="auth-panel__header">
          <h2 className="auth-panel__title">{title}</h2>
          <p className="auth-panel__desc">{detail}</p>
        </div>

        <div className="auth-panel__notice">
          <div className="auth-panel__notice-header">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <h3>What to do next</h3>
          </div>
          <p>
            If your university invited you, ask them to resend your invite from their EduSynapse dashboard and use
            the new email.
          </p>
          <p style={{ marginTop: 8 }}>
            If you have already set a password, sign in as normal. Forgotten it? Use <strong>Forgot password?</strong>{' '}
            on the sign-in page.
          </p>
        </div>

        <button className="auth-panel__cta" onClick={() => navigate('/login', { replace: true })}>
          Go to Sign In
        </button>
      </div>
    </AuthShell>
  )
}

export default LinkExpired
