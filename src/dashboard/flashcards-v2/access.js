// Mirrors the server's beta gate (osce permission) only to decide whether to request admin previews
// (?preview=1) and show QA badges. The server is the gate: learners are not blocked here, and a 403
// from the API is what shows the beta message.
export function isFlashcardsAdmin(user) {
  return !!user?.is_admin || !!user?.capabilities?.is_admin || !!user?.capabilities?.can_manage_osce
}
