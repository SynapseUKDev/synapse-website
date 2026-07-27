import React, { useState } from 'react'
import { LuUserPlus } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

/** The backend caps a single bulk request at 200 students. */
const BULK_LIMIT = 200

/** "a@x.ac.uk, b@x.ac.uk\nc@x.ac.uk" -> ['a@x.ac.uk', 'b@x.ac.uk', 'c@x.ac.uk'] */
function parseEmails(value) {
  const seen = new Set()
  return String(value || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => {
      if (!e || seen.has(e)) return false
      seen.add(e)
      return true
    })
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

/** Classifies one row of a bulk response for display. */
function resultTone(result) {
  if (!result.ok) return 'fail'
  return result.email_sent === false ? 'warn' : 'ok'
}

function resultMessage(result) {
  if (!result.ok) return result.error || 'Failed'
  if (result.email_sent === false) {
    return `added, but the email failed (${result.email_error || 'unknown error'})`
  }
  if (result.linked_existing) return 'linked to their existing account'
  return 'invited'
}

export default function InstitutionInvite({ cohorts = [], onInvited }) {
  const [mode, setMode] = useState('single')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [results, setResults] = useState(null)

  const [single, setSingle] = useState({ email: '', username: '', cohort_id: '' })
  const [bulk, setBulk] = useState({ emails: '', cohort_id: '' })

  const bulkEmails = parseEmails(bulk.emails)

  const reset = () => {
    setError('')
    setNotice('')
    setResults(null)
  }

  const inviteSingle = async (e) => {
    e?.preventDefault()
    if (!single.email.trim()) return
    setBusy(true)
    reset()
    try {
      const payload = { email: single.email.trim() }
      if (single.username.trim()) payload.username = single.username.trim()
      if (single.cohort_id) payload.cohort_id = single.cohort_id

      const res = await authenticatedFetch(`${API_BASE}/institution/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to invite this student'))
        return
      }
      const student = (await res.json().catch(() => ({})))?.student
      if (student?.email_sent === false) {
        setError(
          `${payload.email} was added, but the invite email could not be sent (${student.email_error || 'unknown error'}). Use Resend invite from the roster once that is fixed.`
        )
      } else if (student?.linked_existing) {
        setNotice(`${payload.email} already had an account, so it has been linked to your institution.`)
      } else {
        setNotice(`Invite sent to ${payload.email}.`)
      }
      // The year group is kept, since admins normally invite a run of students
      // into the same one.
      setSingle((p) => ({ email: '', username: '', cohort_id: p.cohort_id }))
      onInvited?.()
    } catch {
      setError('Failed to invite this student')
    } finally {
      setBusy(false)
    }
  }

  const inviteBulk = async (e) => {
    e?.preventDefault()
    if (bulkEmails.length === 0) return
    if (bulkEmails.length > BULK_LIMIT) {
      setError(`That is ${bulkEmails.length} addresses. Please invite at most ${BULK_LIMIT} at a time.`)
      return
    }
    setBusy(true)
    reset()
    try {
      const students = bulkEmails.map((email) => ({ email }))

      const res = await authenticatedFetch(`${API_BASE}/institution/students/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          students,
          ...(bulk.cohort_id ? { cohort_id: bulk.cohort_id } : {}),
        }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to invite these students'))
        return
      }
      const body = await res.json().catch(() => ({}))
      setResults(body.results || [])
      const invited = body.invited ?? 0
      const failed = body.failed ?? 0
      setNotice(
        failed === 0
          ? `Invited all ${invited} student${invited === 1 ? '' : 's'}.`
          : `Invited ${invited}, and ${failed} could not be invited. See the details below.`
      )
      if (invited > 0) {
        setBulk((p) => ({ emails: '', cohort_id: p.cohort_id }))
        onInvited?.()
      }
    } catch {
      setError('Failed to invite these students')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qb-card inst-section">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div
            className="qb-card__icon"
            style={{
              background: '#ecfeff',
              border: '1.5px solid #0ea5e9',
              color: '#0ea5e9',
              borderRadius: '12px',
            }}
          >
            <LuUserPlus size={20} />
          </div>
          <div>
            <div className="qb-card__title">Invite students</div>
            <div className="qb-card__meta" style={{ marginTop: 4 }}>
              They set their own password from the email
            </div>
          </div>
        </div>
      </div>

      <div className="inst-modes" role="group" aria-label="Invite mode" style={{ marginTop: 16 }}>
        <button
          type="button"
          className={mode === 'single' ? 'is-active' : ''}
          onClick={() => {
            setMode('single')
            reset()
          }}
        >
          One student
        </button>
        <button
          type="button"
          className={mode === 'bulk' ? 'is-active' : ''}
          onClick={() => {
            setMode('bulk')
            reset()
          }}
        >
          Many at once
        </button>
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

      {mode === 'single' ? (
        <form className="inst-form" onSubmit={inviteSingle}>
          <div className="inst-form__row">
            <div className="inst-form__field">
              <label className="inst-form__label" htmlFor="inst-invite-email">
                Email
              </label>
              <input
                id="inst-invite-email"
                type="email"
                className="db-input"
                value={single.email}
                onChange={(e) => setSingle((p) => ({ ...p, email: e.target.value }))}
                placeholder="student@uni.ac.uk"
                required
              />
            </div>
            <div className="inst-form__field">
              <label className="inst-form__label" htmlFor="inst-invite-username">
                Username (optional)
              </label>
              <input
                id="inst-invite-username"
                type="text"
                className="db-input"
                value={single.username}
                onChange={(e) => setSingle((p) => ({ ...p, username: e.target.value }))}
                placeholder="Username"
              />
            </div>
            <div className="inst-form__field">
              <label className="inst-form__label" htmlFor="inst-invite-year">
                Year group
              </label>
              <select
                id="inst-invite-year"
                className="db-select"
                value={single.cohort_id}
                onChange={(e) => setSingle((p) => ({ ...p, cohort_id: e.target.value }))}
                disabled={cohorts.length === 0}
              >
                <option value="">{cohorts.length === 0 ? 'None set up yet' : 'No year group'}</option>
                {cohorts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <button type="submit" className="qb-btn qb-btn--sm" disabled={busy || !single.email.trim()}>
              {busy ? 'Sending...' : 'Send invite'}
            </button>
          </div>
        </form>
      ) : (
        <form className="inst-form" onSubmit={inviteBulk}>
          <div className="inst-form__field">
            <label className="inst-form__label" htmlFor="inst-invite-bulk">
              Email addresses
            </label>
            <textarea
              id="inst-invite-bulk"
              className="inst-textarea"
              value={bulk.emails}
              onChange={(e) => setBulk((p) => ({ ...p, emails: e.target.value }))}
              placeholder={'student1@uni.ac.uk\nstudent2@uni.ac.uk\nstudent3@uni.ac.uk'}
            />
            <p className="inst-form__hint">
              One per line, or separated by commas. Duplicates are ignored. Up to {BULK_LIMIT} at a time.
              {bulkEmails.length > 0 && (
                <>
                  {' '}
                  <strong>
                    {bulkEmails.length} address{bulkEmails.length === 1 ? '' : 'es'} ready.
                  </strong>
                </>
              )}
            </p>
          </div>
          <div className="inst-form__field" style={{ maxWidth: 260 }}>
            <label className="inst-form__label" htmlFor="inst-invite-bulk-year">
              Year group for all of them
            </label>
            <select
              id="inst-invite-bulk-year"
              className="db-select"
              value={bulk.cohort_id}
              onChange={(e) => setBulk((p) => ({ ...p, cohort_id: e.target.value }))}
              disabled={cohorts.length === 0}
            >
              <option value="">{cohorts.length === 0 ? 'None set up yet' : 'No year group'}</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <button type="submit" className="qb-btn qb-btn--sm" disabled={busy || bulkEmails.length === 0}>
              {busy ? 'Sending...' : `Invite ${bulkEmails.length || ''} student${bulkEmails.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </form>
      )}

      {results && results.length > 0 && (
        <div className="inst-results">
          {results.map((result, i) => (
            <div key={`${result.email}-${i}`} className={`inst-result inst-result--${resultTone(result)}`}>
              <span className="inst-result__email">{result.email}</span>
              <span>{resultMessage(result)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
