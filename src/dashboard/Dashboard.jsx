import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Sidebar from './sidebar/Sidebar'
import './Dashboard.css'

function Dashboard() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/me`, { credentials: 'include' })
        if (res.status === 401) {
          navigate('/')
          return
        }
        const data = await res.json()
        setUser(data.user)
      } finally {
        setLoading(false)
      }
    })()
  }, [navigate])

  if (loading) {
    return (
      <div style={{ padding: '48px', maxWidth: 960, margin: '0 auto' }}>
        <p>Loading...</p>
      </div>
    )
  }

  const handleLogout = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include' })
    navigate('/')
    window.dispatchEvent(new Event('auth:changed'))
  }

  return (
    <div className="dash">
      <Sidebar user={user} onLogout={handleLogout} />

      <main className="dash__content">
        <div style={{ padding: 24 }}>
          <h1>Dashboard</h1>
          <p>Welcome{user?.email ? `, ${user.email}` : ''}!</p>
          <div style={{ height: 1200 }} />
        </div>
      </main>
    </div>
  )
}

export default Dashboard


