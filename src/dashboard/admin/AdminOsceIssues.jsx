import React, { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { osceIssueCategoryLabel } from '../osce/osceIssueOptions.js'

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

/** Learner reports on OSCE stations: list on the left, the selected report on the right. */
export default function AdminOsceIssues({ API_BASE }) {
  const [issues, setIssues] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [selectedId, setSelectedId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const status = includeCompleted ? 'all' : 'ongoing'
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/issues?limit=200&status=${status}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not load OSCE issues.')
      setIssues(data.issues || [])
    } catch (e) {
      setError(e.message || 'Could not load OSCE issues.')
    } finally {
      setLoading(false)
    }
  }, [API_BASE, includeCompleted])

  useEffect(() => { load() }, [load])

  const setStatus = async (id, status) => {
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/issues/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Could not update issue.')
      await load()
    } catch (e) {
      setError(e.message || 'Could not update issue.')
    }
  }

  const selected = issues.find((i) => i.id === selectedId) || null

  return (
    <>
      {error && <div className="admin-alert">{error}</div>}
      <div className="admin-osce-issues__bar">
        <label className="admin-tabs__toggle">
          <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
          Include completed
        </label>
        <button type="button" className="admin-subtab-btn" onClick={load} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="admin-grid">
        <section className="admin-card">
          {loading && issues.length === 0 ? (
            <LoadingScreen message="Loading reported issues..." compact />
          ) : issues.length === 0 ? (
            <p className="admin__muted">{includeCompleted ? 'No reported issues in the archive yet.' : 'No ongoing issues.'}</p>
          ) : (
            <div className="admin-list admin-issue-list">
              {issues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={selectedId === issue.id ? 'is-active' : ''}
                  onClick={() => setSelectedId(issue.id)}
                >
                  <span className="admin-issue-list__title">
                    <span>{osceIssueCategoryLabel(issue.category)}</span>
                    {issue.status === 'complete' ? (
                      <span className="admin-issue-pill admin-issue-pill--done">Done</span>
                    ) : (
                      <span className="admin-issue-pill admin-issue-pill--open">Ongoing</span>
                    )}
                  </span>
                  <small>
                    {issue.station?.title || 'Deleted station'} · {issue.section_title} · {formatDate(issue.created_at)}
                  </small>
                  <p>{issue.details}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          {selected ? (
            <div className="admin-issue-summary">
              <div className="admin-issue-summary__head">
                <h2>{osceIssueCategoryLabel(selected.category)}</h2>
                <div className="admin-issue-actions">
                  {selected.status === 'complete' ? (
                    <>
                      <span className="admin-issue-pill admin-issue-pill--done">Complete</span>
                      <button
                        type="button"
                        className="admin-btn-issue admin-btn-issue--ghost"
                        disabled={loading}
                        onClick={() => setStatus(selected.id, 'ongoing')}
                      >
                        Re-open
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn-issue"
                      disabled={loading}
                      onClick={() => setStatus(selected.id, 'complete')}
                    >
                      Mark complete
                    </button>
                  )}
                </div>
              </div>
              <p>{selected.details}</p>
              <small>
                <strong>Station:</strong> {selected.station?.title || 'Deleted station'}
                {' · '}
                <strong>Section:</strong> {selected.section_title}
                {' · '}
                {formatDate(selected.created_at)}
              </small>
              {selected.station?.slug && (
                <p style={{ marginTop: 12 }}>
                  <a
                    href={`/dashboard/osce/station/${selected.station.slug}/practice`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open station in a new tab
                  </a>
                  {' — edit it from the Manage Stations tab.'}
                </p>
              )}
            </div>
          ) : (
            <p className="admin__muted">Select an OSCE issue to inspect it.</p>
          )}
        </section>
      </div>
    </>
  )
}
