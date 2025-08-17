import React from 'react'
import { useOutletContext } from 'react-router-dom'
import './Dashboard.css'

export default function Dashboard() {
  const { user } = useOutletContext()
  return (
    <div style={{ padding: 24 }}>
      <h1>Dashboard</h1>
      <p>Welcome{user?.email ? `, ${user.email}` : ''}!</p>
      <div style={{ height: 1200 }} />
    </div>
  )
}


