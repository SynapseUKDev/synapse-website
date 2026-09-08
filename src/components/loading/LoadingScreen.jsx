import React from 'react'
import './LoadingScreen.css'
import logo from '../../assets/logo/logo.png'

// inline  — fills the dashboard content column, so the loader centres against
//           the page while the sidebar stays visible.
// compact — for a loader that replaces one panel rather than the whole page.
function LoadingScreen({ message, inline = false, compact = false }) {
  const containerClass = [
    'loading',
    inline || compact ? 'loading--inline' : '',
    compact ? 'loading--compact' : '',
  ].filter(Boolean).join(' ')
  return (
    <div className={containerClass}>
      <div className="loading__content" role="status" aria-live="polite" aria-busy="true">
        <div className="loading__logo-wrap">
          <img src={logo} alt="Synapse UK" className="loading__logo" />
        </div>
        <div className="loading__spinner" />
        {message ? <p className="loading__message">{message}</p> : null}
      </div>
    </div>
  )
}

export default LoadingScreen


