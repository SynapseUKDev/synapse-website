import React, { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, SUMMARIES_PAGE_PATH, deleteSummary, fetchCoverage, listSummaries } from './summaryAdminApi'
import SummaryStatusBadge, { ValidationBadge } from './SummaryStatusBadge'
import { cache, dropFromSummariesCache, listKey } from './summariesListCache'
import './AdminSummaries.css'

const PAGE_SIZE = 25
const KINDS = [['', 'All'], ['condition', 'Condition'], ['drug', 'Drug']]
const DEFAULT_FILTERS = { kind: '', status: '', category: '', validation: '', q: '' }

function CoverageStrip({ coverage, error }) {
  if (error) return <p className="asum-error" role="alert">{error}</p>
  if (!coverage) return <p className="asum-results">Loading coverage…</p>
  const items = [
    ['Active questions', coverage.active_questions],
    ['Categorised', coverage.with_category],
    ['Linked', coverage.linked],
    ['Showing a summary', coverage.linked_published],
    ['No category', coverage.no_category, true],
    ['Not linked', coverage.no_link, true],
    ['Linked, unpublished', coverage.linked_unpublished, true],
    ['Source blocked', coverage.source_blocked, true],
  ]
  const unresolved = Object.values(coverage.unresolved_by_reason || {}).reduce((a, b) => a + b, 0)
  return (
    <section className="asum-coverage" aria-label="Summary coverage">
      <dl>
        {items.map(([label, value, attention]) => (
          <div key={label} className={`asum-coverage__item ${attention && value > 0 ? 'asum-coverage__item--attention' : ''}`}>
            <dt>{label}</dt>
            <dd>{(value ?? 0).toLocaleString('en-GB')}</dd>
          </div>
        ))}
      </dl>
      <p className="asum-coverage__note">
        Unresolved queue (latest run per reason): {unresolved.toLocaleString('en-GB')} item(s).{' '}
        <Link to={`${SUMMARIES_PAGE_PATH}/queue`}>Open the unresolved queue</Link>
      </p>
    </section>
  )
}

/** QBank → Summaries: coverage strip plus a filterable, paginated list of summaries. */
export default function AdminSummaries() {
  const [filters, setFilters] = useState(() => cache.view?.filters || DEFAULT_FILTERS)
  const [search, setSearch] = useState(() => cache.view?.search || '')
  const [page, setPage] = useState(() => cache.view?.page || 1)
  const [result, setResult] = useState(() => cache.lists.get(listKey(filters, page)) || null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [coverage, setCoverage] = useState(cache.coverage)
  const [coverageError, setCoverageError] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    cache.view = { filters, search, page }
  }, [filters, search, page])

  useEffect(() => {
    const controller = new AbortController()
    fetchCoverage({ signal: controller.signal })
      .then((data) => {
        cache.coverage = data
        setCoverage(data)
        setCoverageError(null)
      })
      .catch((e) => e?.name !== 'AbortError' && !cache.coverage && setCoverageError(e.message))
    return () => controller.abort()
  }, [])

  const load = useCallback(
    (signal) => {
      const key = listKey(filters, page)
      const cached = cache.lists.get(key)
      if (cached) setResult(cached) // shown at once; refreshed below
      setLoading(true)
      setError(null)
      listSummaries({ ...filters, page, page_size: PAGE_SIZE }, { signal })
        .then((data) => {
          cache.lists.set(key, data)
          setResult(data)
        })
        .catch((e) => e?.name !== 'AbortError' && setError(e.message))
        .finally(() => !signal?.aborted && setLoading(false))
    },
    [filters, page],
  )

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const setFilter = (name, value) => {
    setFilters((current) => ({ ...current, [name]: value }))
    setPage(1)
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1

  async function remove(summary) {
    const label = `${summary.subject_label} — ${CATEGORY_LABELS[summary.question_category] || summary.question_category}`
    if (!window.confirm(`Delete "${label}" permanently, with all its versions? This cannot be undone.`)) return
    setDeleting(summary.id)
    setError(null)
    try {
      await deleteSummary(summary.id, summary.row_version)
      dropFromSummariesCache(summary.id)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="asum">
      <CoverageStrip coverage={coverage} error={coverageError} />

      <form
        className="asum-card asum-filters"
        aria-label="Filter summaries"
        onSubmit={(event) => {
          event.preventDefault()
          setFilter('q', search.trim())
        }}
      >
        <div className="asum-field">
          <span id="asum-kind-label">Kind</span>
          <div className="asum-segmented" role="group" aria-labelledby="asum-kind-label">
            {KINDS.map(([value, label]) => (
              <button key={label} type="button" aria-pressed={filters.kind === value} onClick={() => setFilter('kind', value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <label className="asum-field">
          Status
          <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Any</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Withdrawn</option>
          </select>
        </label>
        <label className="asum-field">
          Category
          <select value={filters.category} onChange={(e) => setFilter('category', e.target.value)}>
            <option value="">Any</option>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="asum-field">
          Has a version that
          <select value={filters.validation} onChange={(e) => setFilter('validation', e.target.value)}>
            <option value="">Any</option>
            <option value="passed">passed</option>
            <option value="needs_review">needs review</option>
            <option value="failed">failed</option>
          </select>
        </label>
        <div className="asum-field">
          <label htmlFor="asum-subject-search">Subject</label>
          <div className="asum-search">
            <input
              id="asum-subject-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Topic or drug name"
            />
            <button type="submit" className="asum-button">Search</button>
          </div>
        </div>
      </form>

      {error && <p className="asum-error" role="alert">{error}</p>}
      {loading && !result && <p className="asum-results">Loading summaries…</p>}
      {result && (
        <>
          <p className="asum-results" aria-live="polite">
            {result.total.toLocaleString('en-GB')} summar{result.total === 1 ? 'y' : 'ies'}
            {loading && <span className="asum-muted"> · Updating…</span>}
          </p>
          <div className="asum-table-wrap">
            <table className="asum-table">
              <thead>
                <tr>
                  <th scope="col">Subject</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Category</th>
                  <th scope="col">Scope</th>
                  <th scope="col">Status</th>
                  <th scope="col">Latest version</th>
                  <th scope="col" className="asum-num">Linked</th>
                  <th scope="col" className="asum-num">Open reports</th>
                  <th scope="col"><span className="asum-sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.summaries.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link className="asum-table__subject" to={`${SUMMARIES_PAGE_PATH}/${s.id}`}>{s.subject_label}</Link>
                    </td>
                    <td>{s.kind === 'drug' ? 'Drug' : 'Condition'}</td>
                    <td>{CATEGORY_LABELS[s.question_category] || s.question_category}</td>
                    <td>{s.scope_label}</td>
                    <td><SummaryStatusBadge status={s.status} /></td>
                    <td>
                      {s.latest_version
                        ? <ValidationBadge status={s.latest_version.validation_status} prefix={`v${s.latest_version.version} · `} />
                        : 'None'}
                    </td>
                    <td className="asum-num">
                      {s.linked_questions}
                      {s.manual_questions > 0 && <span className="asum-muted"> +{s.manual_questions} manual</span>}
                    </td>
                    <td className="asum-num">{s.open_reports}</td>
                    <td>
                      <button
                        type="button"
                        className="asum-button asum-button--small"
                        disabled={deleting === s.id}
                        aria-label={`Delete ${s.subject_label} ${CATEGORY_LABELS[s.question_category] || s.question_category}`}
                        onClick={() => remove(s)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {result.summaries.length === 0 && (
                  <tr>
                    <td colSpan={9} className="asum-table__empty">No summaries match these filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav className="asum-pager" aria-label="Summary pages">
            <button type="button" className="asum-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </button>
            <span>Page {page} of {totalPages}</span>
            <button type="button" className="asum-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              Next
            </button>
          </nav>
        </>
      )}
    </div>
  )
}
