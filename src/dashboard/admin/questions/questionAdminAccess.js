export const ADMIN_QUESTIONS_PATH = '/dashboard/admin/questions'
export const ADMIN_IMPORTS_PATH = '/dashboard/admin/question-imports'

/** Mirrors Admin.jsx: global admins and QBank admins may manage questions. The server re-checks. */
export function canManageQbank(user) {
  return !!user?.is_admin || !!user?.capabilities?.is_admin || !!user?.capabilities?.can_manage_qbank
}
