import React from 'react'
import './LoadingScreen.css'
import logo from '../../assets/logo/logo.png'

function LoadingScreen({ message, inline = false }) {
  const containerClass = inline ? 'loading loading--inline' : 'loading'
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


