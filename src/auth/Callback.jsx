import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import LoadingScreen from '../components/loading/LoadingScreen.jsx'
import { setTokens } from './token'
import { verifyEmailLink } from './verifyEmailLink'

function Callback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [message, setMessage] = useState('Setting up your session...')

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const search = location.search && location.search.startsWith('?') ? location.search.slice(1) : ''
    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    const params = new URLSearchParams(hash || search)
    const searchParams = new URLSearchParams(search)
    const hashParams = new URLSearchParams(hash)

    const type = params.get('type') || searchParams.get('type') || hashParams.get('type')
    if (type === 'recovery') {
      setMessage('Invalid callback type. Please use the password reset link.')
      return
    }

    const tokenHash = params.get('token_hash') || searchParams.get('token_hash') || hashParams.get('token_hash')

    ;(async () => {
      try {
        let access = params.get('access_token') || searchParams.get('access_token') || hashParams.get('access_token')
        let refresh = params.get('refresh_token') || searchParams.get('refresh_token') || hashParams.get('refresh_token')

        if (tokenHash) {
          const session = await verifyEmailLink({ tokenHash, type: type || 'magiclink' })
          access = session.access_token
          refresh = session.refresh_token
          window.history.replaceState({}, '', window.location.origin + window.location.pathname)
        }

        if (!access || !refresh) {
          setMessage('Missing tokens in callback.')
          return
        }

        const res = await fetch(`${API_BASE}/auth/set-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: access,
            refresh_token: refresh,
            remember: true,
          })
        })
        if (!res.ok) throw new Error('Failed to establish session')
        setTokens({
          accessToken: access,
          refreshToken: refresh,
        })
        try {
          const me = await fetch(`${API_BASE}/me`, {
            credentials: 'include',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }
          })
          if (me.ok) {
            const data = await me.json()
            if (data?.user?.needs_password_change) {
              navigate('/auth/change-password')
              return
            }
            const hasAccess = !!data?.access?.has_active_access
            navigate(hasAccess ? '/dashboard' : '/subscribe')
          } else {
            navigate('/')
          }
        } catch {
          navigate('/')
        }
      } catch {
        setMessage('Could not complete sign-in. Please try signing in again.')
      }
    })()
  }, [location.hash, location.search, navigate])

  return <LoadingScreen message={message} />
}

export default Callback


