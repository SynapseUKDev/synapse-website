import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { LuUsers, LuMail, LuPencil, LuTrash2, LuChartBar, LuPause, LuPlay } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import InstitutionStudentDetail from './InstitutionStudentDetail'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const STATUS_FILTERS = [
  { value: '', label: 'All current students' },
  { value: 'invited', label: 'Invited — not set up yet' },
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'removed', label: 'Removed' },
]

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

export default function InstitutionRoster({ cohorts = [], refreshKey, onChanged }) {
  const [loading, setLoading] = useState(true)
  const [students, setStudents] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [cohortFilter, setCohortFilter] = useState('')
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ username: '', cohort_id: '' })
  const [detailId, setDetailId] = useState(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      if (cohortFilter) params.set('cohort_id', cohortFilter)
      const query = params.toString() ? `?${params.toString()}` : ''
      const res = await authenticatedFetch(`${API_BASE}/institution/students${query}`, { cache: 'no-store' })
      if (!res.ok) {
        setError(await readError(res, 'Failed to load your students'))
        return
      }
      const body = await res.json()
      setStudents(body.students || [])
    } catch {
      setError('Failed to load your students')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, cohortFilter])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  // A cohort can be deleted while it is the active filter, which would otherwise
  // leave the roster stuck showing nothing.
  useEffect(() => {
    if (!cohortFilter || cohortFilter === 'none') return
    if (!cohorts.some((c) => c.id === cohortFilter)) setCohortFilter('')
  }, [cohorts, cohortFilter])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter((s) =>
      [s.email, s.username, s.cohort_name].some((field) => String(field || '').toLowerCase().includes(term))
    )
  }, [students, search])

  /** Runs a mutation, then refreshes both the roster and the parent's counts. */
  const run = async (userId, fn, successMessage) => {
    setBusyId(userId)
    setError('')
    setNotice('')
    try {
      const ok = await fn()
      if (ok) {
        setNotice(successMessage)
        await load()
        onChanged?.()
      }
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const resendInvite = (student) =>
    run(
      student.user_id,
      async () => {
        const res = await authenticatedFetch(`${API_BASE}/institution/students/${student.user_id}/resend-invite`, {
          method: 'POST',
        })
        if (!res.ok) {
          setError(await readError(res, 'Failed to resend the invite'))
          return false
        }
        return true
      },
      `Invite resent to ${student.email}.`
    )

  const setStatus = (student, status) =>
    run(
      student.user_id,
      async () => {
        const res = await authenticatedFetch(`${API_BASE}/institution/students/${student.user_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        if (!res.ok) {
          setError(await readError(res, 'Failed to update this student'))
          return false
        }
        return true
      },
      status === 'suspended' ? `${student.email} has been suspended.` : `${student.email} is active again.`
    )

  const removeStudent = (student) => {
    if (
      !window.confirm(
        `Remove ${student.email}? They lose access immediately and their seat is freed, but their answer history stays in your statistics. This can't be undone from here.`
      )
    ) {
      return
    }
    return run(
      student.user_id,
      async () => {
        const res = await authenticatedFetch(`${API_BASE}/institution/students/${student.user_id}`, {
          method: 'DELETE',
        })
        if (!res.ok) {
          setError(await readError(res, 'Failed to remove this student'))
          return false
        }
        return true
      },
      `${student.email} has been removed.`
    )
  }

  const startEdit = (student) => {
    setEditingId(student.user_id)
    setEditForm({ username: student.username || '', cohort_id: student.cohort_id || '' })
    setError('')
    setNotice('')
  }

  const saveEdit = (student) =>
    run(
      student.user_id,
      async () => {
        const payload = {}
        const username = editForm.username.trim()
        if (username && username !== (student.username || '')) payload.username = username
        if (editForm.cohort_id !== (student.cohort_id || '')) {
          payload.cohort_id = editForm.cohort_id === '' ? null : editForm.cohort_id
        }

        if (Object.keys(payload).length === 0) {
          setEditingId(null)
          return false
        }

        const res = await authenticatedFetch(`${API_BASE}/institution/students/${student.user_id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          setError(await readError(res, 'Failed to save this student'))
          return false
        }
        setEditingId(null)
        return true
      },
      `${student.email} updated.`
    )

  return (
    <div className="qb-card inst-section">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div
            className="qb-card__icon"
            style={{
              background: '#f5f3ff',
              border: '1.5px solid #8b5cf6',
              color: '#8b5cf6',
              borderRadius: '12px',
            }}
          >
            <LuUsers size={20} />
          </div>
          <div>
            <div className="qb-card__title">Students</div>
            <div className="qb-card__meta" style={{ marginTop: 4 }}>
              Manage your roster and see how each student is doing
            </div>
          </div>
        </div>
      </div>

      <div className="inst-toolbar">
        <select
          className="db-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {cohorts.length > 0 && (
          <select
            className="db-select"
            value={cohortFilter}
            onChange={(e) => setCohortFilter(e.target.value)}
            aria-label="Filter by year group"
          >
            <option value="">All year groups</option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">No year group</option>
          </select>
        )}
        <input
          type="search"
          className="db-input inst-toolbar__search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email, username or year"
          aria-label="Search students"
        />
        <span className="inst-toolbar__count">
          {visible.length} of {students.length}
        </span>
      </div>

      {error && (
        <div className="inst-alert inst-alert--error" role="alert">
          <div>{error}</div>
        </div>
      )}
      {notice && (
        <div className="inst-alert inst-alert--success" role="status">
          <div>{notice}</div>
        </div>
      )}

      {loading ? (
        <LoadingScreen message="Loading students..." inline />
      ) : students.length === 0 ? (
        <p className="inst-placeholder">
          {statusFilter || cohortFilter
            ? 'No students match this filter.'
            : 'No students yet. Invite your first ones using the form above.'}
        </p>
      ) : visible.length === 0 ? (
        <p className="inst-placeholder">No students match “{search}”.</p>
      ) : (
        <div className="inst-table-wrap">
          <table className="inst-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Year group</th>
                <th>Status</th>
                <th>Answered</th>
                <th>Accuracy</th>
                <th>Last active</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visible.map((student) => {
                const isBusy = busyId === student.user_id
                const isEditing = editingId === student.user_id
                return (
                  <React.Fragment key={student.user_id}>
                    <tr>
                      <td>
                        <div className="inst-table__email">{student.email || '—'}</div>
                        {student.username && <div className="inst-table__sub">{student.username}</div>}
                      </td>
                      <td className="inst-table__num">{student.cohort_name || '—'}</td>
                      <td>
                        <span className={`inst-status inst-status--${student.status}`}>{student.status}</span>
                      </td>
                      <td className="inst-table__num">{student.total_answered ?? 0}</td>
                      <td className="inst-table__num">
                        {student.accuracy_pct === null || student.accuracy_pct === undefined
                          ? '—'
                          : `${student.accuracy_pct}%`}
                      </td>
                      <td className="inst-table__num">{formatDate(student.last_attempt_at)}</td>
                      <td>
                        <div className="inst-table__actions">
                          <button
                            type="button"
                            className="inst-btn"
                            onClick={() => setDetailId(student.user_id)}
                            title="View statistics"
                          >
                            <LuChartBar size={14} aria-hidden /> Stats
                          </button>
                          {student.status === 'invited' && (
                            <button
                              type="button"
                              className="inst-btn"
                              onClick={() => resendInvite(student)}
                              disabled={isBusy}
                              title="Resend the invite email"
                            >
                              <LuMail size={14} aria-hidden /> Resend
                            </button>
                          )}
                          {student.status !== 'removed' && (
                            <button
                              type="button"
                              className="inst-btn"
                              onClick={() => (isEditing ? setEditingId(null) : startEdit(student))}
                              disabled={isBusy}
                              title="Edit username and year group"
                            >
                              <LuPencil size={14} aria-hidden /> Edit
                            </button>
                          )}
                          {student.status === 'active' && (
                            <button
                              type="button"
                              className="inst-btn"
                              onClick={() => setStatus(student, 'suspended')}
                              disabled={isBusy}
                              title="Block access without freeing their seat"
                            >
                              <LuPause size={14} aria-hidden /> Suspend
                            </button>
                          )}
                          {student.status === 'suspended' && (
                            <button
                              type="button"
                              className="inst-btn"
                              onClick={() => setStatus(student, 'active')}
                              disabled={isBusy}
                              title="Restore access"
                            >
                              <LuPlay size={14} aria-hidden /> Activate
                            </button>
                          )}
                          {student.status !== 'removed' && (
                            <button
                              type="button"
                              className="inst-btn inst-btn--danger"
                              onClick={() => removeStudent(student)}
                              disabled={isBusy}
                              title="Revoke access and free their seat"
                            >
                              <LuTrash2 size={14} aria-hidden /> Remove
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isEditing && (
                      <tr className="inst-edit">
                        <td colSpan={7}>
                          <div className="inst-edit__grid">
                            <div className="inst-edit__field">
                              <span className="inst-edit__label">Username</span>
                              <input
                                type="text"
                                className="db-input"
                                value={editForm.username}
                                onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))
                                }
                                placeholder="not set"
                              />
                            </div>
                            <div className="inst-edit__field">
                              <span className="inst-edit__label">Year group</span>
                              <select
                                className="db-select"
                                value={editForm.cohort_id}
                                onChange={(e) => setEditForm((p) => ({ ...p, cohort_id: e.target.value }))}
                                disabled={cohorts.length === 0}
                              >
                                <option value="">
                                  {cohorts.length === 0 ? 'None set up yet' : 'No year group'}
                                </option>
                                {cohorts.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              className="qb-btn qb-btn--sm"
                              onClick={() => saveEdit(student)}
                              disabled={isBusy}
                            >
                              {isBusy ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="inst-btn inst-btn--lg"
                              onClick={() => setEditingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {detailId && <InstitutionStudentDetail userId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  )
}
