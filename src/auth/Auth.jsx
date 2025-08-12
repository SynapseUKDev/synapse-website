import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Auth.css'
import authImg2 from '../assets/auth/auth-img2.svg'
import logo from '../assets/logo/logo.png'
import AuthPanel from './auth-panel/AuthPanel.jsx'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'

function Auth() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' })
        if (res.ok) {
          navigate('/dashboard', { replace: true })
        }
      } catch {
        // ignore
      } finally {
        setChecking(false)
      }
    })()
  }, [navigate])

  if (checking) {
    return <LoadingScreen message="Checking your session..." />
  }

  return (
    <section className="auth">
      <div className="auth__split auth__split--left">
        <div style={{ width: '100%', display: 'grid', placeItems: 'center' }}>
          <AuthPanel />
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
              Advanced practice questions, real-time analytics, and expert guidance.
            </p>
          </div>

          <div className="auth__stats">
            <div className="auth__stat">
              <div className="auth__stat-icon auth__stat-icon--green">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                </svg>
              </div>
              <div className="auth__stat-content">
                <div className="auth__stat-number">5,000+</div>
                <div className="auth__stat-label">Practice Questions</div>
              </div>
            </div>

            <div className="auth__stat">
              <div className="auth__stat-icon auth__stat-icon--purple">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <div className="auth__stat-content">
                <div className="auth__stat-number">1,000+</div>
                <div className="auth__stat-label">Active Students</div>
              </div>
            </div>

            <div className="auth__stat">
              <div className="auth__stat-icon auth__stat-icon--orange">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </div>
              <div className="auth__stat-content">
                <div className="auth__stat-number">96%</div>
                <div className="auth__stat-label">Pass Rate</div>
              </div>
            </div>
          </div>

          <div className="auth__features">
            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M12 1v6m0 6v6m11-7h-6m-6 0H1"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">UKMLA-Focused</div>
                <div className="auth__feature-desc">Questions crafted by UK medical professionals</div>
              </div>
            </div>

            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">Real-Time Analytics</div>
                <div className="auth__feature-desc">Track your progress with advanced insights</div>
              </div>
            </div>

            <div className="auth__feature">
              <div className="auth__feature-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3l8-8"/>
                  <path d="M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9s4.03-9 9-9c1.51 0 2.93.37 4.18 1.02"/>
                </svg>
              </div>
              <div className="auth__feature-text">
                <div className="auth__feature-title">Instant Feedback</div>
                <div className="auth__feature-desc">Comprehensive explanations with visual aids</div>
              </div>
            </div>
          </div>

          {/* <img src={authImg2} className="auth__art" alt="Medical student learning" /> */}
        </div>
      </div>

      
    </section>
  )
}

export default Auth


