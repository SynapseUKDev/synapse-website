import React, { useState } from 'react'
import { LuChartLine, LuFolder, LuBookOpen, LuTimer, LuPanelLeft } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'
import './Sidebar.css'

function Sidebar({ user, onLogout }) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LuChartLine, active: true },
    { id: 'question-bank', label: 'Question Bank', icon: LuFolder, active: false },
    { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen, active: false },
    { id: 'mock-exams', label: 'Mock Exams', icon: LuTimer, active: false },
  ]

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed)
  }

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
              className={`sidebar__item ${item.active ? 'sidebar__item--active' : ''}`}
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
                {user?.username ? user.username.charAt(0).toUpperCase() : (user?.email ? user.email.charAt(0).toUpperCase() : 'U')}
              </div>
            </div>
            <div className="sidebar__user-details">
              <div className="sidebar__user-name">{user?.username || 'User'}</div>
              <div className="sidebar__user-role">{user?.email || 'No email'}</div>
            </div>
          </div>
          <div className="sidebar__user-actions">
            <button className="sidebar__settings">Settings</button>
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
