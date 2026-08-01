import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Landing from './landing/Landing.jsx'
import Auth from './auth/Auth.jsx'
import Dashboard from './dashboard/Dashboard.jsx'
import Analytics from './dashboard/insights/Insights.jsx'
import Callback from './auth/Callback.jsx'
import Subscribe from './auth/Subscribe.jsx'
import ResetPassword from './auth/ResetPassword.jsx'
import SetupAccount from './auth/SetupAccount.jsx'
import LinkExpired from './auth/LinkExpired.jsx'
import ChangePassword from './auth/ChangePassword.jsx'
import { getResolvedTheme, applyTheme } from './theme'
import './App.css'
import './components/loading/LoadingScreen.css'
import DashboardLayout from './dashboard/layout/DashboardLayout.jsx'
import QuestionBank from './dashboard/question-bank/QuestionBank.jsx'
import CreateStudySet from './dashboard/question-bank/CreateStudySet.jsx'
import StudySets, { GroupStudySets } from './dashboard/question-bank/StudySets.jsx'
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
import Admin from './dashboard/admin/Admin.jsx'
import InstitutionDashboard from './dashboard/institution/InstitutionDashboard.jsx'
import OsceStations from './dashboard/osce/OsceStations.jsx'
import OsceStationLanding from './dashboard/osce/OsceStationLanding.jsx'
import OsceStationActive from './dashboard/osce/OsceStationActive.jsx'
import OsceGroupSetup from './dashboard/osce/OsceGroupSetup.jsx'
import OsceGroupResults from './dashboard/osce/OsceGroupResults.jsx'
import OsceAdminPanel from './dashboard/osce/OsceAdminPanel.jsx'
import OsceAdminStationEditor from './dashboard/osce/OsceAdminStationEditor.jsx'
import Flashcards from './dashboard/osce/Flashcards.jsx'
import MockExams from './dashboard/mock-exams/MockExams.jsx'
import MockExamBegin from './dashboard/mock-exams/MockExamBegin.jsx'
import MockExamPractice from './dashboard/mock-exams/MockExamPractice.jsx'
import MockExamResults from './dashboard/mock-exams/MockExamResults.jsx'
import MockExamReview from './dashboard/mock-exams/MockExamReview.jsx'

// Pages that already know how to read an auth link out of the URL themselves.
const AUTH_LANDING_PAGES = ['/auth/callback', '/auth/reset-password', '/auth/setup-account']

function HashRedirector() {
  const location = useLocation()
  const navigate = useNavigate()
  useEffect(() => {
    const hash = location.hash?.startsWith('#') ? location.hash.slice(1) : ''
    if (!hash) return
    const hashParams = new URLSearchParams(hash)

    // A dead link comes back as an error on whatever page Supabase lands on,
    // which is the home page. Send it somewhere that explains itself.
    if (hashParams.get('error') || hashParams.get('error_code')) {
      if (location.pathname !== '/auth/link-expired') {
        navigate(`/auth/link-expired${location.hash}`, { replace: true })
      }
      return
    }

    if (!hashParams.get('access_token')) return
    const type = hashParams.get('type')

    // Handle password reset links
    if (type === 'recovery' && location.pathname !== '/auth/reset-password') {
      navigate(`/auth/reset-password${location.hash}`, { replace: true })
    }
    // Handle invite links - redirect to setup account page
    else if (type === 'invite' && location.pathname !== '/auth/setup-account') {
      navigate(`/auth/setup-account${location.hash}`, { replace: true })
    }
    // Anything else signs in as usual, unless it landed on a page that was
    // asked for by name: a resent invite arrives as a magic link pointed at
    // the setup page, and must not be bounced away from it.
    else if (type !== 'recovery' && type !== 'invite' && !AUTH_LANDING_PAGES.includes(location.pathname)) {
      navigate(`/auth/callback${location.hash}`, { replace: true })
    }
  }, [location, navigate])
  return null
}

function ThemeWatcher() {
  const location = useLocation()
  useEffect(() => {
    applyTheme(getResolvedTheme())
  }, [location])
  return null
}

function App() {
  return (
    <BrowserRouter>
      <HashRedirector />
      <ThemeWatcher />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Auth />} />
        <Route path="/auth/callback" element={<Callback />} />
        <Route path="/auth/reset-password" element={<ResetPassword />} />
        <Route path="/auth/setup-account" element={<SetupAccount />} />
        <Route path="/auth/link-expired" element={<LinkExpired />} />
        <Route path="/auth/change-password" element={<ChangePassword />} />
        <Route path="/subscribe" element={<Subscribe />} />
        <Route path="/dashboard" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="question-bank" element={<QuestionBank />} />
          <Route path="question-bank/create-set" element={<CreateStudySet />} />
          <Route path="study-sets" element={<StudySets />} />
          <Route path="group-study" element={<GroupStudySets />} />
          <Route path="question-bank/setup" element={<PracticeSetup />} />
          <Route path="question-bank/group_setup" element={<GroupStudySetup />} />
          <Route path="question-bank/practice" element={<Practice />} />
          <Route path="question-bank/group-practice" element={<GroupPractice />} />
          <Route path="question-bank/group-leaderboard" element={<GroupLeaderboard />} />
          <Route path="question-bank/results" element={<PracticeResults />} />
          <Route path="mock-exams" element={<MockExams />} />
          <Route path="mock-exams/practice" element={<MockExamPractice />} />
          <Route path="mock-exams/results" element={<MockExamResults />} />
          <Route path="mock-exams/review" element={<MockExamReview />} />
          <Route path="mock-exams/:examId" element={<MockExamBegin />} />
          <Route path="textbook" element={<Textbook />} />
          <Route path="textbook/search" element={<TextbookSearch />} />
          <Route path="textbook/specialty/:slug" element={<Textbook />} />
          <Route path="textbook/topic/:topicSlug" element={<TextbookTopic />} />
          <Route path="admin" element={<Admin />} />
          <Route path="institution" element={<InstitutionDashboard />} />
          <Route path="osce" element={<OsceStations />} />
          <Route path="question-bank/flashcards" element={<Flashcards />} />
          <Route path="osce/flashcards" element={<Navigate to="/dashboard/question-bank/flashcards" replace />} />
          <Route path="osce/station/:slug" element={<OsceStationLanding />} />
          <Route path="osce/station/:slug/practice" element={<OsceStationActive />} />
          <Route path="osce/group" element={<OsceGroupSetup />} />
          <Route path="osce/group/:roomCode" element={<OsceGroupSetup />} />
          <Route path="osce/group/:roomCode/results" element={<OsceGroupResults />} />
          <Route path="admin/osce" element={<OsceAdminPanel />} />
          <Route path="admin/osce/station/:id" element={<OsceAdminStationEditor />} />
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
