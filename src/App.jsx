import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './landing/Landing.jsx'
import Auth from './auth/Auth.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
import Callback from './auth/Callback.jsx'
import './App.css'
import './components/loading/LoadingScreen.css'
import DashboardLayout from './dashboard/layout/DashboardLayout.jsx'
import QuestionBank from './dashboard/question-bank/QuestionBank.jsx'
import Practice from './dashboard/practice/Practice.jsx'
import PracticeSetup from './dashboard/practice/PracticeSetup.jsx'

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
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="question-bank/setup" element={<PracticeSetup />} />
          <Route path="question-bank/practice" element={<Practice />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
