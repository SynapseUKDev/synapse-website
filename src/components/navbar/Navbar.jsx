import React, { useCallback, useEffect, useState } from 'react'
import './Navbar.css'
import logo from '../../assets/logo/logo.png'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { LuArrowRight, LuMenu, LuX } from 'react-icons/lu'

const LINKS = [
  { href: '#top', label: 'Home' },
  { href: '#about', label: 'About' },
  { href: '#pricing', label: 'Pricing' },
]

function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [user, setUser] = useState(null)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  const checkAuth = useCallback(async () => {
    if (window.__isResettingPassword) return
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: 'include', cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        setUser(data.user)
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  useEffect(() => {
    checkAuth()
  }, [checkAuth, location.pathname])

  useEffect(() => {
    const handler = () => checkAuth()
    window.addEventListener('auth:changed', handler)
    window.addEventListener('focus', handler)
    document.addEventListener('visibilitychange', handler)
    return () => {
      window.removeEventListener('auth:changed', handler)
      window.removeEventListener('focus', handler)
      document.removeEventListener('visibilitychange', handler)
    }
  }, [checkAuth])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 18)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 960) setOpen(false)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const closeMenu = () => setOpen(false)

  const displayName = user?.username || user?.email?.split('@')[0] || 'Dashboard'
  const initial = displayName.slice(0, 1).toUpperCase()

  return (
    <header className={`nav ${scrolled ? 'nav--scrolled' : ''} ${open ? 'nav--open' : ''}`}>
      <div className="nav__container">
        <Link to="/" className="nav__brand" onClick={closeMenu}>
          <img src={logo} alt="" className="nav__logo" />
          <span className="nav__wordmark">EduSynapse</span>
        </Link>

        <nav className="nav__links" aria-label="Primary">
          {LINKS.map((link) => (
            <a key={link.href} href={link.href}>{link.label}</a>
          ))}
        </nav>

        <div className="nav__actions">
          {user ? (
            <button
              className="nav__user"
              onClick={() => { closeMenu(); navigate('/dashboard') }}
              aria-label={`Go to dashboard as ${displayName}`}
            >
              <span className="nav__avatar" aria-hidden>{initial}</span>
              <span className="nav__username">{displayName}</span>
              <LuArrowRight />
            </button>
          ) : (
            <Link to="/login" className="lp-btn lp-btn--primary nav__cta">
              <span>Log in</span>
              <LuArrowRight />
            </Link>
          )}
          <button
            className="nav__menu-btn"
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <LuX /> : <LuMenu />}
          </button>
        </div>
      </div>

      {open && (
        <div className="nav__sheet">
          <button className="nav__backdrop" type="button" aria-label="Close menu" onClick={closeMenu} />
          <div className="nav__drawer">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={closeMenu}>{link.label}</a>
            ))}
            <div className="nav__drawer-actions">
              {user ? (
                <button className="nav__user nav__user--drawer" onClick={() => { closeMenu(); navigate('/dashboard') }}>
                  <span className="nav__avatar" aria-hidden>{initial}</span>
                  Continue as {displayName}
                  <LuArrowRight />
                </button>
              ) : (
                <Link to="/login" className="lp-btn lp-btn--primary" onClick={closeMenu}>
                  <span>Log in</span> <LuArrowRight />
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

export default Navbar
