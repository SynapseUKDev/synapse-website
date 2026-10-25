import React, { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { canManageQbank } from '../questions/questionAdminAccess'
import { CATEGORY_LABELS, REASON_LABELS, fetchQueue } from './summaryAdminApi'
import './AdminSummaries.css'

const PAGE_SIZE = 50

/** Unresolved items uploaded from script runs (learning_summary_queue), filtered by reason. */
export default function AdminSummaryQueue() {
  const { user } = useOutletContext()
  const [reason, setReason] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const allowed = canManageQbank(user)

  useEffect(() => {
    if (!allowed) return undefined
    const controller = new AbortController()
    setError(null)
    fetchQueue({ reason, page, page_size: PAGE_SIZE }, { signal: controller.signal })
      .then(setResult)
      .catch((e) => e?.name !== 'AbortError' && setError(e.message))
    return () => controller.abort()
  }, [allowed, reason, page])

  if (!allowed) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Unresolved queue</h1>
          <p className="admin__muted">Question-bank admin permission is required.</p>
        </div>
      </div>
    )
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  return (
    <div className="admin asum">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Summaries
          </Link>
          <h1 className="admin__title">Unresolved summary queue</h1>
          <p className="admin__muted">
            Questions and groups the scripts could not classify, scope, source or validate. Fix the question or
            textbook, then re-run the scripts.
          </p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      <div className="asum-card asum-filters">
        <label className="asum-field">
          Reason
          <select
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setPage(1)
            }}
          >
            <option value="">Any</option>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>

      {error && <p className="asum-error" role="alert">{error}</p>}
      {result && (
        <>
          <p className="asum-results" aria-live="polite">{result.total.toLocaleString('en-GB')} item(s)</p>
          <div className="asum-table-wrap">
            <table className="asum-table">
              <thead>
                <tr>
                  <th scope="col">Reason</th>
                  <th scope="col">Item</th>
                  <th scope="col">Category</th>
                  <th scope="col">Detail</th>
                  <th scope="col">Run</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={`${item.generation_run_id}|${item.item_key}|${item.reason_code}`}>
                    <td>{REASON_LABELS[item.reason_code] || item.reason_code}</td>
                    <td>
                      {item.question_id ? (
                        <Link to={`/dashboard/admin/questions/${item.question_id}`}>Question {item.question_id.slice(0, 8)}</Link>
                      ) : (
                        <span>{item.item_key}</span>
                      )}
                    </td>
                    <td>{CATEGORY_LABELS[item.question_category] || item.question_category || ''}</td>
                    <td>{item.detail}</td>
                    <td>{item.generation_run_id}</td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr><td colSpan={5} className="asum-table__empty">Nothing unresolved for this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="asum-pager" aria-label="Queue pages">
            <button type="button" className="asum-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="asum-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </nav>
        </>
      )}
    </div>
  )
}
