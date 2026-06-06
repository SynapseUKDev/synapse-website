import {
  LuChartLine,
  LuCircleHelp,
  LuBookOpen,
  LuTimer,
  LuShield,
  LuStethoscope,
  LuTrendingUp,
} from 'react-icons/lu'

/**
 * Single source of truth for dashboard primary nav (desktop sidebar + mobile menu).
 */
export function getDashboardNavItems(user) {
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin
  return [
    { id: 'dashboard', label: 'Dashboard', icon: LuChartLine, to: '/dashboard' },
    { id: 'question-bank', label: 'Question Bank', icon: LuCircleHelp, to: '/dashboard/question-bank' },
    { id: 'textbook', label: 'UKMLA Textbook', icon: LuBookOpen, to: '/dashboard/textbook' },
    { id: 'osce', label: 'OSCEs', icon: LuStethoscope, to: '/dashboard/osce' },
    { id: 'mock-exams', label: 'Mock exams', icon: LuTimer, to: '/dashboard/mock-exams' },
    { id: 'analytics', label: 'Analytics', icon: LuTrendingUp, to: '/dashboard/analytics' },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin', icon: LuShield, to: '/dashboard/admin' }] : []),
  ]
}
