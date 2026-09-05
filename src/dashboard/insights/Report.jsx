// Report.jsx
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import { practiceLink, textbookLink } from './analyticsFormat'
import './Analytics.css'
import './Report.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function fmtDate(iso) {
  return iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
}

export default function Report() {
  const { id } = useParams()
  const [data, setData] = useState(null)
  const [list, setList] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setData(null)
    setError(null)
    ;(async () => {
      try {
        const [r, l] = await Promise.all([
          authenticatedFetch(`${API_BASE}/reports/${encodeURIComponent(id)}`),
          authenticatedFetch(`${API_BASE}/reports`),
        ])
        if (!r.ok) throw new Error(r.status === 404 ? 'This report does not exist or is not yours.' : `Request failed: ${r.status}`)
        const json = await r.json()
        const lj = l.ok ? await l.json() : { reports: [] }
        if (!cancelled) {
          setData(json)
          setList(lj.reports || [])
        }
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (error) return <div className="an"><div className="an-card an-error">{error} <Link className="an-btn" to="/dashboard/analytics">Back to analytics</Link></div></div>
  if (!data) return <div className="an"><div className="an-card an-empty">Loading your report…</div></div>

  const { report, plan } = data
  const done = plan.filter((p) => p.done).length
  const pct = plan.length ? Math.round((done / plan.length) * 100) : 0

  return (
    <div className="an rp">
      <div className="an-hero">
        <div>
          <p className="an-eyebrow">Monthly AI report · {report.period.label}</p>
          <h1 className="an-title">{report.headline}</h1>
          <p className="an-date">Generated {fmtDate(report.generated_at)}{report.fallback ? ' · plan chosen automatically from your weakest topics' : ''}</p>
        </div>
        {list.length > 1 ? (
          <select className="rp-picker" value={report.id} onChange={(e) => { window.location.assign(`/dashboard/analytics/report/${e.target.value}`) }} aria-label="Choose a report">
            {list.filter((r) => r.status === 'generated').map((r) => <option key={r.id} value={r.id}>{r.headline || r.period_start}</option>)}
          </select>
        ) : null}
      </div>

      <div className="an-row an-row--21">
        <div className="an-card">
          <h2 className="an-card__title">This month</h2>
          <p className="rp-body">{report.summary}</p>
          {report.last_month_review ? (<><h2 className="an-card__title rp-h2">How last month's plan went</h2><p className="rp-body">{report.last_month_review}</p></>) : null}
        </div>
        <div className="an-card an-ai">
          <p className="an-eyebrow an-ai__eyebrow">Your plan</p>
          <h2 className="an-card__title">{done} of {plan.length} steps done</h2>
          <div className="an-ai__prog"><i style={{ width: `${pct}%` }} /></div>
          <p className="an-card__sub an-ai__sub">Progress updates automatically as you practise and read.</p>
        </div>
      </div>

      <div className="an-row">
        <div className="an-card">
          <h2 className="an-card__title">Study plan</h2>
          <p className="an-card__sub">Work through these in order</p>
          {plan.map((p, i) => (
            <div key={p.id} className={`rp-step ${p.done ? 'is-done' : ''}`}>
              <div className="rp-step__n">{p.done ? '✓' : i + 1}</div>
              <div className="rp-step__body">
                <b>{p.kind === 'read_topic' ? `Read ${p.topic.name}` : `Answer ${p.target_count} questions on ${p.topic.name}`}</b>
                <span>{p.rationale}</span>
                {p.kind === 'practice_topic' ? (
                  <div className="rp-step__bar"><i style={{ width: `${p.target_count ? Math.min(100, Math.round((p.progress / p.target_count) * 100)) : 0}%` }} /><em>{p.progress} / {p.target_count}</em></div>
                ) : null}
              </div>
              {p.done ? null : p.kind === 'read_topic'
                ? <Link className="an-btn an-btn--ghost" to={textbookLink(p.topic.slug)}>Read</Link>
                : <Link className="an-btn an-btn--ghost" to={practiceLink({ specialty_id: p.topic.specialty_id, specialty_name: p.topic.specialty_name, topic_id: p.topic.id, name: p.topic.name }, Math.max(1, (p.target_count || 20) - p.progress))}>Practise</Link>}
            </div>
          ))}
        </div>
      </div>

      <div className="an-row an-row--11">
        <div className="an-card">
          <h2 className="an-card__title">Weaknesses</h2>
          {report.weaknesses.length ? report.weaknesses.map((w) => <p key={w.topic_id} className="rp-note"><b>{w.name}</b> — {w.comment}</p>) : <p className="an-note">None flagged.</p>}
        </div>
        <div className="an-card">
          <h2 className="an-card__title">Strengths</h2>
          {report.strengths.length ? report.strengths.map((s) => <p key={s.topic_id} className="rp-note"><b>{s.name}</b> — {s.comment}</p>) : <p className="an-note">Keep going and these will fill in.</p>}
        </div>
      </div>
    </div>
  )
}
