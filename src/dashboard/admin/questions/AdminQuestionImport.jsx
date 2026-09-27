import React, { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LuUpload } from 'react-icons/lu'
import { ADMIN_IMPORTS_PATH } from './questionAdminAccess'
import { listImportBatches, validateImportFile } from './questionAdminApi'
import './AdminQuestions.css'

const MAX_FILE_BYTES = 10 * 1024 * 1024

const STATUS_LABELS = {
  validated: 'Awaiting review',
  processing: 'Interrupted – retry',
  completed: 'Completed',
  completed_with_errors: 'Completed with errors',
  cancelled: 'Cancelled',
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

/** Bulk import entry: choose one generator .import.json file and send it for server validation. */
export default function AdminQuestionImport() {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [recent, setRecent] = useState({ loading: true, batches: [] })

  useEffect(() => {
    listImportBatches()
      .then((data) => setRecent({ loading: false, batches: data?.batches || [] }))
      .catch(() => setRecent({ loading: false, batches: [] }))
  }, [])

  const chooseFile = (event) => {
    setError(null)
    setFile(event.target.files?.[0] || null)
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!file || busy) return
    setError(null)
    if (file.size > MAX_FILE_BYTES) {
      setError('This file is larger than 10 MB. Split it into smaller files of up to 500 questions.')
      return
    }

    let content
    try {
      content = await file.text()
    } catch {
      setError('The file could not be read. Check it is a saved .json file and try again.')
      return
    }
    // Only a readability check: the server does all validation.
    try {
      JSON.parse(content.replace(/^\uFEFF/, ''))
    } catch {
      setError('This file is not valid JSON. Upload the .import.json file written by the question scripts.')
      return
    }

    setBusy(true)
    try {
      const data = await validateImportFile(file.name, content)
      navigate(`${ADMIN_IMPORTS_PATH}/${data.batch.id}`)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <section className="aqi" aria-label="Bulk import">
      <form className="admin-card aqi__upload" onSubmit={submit}>
        <h2 className="aqe__heading">Upload generated questions</h2>
        <p className="admin__muted">
          Choose the <code>.import.json</code> file written next to each topic&apos;s CSV by the question scripts (up to
          500 questions). Nothing is created until you review the results and confirm. Imported questions are always
          inactive drafts.
        </p>
        <label className="aqi__file">
          <span>Question file</span>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            onChange={chooseFile}
            disabled={busy}
            aria-describedby={error ? 'aqi-error' : undefined}
          />
        </label>
        {error && (
          <div id="aqi-error" className="admin-alert" role="alert">
            {error}
          </div>
        )}
        <div className="aqe__actions">
          <button type="submit" className="aqe-button" disabled={!file || busy}>
            <LuUpload aria-hidden /> {busy ? 'Validating…' : 'Validate file'}
          </button>
          {busy && (
            <span className="admin__muted" role="status">
              Checking every question, topic and duplicate. Large files can take up to 30 seconds.
            </span>
          )}
        </div>
      </form>

      <div className="admin-card">
        <h2 className="aqe__heading">Recent imports</h2>
        {recent.loading ? (
          <p className="admin__muted" role="status">
            Loading…
          </p>
        ) : recent.batches.length === 0 ? (
          <p className="admin__muted">No imports yet.</p>
        ) : (
          <ul className="aqi__recent">
            {recent.batches.map((batch) => (
              <li key={batch.id}>
                <Link to={`${ADMIN_IMPORTS_PATH}/${batch.id}`}>{batch.source_filename}</Link>
                <span className="admin__muted">
                  {formatDate(batch.created_at)} · {batch.total_count} records ·{' '}
                  <strong>{STATUS_LABELS[batch.status] || batch.status}</strong>
                  {batch.status !== 'validated' && ` · ${batch.created_count} created, ${batch.failed_count} failed`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
