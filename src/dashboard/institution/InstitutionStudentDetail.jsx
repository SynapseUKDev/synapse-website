import React, { useCallback, useEffect, useState } from 'react'
import { LuX } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function formatDate(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  } catch {
    return '—'
  }
}

function formatSeconds(ms) {
  if (!ms) return '—'
  return `${Math.round(ms / 1000)}s`
}

/** Read-only stats for one student, opened from the roster. */
export default function InstitutionStudentDetail({ userId, onClose }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/institution/students/${userId}/stats`, { cache: 'no-store' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Failed to load this student')
        return
      }
      setData(await res.json())
    } catch {
      setError('Failed to load this student')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  const student = data?.student
  const summary = data?.summary
  const specialties = data?.specialties || []
  const maxAttempted = specialties.reduce((max, s) => Math.max(max, s.attempted || 0), 0)

  return (
    <div className="inst-modal" role="dialog" aria-modal="true" aria-label="Student details">
      <div className="inst-modal__backdrop" onClick={onClose} />
      <div className="inst-modal__panel">
        <div className="inst-modal__head">
          <div>
            <div className="inst-modal__title">{student?.student_name || student?.email || 'Student'}</div>
            {student && (
              <div className="inst-modal__meta">
                <span className={`inst-status inst-status--${student.status}`}>{student.status}</span>
                {student.student_name && student.email ? <span>{student.email}</span> : null}
                {student.username ? <span>{student.username}</span> : null}
                {student.cohort_name ? <span>{student.cohort_name}</span> : null}
                <span>
                  {student.joined_at
                    ? `Joined ${formatDate(student.joined_at)}`
                    : `Invited ${formatDate(student.invited_at)}`}
                </span>
              </div>
            )}
          </div>
          <button type="button" className="inst-modal__close" onClick={onClose} aria-label="Close">
            <LuX size={20} />
          </button>
        </div>

        {loading ? (
          <LoadingScreen message="Loading student..." inline />
        ) : error ? (
          <div className="inst-alert inst-alert--error" role="alert">
            <div>{error}</div>
          </div>
        ) : (
          <>
            <div className="inst-summary">
              <div className="inst-summary__item">
                <div className="inst-summary__label">Answered</div>
                <div className="inst-summary__value">{summary?.total_answered ?? 0}</div>
              </div>
              <div className="inst-summary__item">
                <div className="inst-summary__label">Correct</div>
                <div className="inst-summary__value">{summary?.correct ?? 0}</div>
              </div>
              <div className="inst-summary__item">
                <div className="inst-summary__label">Accuracy</div>
                <div className="inst-summary__value">
                  {summary?.accuracy_pct === null || summary?.accuracy_pct === undefined
                    ? '—'
                    : `${summary.accuracy_pct}%`}
                </div>
              </div>
              <div className="inst-summary__item">
                <div className="inst-summary__label">Avg time</div>
                <div className="inst-summary__value">{formatSeconds(summary?.avg_time_ms)}</div>
              </div>
            </div>

            <p className="inst-form__hint" style={{ marginTop: 12 }}>
              Last answered a question {summary?.last_attempt_at ? formatDate(summary.last_attempt_at) : 'never'}.
            </p>

            <div className="inst-subhead">By specialty</div>
            {specialties.length === 0 ? (
              <p className="inst-form__hint">
                This student has not answered any questions yet, so there is nothing to break down.
              </p>
            ) : (
              <div className="inst-spec">
                {specialties.map((s) => (
                  <div key={s.specialty_id} className="inst-spec__row">
                    <div className="inst-spec__name">{s.name}</div>
                    <div className="inst-spec__num">
                      {s.correct}/{s.attempted}
                      {s.accuracy_pct === null ? '' : ` • ${s.accuracy_pct}%`}
                    </div>
                    <div className="inst-spec__bar">
                      <span style={{ width: maxAttempted > 0 ? `${(s.attempted / maxAttempted) * 100}%` : '0%' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
