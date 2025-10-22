import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from '../sidebar/Sidebar'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import '../Dashboard.css'
import { authHeaders, clearTokens } from '../../auth/token'
import { LuMenu } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'

function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchUser = useCallback(async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try {
      console.log('Fetching user from:', `${API_BASE}/me`)
      const res = await fetch(`${API_BASE}/me`, { 
        credentials: 'include', 
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        }
      })
      console.log('User fetch response status:', res.status)
      
      if (res.status === 401) {
        console.log('User not authenticated, redirecting to login')
        navigate('/')
        return
      }
      
      if (!res.ok) {
        console.error('Failed to fetch user:', res.status, res.statusText)
        const errorText = await res.text()
        console.error('Error response:', errorText)
        navigate('/')
        return
      }
      
      const data = await res.json()
      console.log('User data received:', data.user?.id)
      const hasAccess = !!data?.access?.has_active_access
      if (!hasAccess) {
        console.log('Access inactive, redirecting to subscribe')
        navigate('/subscribe')
        return
      }
      setUser(data.user)
    } catch (error) {
      console.error('Error fetching user:', error)
      navigate('/')
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
    await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include', headers: authHeaders() })
    clearTokens()
    window.dispatchEvent(new Event('auth:changed'))
    navigate('/')
  }

  if (loading) return <LoadingScreen message="Loading your dashboard..." />

  return (
    <div className="dash">
      {/* Mobile Header */}
      <div className="dash__mobile-header">
        <div className="dash__mobile-header-content">
          <img src={logoImg} alt="Synapse UK" className="dash__mobile-logo" />
          <button 
            className="dash__mobile-burger" 
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <LuMenu size={24} />
          </button>
        </div>
      </div>

      {/* Overlay for mobile menu */}
      {mobileMenuOpen && (
        <div 
          className="dash__overlay" 
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar 
        user={user} 
        onLogout={handleLogout} 
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />
      <main className="dash__content">
        <Outlet context={{ user, location }} />
      </main>
    </div>
  )
}

export default DashboardLayout


