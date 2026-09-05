// AdminStudyReports.jsx
import { useCallback, useEffect, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function AdminStudyReports() {
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState(null)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/reports/summary`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      setSummary(await res.json())
    } catch (e) { setError(e.message) }
  }, [])

  useEffect(() => { load() }, [load])

  async function runTick() {
    setRunning(true)
    setResult(null)
    setError(null)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/reports/tick`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Request failed: ${res.status}`)
      setResult(json)
      await load()
    } catch (e) { setError(e.message) } finally { setRunning(false) }
  }

  const cfg = summary?.config
  return (
    <div className="admin-grid">
      <section className="admin-card">
        <h2>Monthly AI study reports</h2>
        {error ? <div className="admin-alert">{error}</div> : null}
        {summary ? (
          <>
            <p className="admin__muted">{summary.next_action_detail}</p>
            <p className="admin__muted">
              Model <b>{cfg.model}</b> · min {cfg.min_attempts} attempts · max {cfg.max_per_run} per run ·
              OpenAI key {cfg.openai_configured ? 'set' : <b>missing</b>} · email {cfg.email_configured ? 'on' : 'off'}
            </p>
            <button type="button" className="admin-btn-issue" disabled={running || summary.next_action === 'noop'} onClick={runTick}>
              {running ? 'Running…' : summary.next_action === 'collect' ? 'Check batch and ingest' : summary.next_action === 'submit' ? 'Submit this month\'s batch' : 'Nothing to run'}
            </button>
            {summary.next_action === 'noop' ? <button type="button" className="admin-btn-issue admin-btn-issue--ghost" disabled={running} onClick={runTick}>Run anyway</button> : null}
            {result ? (
              <div className="admin-alert admin-alert--success">
                {result.period.label}: collected {result.collected.batches} batch(es), {result.collected.generated} generated, {result.collected.failed} failed ·
                submitted {result.submitted.users}, skipped {result.submitted.skipped}, remaining {result.remaining}
                {result.notes.length ? ` · ${result.notes.join('; ')}` : ''}
              </div>
            ) : null}
          </>
        ) : <p className="admin__muted">Loading…</p>}
      </section>

      <section className="admin-card">
        <h2>Usage by period</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Period</th><th>Generated</th><th>Failed</th><th>Skipped</th><th>Pending</th><th>Submitted</th><th>Fallback</th><th>Prompt tokens</th><th>Completion tokens</th></tr></thead>
            <tbody>
              {(summary?.periods || []).map((p) => (
                <tr key={p.period_start}><td>{p.period_start.slice(0, 7)}</td><td>{p.generated}</td><td>{p.failed}</td><td>{p.skipped}</td><td>{p.pending}</td><td>{p.submitted}</td><td>{p.fallback}</td><td>{p.prompt_tokens}</td><td>{p.completion_tokens}</td></tr>
              ))}
              {!summary?.periods?.length ? <tr><td colSpan="9" className="admin__muted">No reports yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin-card">
        <h2>Batches</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Period</th><th>Status</th><th>Reports</th><th>Submitted</th><th>Completed</th><th>Error</th></tr></thead>
            <tbody>
              {(summary?.batches || []).map((b) => (
                <tr key={b.id}><td>{b.period_start.slice(0, 7)}</td><td>{b.status}</td><td>{b.report_count}</td><td>{new Date(b.submitted_at).toLocaleString('en-GB')}</td><td>{b.completed_at ? new Date(b.completed_at).toLocaleString('en-GB') : '—'}</td><td>{b.error || ''}</td></tr>
              ))}
              {!summary?.batches?.length ? <tr><td colSpan="6" className="admin__muted">No batches yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
