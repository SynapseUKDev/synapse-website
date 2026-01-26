import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './landing/Landing.jsx'
import Auth from './auth/Auth.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
import Callback from './auth/Callback.jsx'
import Subscribe from './auth/Subscribe.jsx'
import ResetPassword from './auth/ResetPassword.jsx'
import './App.css'
import './components/loading/LoadingScreen.css'
import DashboardLayout from './dashboard/layout/DashboardLayout.jsx'
import QuestionBank from './dashboard/question-bank/QuestionBank.jsx'
import CreateStudySet from './dashboard/question-bank/CreateStudySet.jsx'
import StudySets from './dashboard/question-bank/StudySets.jsx'
import Practice from './dashboard/practice/Practice.jsx'
import PracticeSetup from './dashboard/practice/PracticeSetup.jsx'
import GroupStudySetup from './dashboard/practice/GroupStudySetup.jsx'
import GroupPractice from './dashboard/practice/GroupPractice.jsx'
import GroupLeaderboard from './dashboard/practice/GroupLeaderboard.jsx'
import PracticeResults from './dashboard/practice/PracticeResults.jsx'
import Textbook from './dashboard/textbook/Textbook.jsx'
import TextbookTopic from './dashboard/textbook/TextbookTopic.jsx'
import TextbookSearch from './dashboard/textbook/TextbookSearch.jsx'
import Settings from './dashboard/Settings.jsx'

function HashRedirector() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    if (location.hash && location.hash.includes('access_token')) {
      const hashParams = new URLSearchParams(location.hash.slice(1))
      const type = hashParams.get('type')
      
      // Handle password reset links
      if (type === 'recovery' && location.pathname !== '/auth/reset-password') {
        navigate(`/auth/reset-password${location.hash}`, { replace: true })
      }
      // Handle OAuth callbacks (but NOT recovery tokens)
      else if (type !== 'recovery' && location.pathname !== '/auth/callback') {
        navigate(`/auth/callback${location.hash}`, { replace: true })
      }
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
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="question-bank/create-set" element={<CreateStudySet />} />
          <Route path="study-sets" element={<StudySets />} />
          <Route path="question-bank/setup" element={<PracticeSetup />} />
          <Route path="question-bank/group_setup" element={<GroupStudySetup />} />
          <Route path="question-bank/practice" element={<Practice />} />
          <Route path="question-bank/group-practice" element={<GroupPractice />} />
          <Route path="question-bank/group-leaderboard" element={<GroupLeaderboard />} />
          <Route path="question-bank/results" element={<PracticeResults />} />
          <Route path="textbook" element={<Textbook />} />
          <Route path="textbook/search" element={<TextbookSearch />} />
          <Route path="textbook/specialty/:slug" element={<Textbook />} />
          <Route path="textbook/topic/:topicSlug" element={<TextbookTopic />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
