import React, { useEffect, useState, useCallback } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import Sidebar from '../sidebar/Sidebar'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import MobileNavModal from './MobileNavModal'
import '../Dashboard.css'
import { authHeaders, clearTokens, authenticatedFetch } from '../../auth/token'
import { LuMenu } from 'react-icons/lu'
import logoImg from '../../assets/logo/logo.png'
import TermsConsentModal from '../../components/consent/TermsConsentModal'

function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [access, setAccess] = useState(null)
  const [institution, setInstitution] = useState(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const fetchUser = useCallback(async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    try {
      console.log('Fetching user from:', `${API_BASE}/me`)
      const res = await authenticatedFetch(`${API_BASE}/me`, {
        cache: 'no-store',
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
      if (data?.user?.needs_password_change) {
        console.log('User needs password change, redirecting to change password page')
        navigate('/auth/change-password')
        return
      }
      // Set state before any redirect below: /dashboard/institution renders
      // inside this layout, so bailing out early would leave it without a user.
      setUser(data.user)
      setAccess(data.access || null)
      setInstitution(data.institution || null)

      const hasAccess = !!data?.access?.has_active_access
      if (!hasAccess) {
        // /subscribe only sells personal plans, so an institution admin whose
        // billing lapsed would be stranded there with no way to fix it.
        if (data?.capabilities?.is_institution_admin) {
          console.log('Institution billing inactive, redirecting to institution billing')
          navigate('/dashboard/institution?billing=required', { replace: true })
          return
        }
        console.log('Access inactive, redirecting to subscribe')
        navigate('/subscribe')
        return
      }
    } catch (error) {
      console.error('Error fetching user:', error)
      navigate('/')
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])
  useEffect(() => {
    const handler = () => fetchUser()
    window.addEventListener('auth:changed', handler)
    return () => window.removeEventListener('auth:changed', handler)
  }, [fetchUser])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  // Route guard: Redirect reviewers away from admin routes
  useEffect(() => {
    if (user?.capabilities?.can_review && location.pathname.includes('/admin')) {
      navigate('/dashboard', { replace: true })
    }
  }, [user, location.pathname, navigate])

  // Institution admins manage students rather than study, so the student
  // dashboard is not their landing page.
  useEffect(() => {
    if (user?.capabilities?.is_institution_admin && location.pathname.replace(/\/$/, '') === '/dashboard') {
      navigate('/dashboard/institution', { replace: true })
    }
  }, [user, location.pathname, navigate])

  const handleAcceptTerms = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const res = await authenticatedFetch(`${API_BASE}/me/accept-terms`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}))
      throw new Error(errData.error || 'Failed to update consent timestamp')
    }
    const data = await res.json()
    setUser((prev) => ({
      ...prev,
      terms_accepted_at: data.terms_accepted_at,
    }))
  }

  const handleLogout = async () => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include', headers: authHeaders() })
    clearTokens()
    window.dispatchEvent(new Event('auth:changed'))
    navigate('/')
  }

  if (loading) return <LoadingScreen message="Loading your dashboard..." />

  const showConsentModal = user && !user.terms_accepted_at

  return (
    <div className="dash">
      <TermsConsentModal
        open={!!showConsentModal}
        onAccept={handleAcceptTerms}
        onLogout={handleLogout}
      />
      <div className="dash__mobile-header">
        <div className="dash__mobile-header-content">
          <img src={logoImg} alt="Synapse UK" className="dash__mobile-logo" />
          <button
            type="button"
            className="dash__mobile-burger"
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileMenuOpen}
          >
            <LuMenu size={24} />
          </button>
        </div>
      </div>

      <MobileNavModal
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <Sidebar user={user} onLogout={handleLogout} />
      <main className="dash__content">
        <Outlet context={{ user, access, institution, location }} />
      </main>
    </div>
  )
}

export default DashboardLayout
