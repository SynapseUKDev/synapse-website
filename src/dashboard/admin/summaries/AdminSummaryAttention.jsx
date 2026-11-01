import React, { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { canManageQbank } from '../questions/questionAdminAccess'
import { ATTENTION_STATE_LABELS, CATEGORY_LABELS, SUMMARIES_PAGE_PATH, listAttention } from './summaryAdminApi'
import './AdminSummaries.css'

const PAGE_SIZE = 25
const STATES = [
  ['open', 'Needs attention'],
  ['draft', 'Drafts'],
  ['awaiting_content', 'Awaiting content'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['all', 'All'],
]
const SEARCH_DELAY_MS = 300

function formatDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''
}

/** Summary review → Needs attention: summaries from condition CSV uploads that staff must review. */
export default function AdminSummaryAttention() {
  const { user } = useOutletContext()
  const [state, setState] = useState('open')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const allowed = canManageQbank(user)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(search.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!allowed) return undefined
    const controller = new AbortController()
    setError(null)
    listAttention({ state, q, page, page_size: PAGE_SIZE }, { signal: controller.signal })
      .then(setResult)
      .catch((e) => e?.name !== 'AbortError' && setError(e.message))
    return () => controller.abort()
  }, [allowed, state, q, page])

  if (!allowed) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Summary review</h1>
          <p className="admin__muted">Question-bank admin permission is required.</p>
        </div>
      </div>
    )
  }

  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  const counts = result?.counts || {}
  const openCount = (counts.draft || 0) + (counts.awaiting_content || 0)
  return (
    <div className="admin asum">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Summaries
          </Link>
          <h1 className="admin__title">Summary review: needs attention</h1>
          <p className="admin__muted">
            Summaries from condition CSV uploads that did not pass the generator&apos;s checks. Drafts stay hidden from
            students until you approve them, and the question keeps showing its current summary meanwhile.
          </p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      <div className="asum-card asum-filters">
        <div className="asum-segmented" role="group" aria-label="Review state">
          {STATES.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={state === value}
              onClick={() => {
                setState(value)
                setPage(1)
              }}
            >
              {label}
              {value === 'open' && openCount > 0 && ` (${openCount})`}
            </button>
          ))}
        </div>
        <label className="asum-field asum-search">
          Condition or question ID
          <input type="search" value={search} placeholder="e.g. COPD" onChange={(e) => setSearch(e.target.value)} />
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
                  <th scope="col">State</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Category</th>
                  <th scope="col">Draft</th>
                  <th scope="col">Why</th>
                  <th scope="col">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className={`asum-status asum-status--${item.state === 'approved' ? 'published' : item.state === 'rejected' ? 'archived' : 'draft'}`}>
                        {ATTENTION_STATE_LABELS[item.state] || item.state}
                      </span>
                    </td>
                    <td>{item.condition_name}</td>
                    <td>{CATEGORY_LABELS[item.question_category] || item.question_category || '—'}</td>
                    <td>
                      <Link className="asum-table__subject" to={`${SUMMARIES_PAGE_PATH}/attention/${item.id}`}>
                        {item.draft_title || (item.target_label ? `${item.target_label} (no text yet)` : 'Open item')}
                      </Link>
                    </td>
                    <td>{item.reason?.length > 160 ? `${item.reason.slice(0, 160)}…` : item.reason}</td>
                    <td>{formatDate(item.created_at)}</td>
                  </tr>
                ))}
                {result.items.length === 0 && (
                  <tr><td colSpan={6} className="asum-table__empty">Nothing here for this filter.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="asum-pager" aria-label="Review pages">
            <button type="button" className="asum-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="asum-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </nav>
        </>
      )}
    </div>
  )
}
