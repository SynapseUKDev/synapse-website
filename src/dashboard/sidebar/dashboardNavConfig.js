import {
  LuChartLine,
  LuCircleHelp,
  LuBookOpen,
  LuTimer,
  LuShield,
  LuStethoscope,
  LuTrendingUp,
  LuBuilding2,
} from 'react-icons/lu'

/**
 * Single source of truth for dashboard primary nav (desktop sidebar + mobile menu).
 */
export function getDashboardNavItems(user) {
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin || !!user?.capabilities?.can_access_admin
  const isReviewer = !!user?.capabilities?.can_review

  // Institution admins manage their students but can also use the platform
  // themselves, so their Institution page sits in front of the usual nav.
  const isInstitutionAdmin = !!user?.capabilities?.is_institution_admin

  return [
    ...(isInstitutionAdmin
      ? [{ id: 'institution', label: 'Institution', icon: LuBuilding2, to: '/dashboard/institution' }]
      : []),
    { id: 'dashboard', label: 'Dashboard', icon: LuChartLine, to: '/dashboard' },
    { id: 'question-bank', label: 'Question Bank', icon: LuCircleHelp, to: '/dashboard/question-bank' },
    { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen, to: '/dashboard/textbook' },
    { id: 'osce', label: 'OSCEs', icon: LuStethoscope, to: '/dashboard/osce' },
    { id: 'mock-exams', label: 'Mock Exams', icon: LuTimer, to: '/dashboard/mock-exams' },
    { id: 'analytics', label: 'Analytics', icon: LuTrendingUp, to: '/dashboard/analytics' },
    ...(isAdmin && !isReviewer ? [{ id: 'admin', label: 'Admin', icon: LuShield, to: '/dashboard/admin' }] : []),
  ]
}
