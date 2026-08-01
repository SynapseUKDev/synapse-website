import React, { useRef, useState } from 'react'
import { LuUserPlus, LuPlus, LuX } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import { readRosterCsv } from './csvRoster'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

/** The preview endpoint reads at most this many rows in one request. */
const MAX_ROWS = 500

/** The import endpoint sends an email per row, so it takes them in chunks. */
const IMPORT_CHUNK = 50

/** A whole year group in one table is unreadable, so the summary is paged. */
const PAGE_SIZE = 20

const ACTION_LABELS = {
  invite: 'Will be invited',
  link_existing: 'Has an account, will be linked',
  skip_already_member: 'Already in your institution',
  error: 'Problem',
}

const ACTION_TONES = {
  invite: 'ok',
  link_existing: 'ok',
  skip_already_member: 'warn',
  error: 'fail',
}

/** Added, but the admin still has something to do about it. */
function needsAttention(result) {
  return !result.ok || result.email_sent === false
}

function resultMessage(result) {
  if (!result.ok) return result.error || 'Failed'
  if (result.email_sent === false) {
    return `added, but the email failed (${result.email_error || 'unknown error'}). Use Resend invite from the roster.`
  }
  return 'added'
}

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

let nextRowId = 1
const blankRow = () => ({ id: (nextRowId += 1), name: '', email: '', year_group: '' })

/**
 * Adding students, whether that is one person or a whole cohort.
 *
 * Typed rows and an uploaded CSV feed the same two endpoints: a preview that
 * writes nothing and reports what each row would do, then an import that runs
 * the identical planner again. So the summary an admin approves is what they
 * get, and there is only one path to keep working.
 */
export default function InstitutionInvite({ cohorts = [], usernameTag, onInvited }) {
  const fileRef = useRef(null)
  const [rows, setRows] = useState([blankRow()])
  const [fromFile, setFromFile] = useState('')
  const [drag, setDrag] = useState(false)
  const [plan, setPlan] = useState(null)
  const [page, setPage] = useState(1)
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [error, setError] = useState('')

  /** Rows worth sending: anything the admin has actually put something into. */
  const filled = rows.filter((row) => row.name.trim() || row.email.trim())

  const startOver = () => {
    setRows([blankRow()])
    setFromFile('')
    setPlan(null)
    setResults(null)
    setError('')
    setProgress({ done: 0, total: 0 })
    if (fileRef.current) fileRef.current.value = ''
  }

  /** Any edit invalidates a summary that was calculated from the old rows. */
  const editRows = (next) => {
    setRows(next)
    setPlan(null)
    setError('')
  }

  const setRow = (id, patch) => editRows(rows.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const addRow = () => editRows([...rows, blankRow()])
  const removeRow = (id) => editRows(rows.length === 1 ? [blankRow()] : rows.filter((row) => row.id !== id))

  const toPayload = (list) =>
    list.map((row) => ({ name: row.name.trim(), email: row.email.trim(), year_group: row.year_group.trim() }))

  const review = async (list) => {
    setBusy(true)
    setError('')
    setResults(null)
    try {
      if (list.length === 0) return
      if (list.length > MAX_ROWS) {
        setError(`That is ${list.length} students. Please do them in batches of ${MAX_ROWS} or fewer.`)
        return
      }

      const res = await authenticatedFetch(`${API_BASE}/institution/students/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: toPayload(list) }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to check these students'))
        return
      }
      setPlan(await res.json())
      setPage(1)
    } catch {
      setError('Failed to check these students')
    } finally {
      setBusy(false)
    }
  }

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setResults(null)
    setPlan(null)
    // Set here rather than in review, so the wait covers reading the file too.
    setBusy(true)

    let parsed
    try {
      parsed = await readRosterCsv(file)
    } catch (e) {
      setFromFile('')
      setError(e?.message || 'Could not read that file')
      setBusy(false)
      return
    }

    const loaded = parsed.map((row) => ({ ...blankRow(), ...row }))
    setRows(loaded)
    setFromFile(file.name)
    await review(loaded)
  }

  /**
   * Send in chunks, keeping every row's result. A chunk that fails outright
   * stops the run: carrying on would send more email into whatever went wrong,
   * and the rows already done are safe to keep.
   */
  const runImport = async () => {
    const list = fromFile ? rows : filled
    setImporting(true)
    setError('')
    setProgress({ done: 0, total: list.length })
    const collected = []

    try {
      for (let start = 0; start < list.length; start += IMPORT_CHUNK) {
        const chunk = list.slice(start, start + IMPORT_CHUNK)
        const res = await authenticatedFetch(`${API_BASE}/institution/students/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: toPayload(chunk) }),
        })
        if (!res.ok) {
          setError(await readError(res, 'This stopped partway through'))
          break
        }
        const body = await res.json().catch(() => ({}))
        // Row indexes come back relative to the chunk.
        for (const result of body.results || []) collected.push({ ...result, index: start + (result.index ?? 0) })
        setProgress({ done: Math.min(start + chunk.length, list.length), total: list.length })
        setResults([...collected])
      }
    } catch {
      setError('This stopped partway through')
    } finally {
      // Nothing collected means the very first chunk failed, so leave the rows
      // where they are instead of showing a summary of zeros.
      setResults(collected.length > 0 ? collected : null)
      setPlan(null)
      setImporting(false)
      if (collected.some((r) => r.ok && !r.skipped)) onInvited?.()
    }
  }

  const summary = plan?.summary
  const seats = plan?.seats
  const toAdd = summary ? summary.invite + summary.link_existing : 0
  const showEditor = !results && !fromFile

  // A repeated address is handled by the row above it, so it is noise in a
  // list the admin is reading through.
  const planRows = (plan?.rows ?? []).filter((row) => row.action !== 'duplicate_in_file')
  const pageCount = Math.max(1, Math.ceil(planRows.length / PAGE_SIZE))
  const firstOnPage = (page - 1) * PAGE_SIZE
  const pageRows = planRows.slice(firstOnPage, firstOnPage + PAGE_SIZE)

  const done = {
    invited: (results ?? []).filter((r) => r.ok && !r.skipped && !r.linked_existing).length,
    linked: (results ?? []).filter((r) => r.ok && r.linked_existing).length,
    skipped: (results ?? []).filter((r) => r.skipped).length,
    failed: (results ?? []).filter((r) => !r.ok).length,
  }
  const attention = (results ?? []).filter(needsAttention)
  const doneHint =
    done.invited + done.linked > 0
      ? 'Everyone was emailed a link to set their own password. It lasts 24 hours — you can resend it from the roster below.'
      : 'Nothing was created: everyone on that list is already in your institution.'

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
            <div className="qb-card__title">Add students</div>
            <div className="qb-card__meta" style={{ marginTop: 4 }}>
              They set their own password
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="inst-alert inst-alert--error" role="alert">
          <div>{error}</div>
        </div>
      )}
      {showEditor && (
        <>
          <div className="inst-rows">
            {rows.map((row, index) => (
              <div className="inst-row" key={row.id}>
                <div className="inst-form__field">
                  {index === 0 && (
                    <label className="inst-form__label" htmlFor={`inst-row-name-${row.id}`}>
                      Name
                    </label>
                  )}
                  <input
                    id={`inst-row-name-${row.id}`}
                    type="text"
                    className="db-input"
                    value={row.name}
                    onChange={(e) => setRow(row.id, { name: e.target.value })}
                    placeholder="John Smith"
                    aria-label="Name"
                    maxLength={120}
                  />
                </div>
                <div className="inst-form__field">
                  {index === 0 && (
                    <label className="inst-form__label" htmlFor={`inst-row-email-${row.id}`}>
                      Email
                    </label>
                  )}
                  <input
                    id={`inst-row-email-${row.id}`}
                    type="email"
                    className="db-input"
                    value={row.email}
                    onChange={(e) => setRow(row.id, { email: e.target.value })}
                    placeholder="student@uni.ac.uk"
                    aria-label="Email"
                  />
                </div>
                <div className="inst-form__field">
                  {index === 0 && (
                    <label className="inst-form__label" htmlFor={`inst-row-year-${row.id}`}>
                      Year group
                    </label>
                  )}
                  <select
                    id={`inst-row-year-${row.id}`}
                    className="db-select"
                    value={row.year_group}
                    onChange={(e) => setRow(row.id, { year_group: e.target.value })}
                    aria-label="Year group"
                    disabled={cohorts.length === 0}
                  >
                    <option value="">{cohorts.length === 0 ? 'None set up yet' : 'No year group'}</option>
                    {cohorts.map((cohort) => (
                      <option key={cohort.id} value={cohort.name}>
                        {cohort.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="inst-btn inst-row__remove"
                  onClick={() => removeRow(row.id)}
                  disabled={rows.length === 1 && !row.name && !row.email}
                  title="Remove this student"
                  aria-label="Remove this student"
                >
                  <LuX size={14} aria-hidden />
                </button>
              </div>
            ))}
          </div>

          <div className="inst-import__actions">
            <button type="button" className="inst-btn" onClick={addRow}>
              <LuPlus size={14} aria-hidden /> Add another
            </button>
          </div>

          <div
            className={`inst-drop${drag ? ' inst-drop--over' : ''}`}
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              handleFile(e.dataTransfer.files?.[0])
            }}
          >
            <input
              ref={fileRef}
              id="inst-roster-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {busy && <span className="inst-spinner" aria-hidden />}
            <span className="inst-drop__label">
              {busy ? 'Reading your file...' : 'Or drop a CSV here to add a whole year at once'}
            </span>
            <span className="inst-drop__hint">
              Columns: <strong>Name</strong>, <strong>Email</strong>, and <strong>Year group</strong> if you use them.
              Up to {MAX_ROWS} students at a time.
            </span>
          </div>

          <div className="inst-import__actions">
            <button
              type="button"
              className="qb-btn qb-btn--sm"
              onClick={() => review(filled)}
              disabled={busy || filled.length === 0}
            >
              {busy ? 'Checking...' : `Review ${filled.length || ''} student${filled.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </>
      )}

      {fromFile && !results && (
        <div className="inst-import__actions" style={{ marginTop: 16 }}>
          <span className="inst-import__progress" role="status" aria-live="polite">
            {busy && <span className="inst-spinner" aria-hidden />}
            <span>
              Read <strong>{fromFile}</strong> — {rows.length} row{rows.length === 1 ? '' : 's'}
              {busy ? ', checking them now...' : ''}
            </span>
          </span>
          {/* The plan panel has its own, so this is the way back when the check failed. */}
          {!busy && !plan && (
            <button type="button" className="inst-btn" onClick={startOver}>
              Start again
            </button>
          )}
        </div>
      )}

      {plan && (
        <>
          <div className="inst-summary">
            <div className="inst-summary__item">
              <span className="inst-summary__num">{summary.invite}</span>
              <span className="inst-summary__label">to invite</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{summary.link_existing}</span>
              <span className="inst-summary__label">already have an account</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{summary.skip_already_member}</span>
              <span className="inst-summary__label">already in your institution</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{summary.error}</span>
              <span className="inst-summary__label">with problems</span>
            </div>
          </div>

          {summary.new_cohorts.length > 0 && (
            <p className="inst-form__hint">
              New year groups that will be created: <strong>{summary.new_cohorts.join(', ')}</strong>
            </p>
          )}

          {summary.duplicate_in_file > 0 && (
            <p className="inst-form__hint">
              {summary.duplicate_in_file} row{summary.duplicate_in_file === 1 ? ' repeats' : 's repeat'} an address
              listed earlier, so {summary.duplicate_in_file === 1 ? 'it has' : 'they have'} been left out below.
            </p>
          )}

          {seats?.over_limit && (
            <div className="inst-alert inst-alert--error" role="alert">
              <div>
                This would need {seats.needed} seats but only {Math.max(0, seats.limit - seats.used)} are left. Get in
                touch to raise your limit.
              </div>
            </div>
          )}

          <div className="inst-table-wrap" style={{ marginTop: 14 }}>
            <table className="inst-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Username</th>
                  <th>Year group</th>
                  <th>What will happen</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.index}>
                    <td>{row.name || '—'}</td>
                    <td>
                      <div className="inst-table__email">{row.email || '—'}</div>
                    </td>
                    <td>{row.username || '—'}</td>
                    <td>
                      {row.cohort_name || '—'}
                      {row.cohort_name && !row.cohort_exists && <span className="inst-tag">new</span>}
                    </td>
                    <td>
                      <span className={`inst-result inst-result--${ACTION_TONES[row.action]}`}>
                        {row.error || ACTION_LABELS[row.action]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="inst-pager">
              <span className="inst-pager__label">
                Showing {firstOnPage + 1}–{firstOnPage + pageRows.length} of {planRows.length}
              </span>
              <button
                type="button"
                className="inst-btn"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Previous
              </button>
              <span className="inst-pager__label">
                Page {page} of {pageCount}
              </span>
              <button
                type="button"
                className="inst-btn"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page === pageCount}
              >
                Next
              </button>
            </div>
          )}

          <div className="inst-import__actions">
            <button
              type="button"
              className="qb-btn qb-btn--sm"
              onClick={runImport}
              disabled={importing || seats?.over_limit || toAdd === 0}
            >
              {importing ? 'Adding...' : `Confirm and invite ${toAdd} student${toAdd === 1 ? '' : 's'}`}
            </button>
            <button type="button" className="inst-btn" onClick={startOver} disabled={importing}>
              Start again
            </button>
            {importing && (
              <span className="inst-import__progress" role="status" aria-live="polite">
                <span className="inst-spinner" aria-hidden />
                <span>
                  {progress.done} of {progress.total} sent
                </span>
              </span>
            )}
          </div>
          <p className="inst-form__hint">
            Nothing has been created yet. Usernames are shown as they will be issued
            {usernameTag ? `, ending in .${usernameTag}` : ''}.
          </p>
        </>
      )}

      {results && (
        <>
          <div className="inst-summary">
            <div className="inst-summary__item">
              <span className="inst-summary__num">{done.invited}</span>
              <span className="inst-summary__label">invited</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{done.linked}</span>
              <span className="inst-summary__label">linked to an existing account</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{done.skipped}</span>
              <span className="inst-summary__label">already in your institution</span>
            </div>
            <div className="inst-summary__item">
              <span className="inst-summary__num">{done.failed}</span>
              <span className="inst-summary__label">could not be added</span>
            </div>
          </div>

          {/* Everything that went to plan is in the counts above; only rows the
              admin has to do something about are worth listing. */}
          {attention.length > 0 ? (
            <>
              <p className="inst-form__hint">
                {attention.length === 1 ? 'One student needs' : `${attention.length} students need`} a second look:
              </p>
              <div className="inst-results">
                {attention.map((result) => (
                  <div key={result.index} className={`inst-result inst-result--${result.ok ? 'warn' : 'fail'}`}>
                    <span className="inst-result__email">{result.email}</span>
                    <span>{resultMessage(result)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="inst-form__hint">{doneHint}</p>
          )}

          {!importing && (
            <div className="inst-import__actions">
              <button type="button" className="qb-btn qb-btn--sm" onClick={startOver}>
                Add more students
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
