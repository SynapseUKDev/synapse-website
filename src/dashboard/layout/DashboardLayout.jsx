import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from '../sidebar/Sidebar'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import '../Dashboard.css'

function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)

  const fetchUser = useCallback(async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try {
      const res = await fetch(`${API_BASE}/me`, { credentials: 'include', cache: 'no-store' })
      if (res.status === 401) {
        navigate('/')
        return
      }
      const data = await res.json()
      setUser(data.user)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => { fetchUser() }, [fetchUser])
  useEffect(() => {
    const handler = () => fetchUser()
    window.addEventListener('auth:changed', handler)
    return () => window.removeEventListener('auth:changed', handler)
  }, [fetchUser])

  const handleLogout = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include' })
    window.dispatchEvent(new Event('auth:changed'))
    navigate('/')
  }

  if (loading) return <LoadingScreen message="Loading your dashboard..." />

  return (
    <div className="dash">
      <Sidebar user={user} onLogout={handleLogout} />
      <main className="dash__content">
        <Outlet context={{ user, location }} />
      </main>
    </div>
  )
}

export default DashboardLayout


