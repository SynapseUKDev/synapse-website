import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './landing/Landing.jsx'
import Auth from './auth/Auth.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
import Callback from './auth/Callback.jsx'
import './App.css'

function HashRedirector() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.hash && location.hash.includes('access_token') && location.pathname !== '/auth/callback') {
      navigate(`/auth/callback${location.hash}`, { replace: true })
    }
  }, [location, navigate])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <HashRedirector />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
