import React, { useEffect, useState } from 'react'
import './Navbar.css'
import logo from '../../assets/logo/logo.png'
import { Link, useNavigate } from 'react-router-dom'

function Navbar() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
        } else {
          setUser(null)
        }
      } catch {
        setUser(null)
      }
    })()
  }, [])

  return (
    <header className="nav">
      <div className="nav__container">
        <Link to="/" className="nav__brand">
          <img src={logo} alt="Synapse UK" className="nav__logo" />
        </Link>

        <nav className="nav__links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#about">About Us</a>
        </nav>

        {user ? (
          <button
            className="nav__user"
            onClick={() => navigate('/dashboard')}
            aria-label="Go to dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>{user.user_metadata?.username || user.email}</span>
          </button>
        ) : (
          <Link to="/login" className="nav__login">Login</Link>
        )}
      </div>
    </header>
  )
}

export default Navbar

