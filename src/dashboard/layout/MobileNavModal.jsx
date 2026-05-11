import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LuLogOut, LuX, LuSettings } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'
import { getDashboardNavItems } from '../sidebar/dashboardNavConfig'
import './MobileNavModal.css'

const list = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.065,
      delayChildren: 0.08,
    },
  },
}

const row = {
  hidden: { opacity: 0, y: -22 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 420, damping: 28 },
  },
}

const sheetEnter = {
  hidden: { opacity: 0, y: -14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 380, damping: 32 },
  },
}

export default function MobileNavModal({ open, onClose, user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const menuItems = getDashboardNavItems(user)

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const go = (to) => {
    navigate(to)
    onClose()
  }

  const handleLogout = () => {
    onLogout()
    onClose()
  }

  const isActive = (item) => {
    if (item.to === '/dashboard') {
      return location.pathname === '/dashboard' || location.pathname === '/dashboard/'
    }
    return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
  }

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          key="mobile-nav-sheet"
          className="mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Main menu"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
        >
          <div className="mobile-nav__surface">
            <motion.div
              className="mobile-nav__sheet"
              variants={sheetEnter}
              initial="hidden"
              animate="show"
              exit="hidden"
            >
              <div className="mobile-nav__topbar">
                <img src={logoImg} alt="" className="mobile-nav__logo" width={44} height={44} />
                <span className="mobile-nav__brand-text">Synapse</span>
                <button type="button" className="mobile-nav__close" onClick={onClose} aria-label="Close menu">
                  <LuX size={22} strokeWidth={2.2} />
                </button>
              </div>

              <motion.ul className="mobile-nav__list" variants={list} initial="hidden" animate="show">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  const active = isActive(item)
                  return (
                    <motion.li key={item.id} variants={row} style={{ listStyle: 'none' }}>
                      <button
                        type="button"
                        className={`mobile-nav__item${active ? ' is-active' : ''}`}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => go(item.to)}
                      >
                        <Icon className="mobile-nav__item-icon" aria-hidden />
                        {item.label}
                      </button>
                    </motion.li>
                  )
                })}
              </motion.ul>

              <motion.div
                className="mobile-nav__footer"
                variants={list}
                initial="hidden"
                animate="show"
              >
                <motion.button
                  type="button"
                  variants={row}
                  className="mobile-nav__footer-btn"
                  onClick={() => go('/dashboard/settings')}
                >
                  <LuSettings size={18} aria-hidden />
                  Settings
                </motion.button>
                <motion.button
                  type="button"
                  variants={row}
                  className="mobile-nav__footer-btn mobile-nav__footer-btn--danger"
                  onClick={handleLogout}
                >
                  <LuLogOut size={18} aria-hidden />
                  Log out
                </motion.button>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  )
}
