import React, { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function Callback() {
  const navigate = useNavigate()
  const location = useLocation()
  const [message, setMessage] = useState('Setting up your session...')

  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
    const search = location.search && location.search.startsWith('?') ? location.search.slice(1) : ''
    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    const params = new URLSearchParams(hash || search)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) {
      const searchParams = new URLSearchParams(search)
      const hashParams = new URLSearchParams(hash)
      const access = access_token || searchParams.get('access_token') || hashParams.get('access_token')
      const refresh = refresh_token || searchParams.get('refresh_token') || hashParams.get('refresh_token')
      if (!access || !refresh) {
        setMessage('Missing tokens in callback.')
        return
      }
      params.set('access_token', access)
      params.set('refresh_token', refresh)
    }
    ;(async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/set-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            access_token: params.get('access_token'),
            refresh_token: params.get('refresh_token'),
            remember: true,
          })
        })
        if (!res.ok) throw new Error('Failed to establish session')
        navigate('/dashboard')
      } catch (e) {
        setMessage('Could not complete sign-in. Please try signing in again.')
      }
    })()
  }, [location.hash, navigate])

  return (
    <div style={{ padding: '48px', maxWidth: 640, margin: '0 auto' }}>
      <h1>Email verified</h1>
      <p>{message}</p>
    </div>
  )
}

export default Callback


