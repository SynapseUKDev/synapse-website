import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { listReports, resolveAllReports, resolveReport } from './flashcardsV2AdminApi'
import { plural } from './reviewModel'
import { REPORT_CATEGORIES } from '../../flashcards-v2/reportCategories'

/**
 * Learner report queue (plan 9.1/9.2, R44/R56). Newest first, filterable by status, paged by the
 * server's opaque cursor. Each row: card excerpt, category, details, the reported version (with a
 * stale marker when the card has changed since), the distinct serious-reporter count (never who),
 * the AI reassessment (verdict, reason, suggested correction) or its job state, and a hidden badge.
 * Undecided reports can be resolved or dismissed (optionally unhiding the card), one at a time or
 * all of the card version's undecided reports at once.
 */

const CATEGORY_LABEL = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c.value, c.label]))

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'reassessing', label: 'Awaiting AI reassessment' },
  { value: 'confirmed', label: 'AI-confirmed error' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]))
const UNDECIDED = new Set(['open', 'reassessing', 'confirmed'])

const HIDDEN_LABEL = {
  reports_threshold: 'two learners reported a serious problem with this version',
  ai_confirmed_error: 'AI-confirmed material error',
}

const VERDICT_LABEL = { material_error: 'Material error', no_error: 'No error found', uncertain: 'Uncertain' }

const errorText = (e) => `${e?.message || 'Request failed'}${e?.code ? ` (${e.code})` : ''}`
const when = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : ''
}

function Reassessment({ report }) {
  const r = report.reassessment
  if (r) {
    const c = r.correction
    return (
      <div className="fcv2a-report__ai">
        <p>
          <strong>AI reassessment: </strong>
          <span className={`fcv2a-verdict__tag--${r.verdict === 'material_error' ? 'reject' : r.verdict === 'no_error' ? 'pass' : 'revise'}`}>
            {VERDICT_LABEL[r.verdict] ?? r.verdict}
          </span>
        </p>
        {r.reason && <p className="fcv2a-report__reason">{r.reason}</p>}
        {(c?.question || c?.answerMarkdown || r.suggestedCorrection) && (
          <div>
            <p className="fcv2a-diag__title">Suggested correction</p>
            {c?.question || c?.answerMarkdown ? (
              <>
                {c.question && <pre className="fcv2a-suggestion">{c.question}</pre>}
                {c.answerMarkdown && <pre className="fcv2a-suggestion">{c.answerMarkdown}</pre>}
              </>
            ) : (
              <pre className="fcv2a-suggestion">{r.suggestedCorrection}</pre>
            )}
          </div>
        )}
      </div>
    )
  }
  if (report.status !== 'reassessing') return null
  const job = report.reassessmentJob
  if (job && (job.status === 'queued' || job.status === 'running')) {
    return <p className="fcv2a-muted">{`AI reassessment in progress (attempt ${job.attempts || 1} of 3)…`}</p>
  }
  if (job?.status === 'succeeded') {
    // The handler skips a report whose card changed since (or that was decided meanwhile).
    return <p className="fcv2a-text-warn">AI reassessment skipped: the card changed after this report — decide this report yourself.</p>
  }
  const why = job ? `${job.error ? `: ${job.error}` : ''} after ${plural(job.attempts ?? 0, 'attempt')}` : ': no reassessment job was found'
  return <p className="fcv2a-text-warn">{`AI reassessment failed${why} — decide this report yourself.`}</p>
}

function ReportRow({ report, onOpenCard, onChanged }) {
  const [note, setNote] = useState('')
  const [unhide, setUnhide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const noteId = useId()
  const hidden = !!report.hiddenReason
  // Unhide is version-scoped: only a report on the card's CURRENT version may unhide it (backend: 409 otherwise).
  const canUnhide = hidden && report.isCurrentVersion
  const undecided = UNDECIDED.has(report.status)

  async function act(fn, message) {
    setBusy(true)
    setError(null)
    try {
      const result = await fn()
      setUnhide(false)
      onChanged(message(result ?? {}))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const unhiddenText = (r) => (r.unhidden ? '; the card is no longer hidden — publish the topic again from its review to show it to learners' : '')
  const resolveOne = (status) =>
    act(
      () => resolveReport(report.reportId, { status, note, unhide: canUnhide && unhide }),
      (r) => `Report ${status}${unhiddenText(r)}.`,
    )
  const resolveAll = () =>
    act(
      () => resolveAllReports(report.cardId, { contentVersion: report.reportVersion, status: 'resolved', note, unhide: canUnhide && unhide }),
      (r) => `Resolved ${plural(r.resolvedReportIds?.length ?? 0, 'report')} on version ${report.reportVersion}${unhiddenText(r)}.`,
    )

  return (
    <article aria-label={`Report ${report.reportId}`} className={`fcv2a-report${hidden ? ' fcv2a-report--hidden' : ''}`}>
      <header className="fcv2a-report__head">
        <strong>{report.topicName}</strong>
        <code className="fcv2a-card__key">{report.semanticKey}</code>
        <span className="fcv2a-tag">{CATEGORY_LABEL[report.category] ?? report.category}</span>
        <span className={`fcv2a-tag fcv2a-tag--status-${report.status}`}>{STATUS_LABEL[report.status] ?? report.status}</span>
        {hidden && (
          <span className="fcv2a-tag fcv2a-tag--hidden">{`Hidden from learners — ${HIDDEN_LABEL[report.hiddenReason] ?? report.hiddenReason}`}</span>
        )}
      </header>

      <p className="fcv2a-report__excerpt">{report.questionExcerpt}</p>
      {report.details ? <blockquote className="fcv2a-report__details">{report.details}</blockquote> : <p className="fcv2a-muted">No details given.</p>}

      <dl className="fcv2a-dl">
        <dt>Version</dt>
        <dd>
          {`Reported on v${report.reportVersion}`}
          {!report.isCurrentVersion && (
            <span className="fcv2a-tag fcv2a-tag--legacy fcv2a-report__stale">{`Stale: reported v${report.reportVersion}, card is now v${report.currentVersion}`}</span>
          )}
          {!report.isActive && <span className="fcv2a-tag fcv2a-tag--legacy">Card retired</span>}
        </dd>
        <dt>Serious reports</dt>
        <dd>{`${report.seriousReporters} distinct ${report.seriousReporters === 1 ? 'learner' : 'learners'} on the current version`}</dd>
        <dt>Received</dt>
        <dd>{when(report.createdAt)}</dd>
      </dl>

      <Reassessment report={report} />

      <div className="fcv2a-row">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => onOpenCard?.({ topicId: report.topicId, topicName: report.topicName, cardId: report.cardId })}>
          Open card in review
        </button>
      </div>

      {undecided ? (
        <div className="fcv2a-report__actions">
          <label htmlFor={noteId} className="fcv2a-label">
            Resolution note
          </label>
          <textarea id={noteId} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          {canUnhide && (
            <label className="fcv2a-check">
              <input type="checkbox" checked={unhide} onChange={(e) => setUnhide(e.target.checked)} />
              Unhide the card (it still has to be published again)
            </label>
          )}
          <div className="fcv2a-row">
            <button type="button" className="admin-btn-issue" disabled={busy} onClick={() => resolveOne('resolved')}>
              Resolve
            </button>
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" disabled={busy} onClick={() => resolveOne('dismissed')}>
              Dismiss
            </button>
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" disabled={busy} onClick={resolveAll}>
              Resolve all for this version
            </button>
          </div>
          {error && (
            <div role="alert" className="admin-alert">
              {errorText(error)}
            </div>
          )}
        </div>
      ) : (
        <p className="fcv2a-muted">
          {`${STATUS_LABEL[report.status] ?? report.status}${report.resolvedAt ? ` on ${when(report.resolvedAt)}` : ''}${report.resolutionNote ? `: ${report.resolutionNote}` : ''}`}
        </p>
      )}
    </article>
  )
}

export default function ReportsQueue({ onOpenCard }) {
  const [status, setStatus] = useState('')
  const [reports, setReports] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState('')
  const requestRef = useRef(0)
  const statusId = useId()

  const load = useCallback(
    async ({ cursor } = {}) => {
      const n = ++requestRef.current
      setLoading(true)
      try {
        const res = await listReports({ status, cursor })
        if (n !== requestRef.current) return
        const page = Array.isArray(res?.reports) ? res.reports : []
        setReports((prev) => (cursor ? [...prev, ...page] : page))
        setNextCursor(res?.nextCursor ?? null)
        setError(null)
      } catch (e) {
        if (n !== requestRef.current) return
        setError(e)
      } finally {
        if (n === requestRef.current) setLoading(false)
      }
    },
    [status],
  )

  useEffect(() => {
    load()
  }, [load])

  const changed = (message) => {
    setNotice(message)
    load()
  }

  return (
    <section aria-label="Learner reports" className="fcv2a-reports">
      <div className="fcv2a-row fcv2a-row--between">
        <h2 className="fcv2a-review__title">Learner reports</h2>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => load()} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <div className="fcv2a-row">
        <label htmlFor={statusId} className="fcv2a-label">
          Report status
        </label>
        <select id={statusId} value={status} onChange={(e) => setStatus(e.target.value)} className="fcv2a-reports__filter">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value || 'all'} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div role="status" aria-live="polite" className="fcv2a-notice">
        {notice}
      </div>
      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}
      {!loading && !error && reports.length === 0 && <p className="fcv2a-muted">No reports match this filter.</p>}
      <ul className="fcv2a-cards">
        {reports.map((r) => (
          <li key={r.reportId}>
            <ReportRow report={r} onOpenCard={onOpenCard} onChanged={changed} />
          </li>
        ))}
      </ul>
      {nextCursor && (
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => load({ cursor: nextCursor })} disabled={loading}>
          Load more
        </button>
      )}
    </section>
  )
}
