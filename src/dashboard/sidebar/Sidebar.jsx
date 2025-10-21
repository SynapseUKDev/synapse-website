import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { LuChartLine, LuFolder, LuBookOpen, LuTimer, LuPanelLeft, LuSettings } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'
import './Sidebar.css'

function Sidebar({ user, onLogout }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LuChartLine, to: '/dashboard' },
    { id: 'question-bank', label: 'Question Bank', icon: LuFolder, to: '/dashboard/question-bank' },
    { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen, to: '/dashboard/textbook' },
    // { id: 'mock-exams', label: 'Mock Exams', icon: LuTimer, to: '/dashboard/mock-exams' },
  ]

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

  const displayUsername = user?.username || user?.user_metadata?.username || null
  const initial = (displayUsername || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <aside className={`sidebar ${isCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <img src={logoImg} alt="Synapse UK" className="sidebar__logo" />
        {/* {!isCollapsed && <span className="sidebar__brand-text">SYNAPSE UK</span>} */}
      </div>
      
      <nav className="sidebar__menu">
        {menuItems.map((item) => {
          const IconComponent = item.icon
          return (
            <button
              key={item.id}
              className={`sidebar__item ${location.pathname === item.to ? 'sidebar__item--active' : ''}`}
              onClick={() => navigate(item.to)}
            >
              <IconComponent className="sidebar__icon" />
              {!isCollapsed && <span className="sidebar__text">{item.label}</span>}
            </button>
          )
        })}
      </nav>

      {!isCollapsed && (
        <div className="sidebar__user">
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
            <button className="sidebar__settings" onClick={() => navigate('/dashboard/settings')}>Settings</button>
            <button className="sidebar__logout" onClick={onLogout}>Logout</button>
          </div>
        </div>
      )}

      <div className="sidebar__footer">
        <button
          className="sidebar__collapse"
          onClick={toggleSidebar}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <LuPanelLeft className="sidebar__collapse-icon" />
        </button>
      </div>
    </aside>
  )
}

export default Sidebar
