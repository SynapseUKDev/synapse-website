import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

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
          navigate('/login')
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

  return (
    <div style={{ padding: '48px', maxWidth: 960, margin: '0 auto' }}>
      <h1>Dashboard</h1>
      <p>Welcome{user?.email ? `, ${user.email}` : ''}!</p>
      <div style={{ marginTop: 16 }}>
        <button
          onClick={async () => {
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
            await fetch(`${API_BASE}/auth/signout`, { method: 'POST', credentials: 'include' })
            navigate('/')
          }}
          style={{
            height: 44,
            padding: '0 16px',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
            background: '#fff',
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    </div>
  )
}

export default Dashboard


