import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LuPlus } from 'react-icons/lu'
import QuestionStatusBadge from './QuestionStatusBadge'
import TopicCombobox from './TopicCombobox'
import { ADMIN_QUESTIONS_PATH } from './questionAdminAccess'
import { fetchTaxonomy, listQuestions } from './questionAdminApi'
import './AdminQuestions.css'

const PAGE_SIZE = 25
const FILTER_STORAGE_KEY = 'admin_question_manager_filters'
const DEFAULT_FILTERS = { q: '', specialty_id: '', topic_id: '', status: 'all', offset: 0 }

function readStoredFilters() {
  try {
    const stored = JSON.parse(sessionStorage.getItem(FILTER_STORAGE_KEY) || 'null')
    return stored ? { ...DEFAULT_FILTERS, ...stored } : DEFAULT_FILTERS
  } catch {
    return DEFAULT_FILTERS
  }
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

/** Searchable, filterable, paginated list of question-bank questions. */
export default function AdminQuestionManager() {
  const [filters, setFilters] = useState(readStoredFilters)
  const [searchText, setSearchText] = useState(filters.q)
  const debouncedSearch = useDebounced(searchText, 300)
  const [taxonomy, setTaxonomy] = useState([])
  const [result, setResult] = useState({ questions: [], total: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const updateFilters = (patch) => setFilters((current) => ({ ...current, offset: 0, ...patch }))

  useEffect(() => {
    setFilters((current) => (current.q === debouncedSearch ? current : { ...current, q: debouncedSearch, offset: 0 }))
  }, [debouncedSearch])

  useEffect(() => {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters))
    } catch {
      // storage unavailable: filters simply won't persist
    }
  }, [filters])

  useEffect(() => {
    fetchTaxonomy()
      .then((data) => setTaxonomy(data?.specialties || []))
      .catch(() => setTaxonomy([]))
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    listQuestions(
      {
        q: filters.q.trim() || undefined,
        specialty_id: filters.specialty_id || undefined,
        topic_id: filters.topic_id || undefined,
        status: filters.status,
        limit: PAGE_SIZE,
        offset: filters.offset,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        setResult({ questions: data.questions || [], total: data.total || 0 })
        setLoading(false)
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setError(err)
        setLoading(false)
      })
    return () => controller.abort()
  }, [filters])

  const filteredTaxonomy = useMemo(
    () => (filters.specialty_id ? taxonomy.filter((specialty) => specialty.id === filters.specialty_id) : taxonomy),
    [taxonomy, filters.specialty_id],
  )

  const { questions, total } = result
  const firstShown = total === 0 ? 0 : filters.offset + 1
  const lastShown = Math.min(filters.offset + questions.length, total)

  return (
    <section className="aqm" aria-label="Questions">
      <div className="aqm__toolbar">
        <label className="aqm__search">
          <span className="aqf-visually-hidden">Search question stems</span>
          <input
            type="search"
            placeholder="Search question stems…"
            value={searchText}
            maxLength={200}
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>
        <Link className="aqe-button" to={`${ADMIN_QUESTIONS_PATH}/new`}>
          <LuPlus aria-hidden /> New question
        </Link>
      </div>

      <div className="aqm__filters">
        <label>
          Specialty
          <select
            value={filters.specialty_id}
            onChange={(event) => updateFilters({ specialty_id: event.target.value, topic_id: '' })}
          >
            <option value="">All specialties</option>
            {taxonomy.map((specialty) => (
              <option key={specialty.id} value={specialty.id}>
                {specialty.name}
              </option>
            ))}
          </select>
        </label>
        <div className="aqm__filter">
          <label htmlFor="aqm-topic">Topic</label>
          <TopicCombobox
            id="aqm-topic"
            taxonomy={filteredTaxonomy}
            value={filters.topic_id}
            onChange={(topicId) => updateFilters({ topic_id: topicId })}
            placeholder="All topics"
            clearLabel="show all topics"
          />
        </div>
        <label>
          Status
          <select value={filters.status} onChange={(event) => updateFilters({ status: event.target.value })}>
            <option value="all">All</option>
            <option value="inactive">Inactive drafts</option>
            <option value="active">Active</option>
          </select>
        </label>
      </div>

      {error && (
        <div className="admin-alert" role="alert">
          {error.message}
        </div>
      )}

      <p className="admin__muted" role="status" aria-live="polite">
        {loading ? 'Loading questions…' : `Showing ${firstShown}–${lastShown} of ${total} questions`}
      </p>

      <div className="admin-table-wrap">
        <table className="admin-table aqm__table">
          <thead>
            <tr>
              <th scope="col">Question</th>
              <th scope="col">Topic</th>
              <th scope="col">Difficulty</th>
              <th scope="col">Status</th>
              <th scope="col">Images</th>
              <th scope="col">Updated</th>
              <th scope="col">
                <span className="aqf-visually-hidden">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!loading && questions.length === 0 && (
              <tr>
                <td colSpan={7} className="admin__muted">
                  No questions match these filters.
                </td>
              </tr>
            )}
            {questions.map((question, index) => (
              <tr key={question.id} className={`aqm__row ${index % 2 === 1 ? 'is-striped' : ''}`}>
                <td className="aqm__stem">
                  <div className="aqm__stem-text">{question.stem}</div>
                </td>
                <td>
                  <div className="aqm__topic">{question.topic?.name || '—'}</div>
                  <small className="admin__muted">{question.topic?.specialty?.name || ''}</small>
                </td>
                <td>{question.difficulty || 'Not set'}</td>
                <td>
                  <QuestionStatusBadge active={question.is_active} draftLabel="Inactive" />
                </td>
                <td>{question.has_image ? 'Yes' : 'No'}</td>
                <td>
                  {formatDate(question.updated_at)}
                  <small className="admin__muted"> · v{question.version}</small>
                </td>
                <td>
                  <Link className="aqm__edit" to={`${ADMIN_QUESTIONS_PATH}/${question.id}`}>
                    {question.is_active ? 'View' : 'Edit'}
                    <span className="aqf-visually-hidden"> question: {question.stem.slice(0, 60)}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="aqm__pager">
        <button
          type="button"
          className="aqe-button aqe-button--ghost"
          disabled={loading || filters.offset === 0}
          onClick={() => setFilters((current) => ({ ...current, offset: Math.max(0, current.offset - PAGE_SIZE) }))}
        >
          Previous
        </button>
        <button
          type="button"
          className="aqe-button aqe-button--ghost"
          disabled={loading || filters.offset + PAGE_SIZE >= total}
          onClick={() => setFilters((current) => ({ ...current, offset: current.offset + PAGE_SIZE }))}
        >
          Next
        </button>
      </div>
    </section>
  )
}
