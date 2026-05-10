import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LuChartLine, LuCircleHelp, LuBookOpen, LuTimer, LuMenu, LuSettings, LuX, LuLogOut, LuShield, LuStethoscope, LuTrendingUp } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'
import './Sidebar.css'

function Sidebar({ user, onLogout, mobileMenuOpen, onCloseMobileMenu }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Auto-collapse sidebar when entering practice pages
  useEffect(() => {
    const isPracticePage = location.pathname.includes('/practice') ||
      location.pathname.includes('/group-practice')
    if (isPracticePage) {
      setIsCollapsed(true)
    }
  }, [location.pathname])

  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LuChartLine, to: '/dashboard' },
    { id: 'analytics', label: 'Analytics', icon: LuTrendingUp, to: '/dashboard/analytics' },
    { id: 'question-bank', label: 'Question Bank', icon: LuCircleHelp, to: '/dashboard/question-bank' },
    { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen, to: '/dashboard/textbook' },
    { id: 'osce', label: 'OSCE Stations', icon: LuStethoscope, to: '/dashboard/osce' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: LuShield, to: '/dashboard/admin' }] : []),
    // { id: 'mock-exams', label: 'Mock Exams', icon: LuTimer, to: '/dashboard/mock-exams' },
  ]

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const displayUsername = user?.username || user?.user_metadata?.username || null
  const initial = (displayUsername || user?.email || 'U').charAt(0).toUpperCase()

  const handleNavigate = (to) => {
    navigate(to)
    // Close mobile menu after navigation
    if (onCloseMobileMenu) {
      onCloseMobileMenu()
    }
  }

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''} ${mobileMenuOpen ? 'sidebar--mobile-open' : ''}`}>
      <div className="sidebar__brand">
        <img src={logoImg} alt="Synapse UK" className="sidebar__logo" />

        {/* Burger menu button for desktop */}
        <button
          className="sidebar__burger"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <LuMenu size={24} />
        </button>

        {/* Mobile close button */}
        <button
          className="sidebar__mobile-close"
          onClick={onCloseMobileMenu}
          aria-label="Close menu"
        >
          <LuX size={24} />
        </button>
      </div>

      <nav className="sidebar__menu">
        {menuItems.map((item) => {
          const IconComponent = item.icon
          const isDashboard = item.to === '/dashboard'
          const isActive = isDashboard
            ? location.pathname === '/dashboard' || location.pathname === '/dashboard/'
            : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)
          return (
            <button
              key={item.id}
              type="button"
              className={`sidebar__item ${isActive ? 'sidebar__item--active' : ''}`}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => handleNavigate(item.to)}
            >
              <IconComponent className="sidebar__icon" aria-hidden />
              <span className="sidebar__text">{item.label}</span>
            </button>
          )
        })}
      </nav>

      <div className={`sidebar__user ${isCollapsed ? 'sidebar__user--collapsed' : ''}`}>
        {/* Compact view for collapsed sidebar on desktop */}
        <div className="sidebar__user-compact">
          <div className="sidebar__avatar sidebar__avatar--compact">
            <div className="sidebar__avatar-placeholder">
              {initial}
            </div>
          </div>
          <div className="sidebar__user-actions-compact">
            <button
              className="sidebar__action-btn"
              onClick={() => handleNavigate('/dashboard/settings')}
              title="Settings"
            >
              <LuSettings size={18} />
            </button>
            <button
              className="sidebar__action-btn sidebar__action-btn--logout"
              onClick={() => {
                onLogout()
                if (onCloseMobileMenu) onCloseMobileMenu()
              }}
              title="Logout"
            >
              <LuLogOut size={18} />
            </button>
          </div>
        </div>

        {/* Expanded view for expanded sidebar on desktop & always on mobile */}
        <div className="sidebar__user-expanded">
          <div className="sidebar__user-info">
            <div className="sidebar__avatar">
              <div className="sidebar__avatar-placeholder">
                {initial}
              </div>
            </div>
            <div className="sidebar__user-details">
              <div className="sidebar__user-name">{displayUsername || user?.email || 'User'}</div>
              <div className="sidebar__user-role">{user?.email || 'No email'}</div>
            </div>
          </div>
          <div className="sidebar__user-actions">
            <button className="sidebar__settings" onClick={() => handleNavigate('/dashboard/settings')}>Settings</button>
            <button className="sidebar__logout" onClick={() => {
              onLogout()
              if (onCloseMobileMenu) onCloseMobileMenu()
            }}>Logout</button>
          </div>
        </div>
      </div>

    </aside>
  )
}

export default Sidebar
