import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './Auth.css'
import './auth-panel/AuthPanel.css'
import logo from '../assets/logo/logo.png'

/**
 * Where a dead email link lands.
 *
 * Supabase sends the browser to the site with the failure in the URL hash and
 * nothing else, so without this the student is dropped on the home page with
 * no idea why. Invite and reset links are single use and last 24 hours, and
 * both of those are easy to trip over, so the page says what to do next
 * rather than only what went wrong.
 */
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
    <section className="auth">
      <div className="auth__split auth__split--left">
        <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
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
        </div>
      </div>

      <div className="auth__split auth__split--right">
        <div className="auth__leftContent">
          <div className="auth__brand">
            <img src={logo} alt="Synapse UK" className="auth__logo" />
          </div>
          <div className="auth__hero">
            <h1 className="auth__headline">
              Master <span className="auth__gradient-text">Medical Excellence</span> with Confidence
            </h1>
            <p className="auth__subtitle">
              Join thousands of medical students who trust Synapse UK for their learning journey.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

export default LinkExpired
