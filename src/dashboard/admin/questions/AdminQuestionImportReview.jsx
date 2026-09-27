import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { useUnsavedChangesGuard } from '../../navigationGuard'
import QuestionPreview from './QuestionPreview'
import { ADMIN_QUESTIONS_PATH, canManageQbank } from './questionAdminAccess'
import { confirmImportBatch, fetchImportBatch, fetchTaxonomyCached } from './questionAdminApi'
import {
  OUTCOME_LABELS,
  decisionProblems,
  hasDuplicateWarning,
  initialDecisions,
  isInvalid,
  selectedCount,
  setAcknowledged,
  setDecision,
  toConfirmDecisions,
} from './importReviewModel'
import '../Admin.css'
import './AdminQuestions.css'

const PAGE_SIZE = 25
const FILTERS = [
  ['', 'All records'],
  ['pending', 'Ready'],
  ['invalid', 'Invalid'],
  ['created', 'Created'],
  ['failed', 'Failed'],
  ['skipped', 'Excluded'],
]

function recordStem(record) {
  return record.normalized_payload?.stem || record.source_payload?.stem || '(no question stem)'
}

function IssueList({ items, tone }) {
  if (!items?.length) return null
  return (
    <ul className={`aqi-issues aqi-issues--${tone}`}>
      {items.map((item, idx) => (
        <li key={`${item.field}-${idx}`}>
          <strong>{tone === 'error' ? 'Error' : 'Warning'}</strong>
          {item.field && item.field !== 'record' ? ` (${item.field})` : ''}: {item.message}
        </li>
      ))}
    </ul>
  )
}

function Counts({ batch, selected, editable }) {
  const items = [
    ['Total', batch.total_count],
    ['Valid', batch.valid_count],
    ['Invalid', batch.invalid_count],
    ['With warnings', batch.warning_count],
    ['Likely duplicates', batch.duplicate_count],
    ['Selected', editable ? selected : batch.selected_count],
  ]
  if (!editable) items.push(['Created', batch.created_count], ['Failed', batch.failed_count])
  return (
    <dl className="aqi-counts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function RecordCard({ record, state, editable, topicLabel, onDecision, onAcknowledge }) {
  const number = record.source_index + 1
  const invalid = isInvalid(record)
  const duplicate = hasDuplicateWarning(record)
  const outcome = editable && !invalid ? (state?.decision === 'exclude' ? 'Excluded' : state?.decision === 'include' ? 'Will import' : 'Needs decision') : OUTCOME_LABELS[record.outcome]

  return (
    <article className={`aqi-record ${invalid ? 'is-invalid' : ''}`} aria-labelledby={`aqi-rec-${record.id}`}>
      <header className="aqi-record__head">
        <h3 id={`aqi-rec-${record.id}`}>Record {number}</h3>
        <span className={`aqi-outcome aqi-outcome--${invalid ? 'invalid' : record.outcome}`}>{outcome}</span>
        {topicLabel && <span className="admin__muted">{topicLabel}</span>}
      </header>
      <p className="aqi-record__stem">{recordStem(record)}</p>
      <IssueList items={record.validation_errors} tone="error" />
      <IssueList items={record.warnings} tone="warning" />

      {editable && !invalid && (
        <fieldset className="aqi-decision">
          <legend className="aqf-visually-hidden">Decision for record {number}</legend>
          <label>
            <input
              type="radio"
              name={`decision-${record.id}`}
              checked={state?.decision === 'include'}
              onChange={() => onDecision(record.id, 'include')}
            />
            Include
          </label>
          <label>
            <input
              type="radio"
              name={`decision-${record.id}`}
              checked={state?.decision === 'exclude'}
              onChange={() => onDecision(record.id, 'exclude')}
            />
            Exclude
          </label>
          {duplicate && state?.decision === 'include' && (
            <label className="aqi-decision__ack">
              <input type="checkbox" checked={!!state?.acknowledge} onChange={(event) => onAcknowledge(record.id, event.target.checked)} />
              I have checked this is not an unwanted duplicate
            </label>
          )}
        </fieldset>
      )}
      {editable && invalid && <p className="admin__muted">Invalid records cannot be imported. Fix the file and upload it again.</p>}

      {!editable && record.failure_message && <p className="aqf-error">{record.failure_message}</p>}
      {!editable && record.created_question_id && (
        <Link className="aqm__edit" to={`${ADMIN_QUESTIONS_PATH}/${record.created_question_id}`}>
          Open created question
        </Link>
      )}

      {record.normalized_payload && (
        <details className="aqi-record__preview">
          <summary>Preview as learner</summary>
          <QuestionPreview question={record.normalized_payload} />
        </details>
      )}
    </article>
  )
}

function ImportReview({ batchId }) {
  const [batch, setBatch] = useState(null)
  const [summary, setSummary] = useState([])
  const [decisions, setDecisions] = useState({})
  const [page, setPage] = useState({ records: [], total: 0, offset: 0 })
  const [filter, setFilter] = useState('')
  const [topics, setTopics] = useState({})
  const [loadError, setLoadError] = useState(null)
  const [working, setWorking] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [notice, setNotice] = useState(null)

  const loadSummary = useCallback(async () => {
    const data = await fetchImportBatch(batchId, { view: 'summary', limit: 500 })
    setBatch(data.batch)
    setSummary(data.records)
    setDecisions(initialDecisions(data.records, data.batch.status))
    return data.batch
  }, [batchId])

  const loadPage = useCallback(
    async (offset, outcome) => {
      const data = await fetchImportBatch(batchId, { limit: PAGE_SIZE, offset, outcome: outcome || undefined })
      setPage({ records: data.records, total: data.total_records, offset })
    },
    [batchId],
  )

  useEffect(() => {
    let cancelled = false
    Promise.all([loadSummary(), loadPage(0, '')]).catch((error) => !cancelled && setLoadError(error))
    fetchTaxonomyCached()
      .then((data) => {
        const map = {}
        for (const specialty of data?.specialties || []) {
          for (const topic of specialty.topics) map[topic.id] = `${specialty.name} › ${topic.name}`
        }
        if (!cancelled) setTopics(map)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [loadSummary, loadPage])

  const editable = batch?.status === 'validated'
  useUnsavedChangesGuard(
    editable,
    'This import has not been confirmed. The validated file stays under Bulk import → Recent imports, but your include/exclude choices on this page will be lost. Leave anyway?',
  )

  const problems = useMemo(() => decisionProblems(summary, decisions), [summary, decisions])
  const selected = useMemo(() => selectedCount(summary, decisions), [summary, decisions])

  const changeFilter = (value) => {
    setFilter(value)
    loadPage(0, value).catch(setLoadError)
  }

  const run = async (decisionList) => {
    setWorking(true)
    setNotice(null)
    try {
      const data = await confirmImportBatch(batchId, decisionList)
      setBatch(data.batch)
      await Promise.all([loadSummary(), loadPage(0, filter)])
      setConfirming(false)
      setNotice(
        data.batch.failed_count > 0 || data.batch.status === 'processing'
          ? { kind: 'partial', batch: data.batch }
          : { kind: 'success', batch: data.batch },
      )
    } catch (error) {
      setNotice({ kind: 'error', message: error.message })
    } finally {
      setWorking(false)
    }
  }

  if (loadError) {
    return (
      <div className="admin-alert" role="alert">
        {loadError.kind === 'not_found' ? 'This import batch does not exist.' : loadError.message}
      </div>
    )
  }
  if (!batch) return <p className="admin__muted" role="status">Loading import…</p>

  const canRetry = batch.status === 'processing' || batch.status === 'completed_with_errors'
  const lastPage = page.offset + PAGE_SIZE >= page.total

  return (
    <div className="aqi-review">
      <div className="admin-card">
        <p className="admin__muted">
          <strong>{batch.source_filename}</strong> ·{' '}
          {editable ? 'Validated – nothing has been imported yet.' : `Status: ${batch.status.replaceAll('_', ' ')}`}
        </p>
        <Counts batch={batch} selected={selected} editable={editable} />
      </div>

      {notice?.kind === 'success' && (
        <div className="admin-alert admin-alert--success" role="status">
          Imported {notice.batch.created_count} question{notice.batch.created_count === 1 ? '' : 's'} as inactive drafts.
        </div>
      )}
      {notice?.kind === 'partial' && (
        <div className="admin-alert" role="alert">
          {notice.batch.created_count} created, {notice.batch.failed_count} failed. Failed records show the reason below;
          fix the cause (for example a deleted topic) and choose Retry. Created questions are never duplicated.
        </div>
      )}
      {notice?.kind === 'error' && (
        <div className="admin-alert" role="alert">
          {notice.message}
        </div>
      )}

      {editable && (
        <div className="admin-card aqi-confirm">
          {batch.valid_count === 0 ? (
            <p role="status">
              None of the records in this file are valid, so there is nothing to import. Fix the errors shown on each
              record and upload the file again.
            </p>
          ) : problems.blocking ? (
            <p role="status">
              {problems.undecided.length > 0 && <>Choose include or exclude for likely duplicates: record {problems.undecided.join(', ')}. </>}
              {problems.unacknowledged.length > 0 && <>Acknowledge the duplicate warning for: record {problems.unacknowledged.join(', ')}.</>}
            </p>
          ) : confirming ? (
            <>
              <p>
                Create <strong>{selected}</strong> inactive question{selected === 1 ? '' : 's'} and exclude{' '}
                <strong>{batch.valid_count - selected}</strong>? Learners will not see them until each is reviewed and
                activated.
              </p>
              <div className="aqe__actions">
                <button type="button" className="aqe-button" onClick={() => run(toConfirmDecisions(summary, decisions))} disabled={working}>
                  {working ? 'Importing…' : 'Confirm import'}
                </button>
                <button type="button" className="aqe-button aqe-button--ghost" onClick={() => setConfirming(false)} disabled={working}>
                  Back to review
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="aqe-button" onClick={() => setConfirming(true)} disabled={selected === 0}>
              Review and confirm ({selected} selected)
            </button>
          )}
        </div>
      )}

      {canRetry && (
        <div className="admin-card aqi-confirm">
          <p>Some selected records have not been created yet.</p>
          <button type="button" className="aqe-button" onClick={() => run([])} disabled={working}>
            {working ? 'Retrying…' : 'Retry failed and pending records'}
          </button>
        </div>
      )}

      <div className="aqi-review__toolbar">
        <label>
          Show
          <select value={filter} onChange={(event) => changeFilter(event.target.value)}>
            {FILTERS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <span className="admin__muted" role="status" aria-live="polite">
          {page.total === 0 ? 'No records' : `Records ${page.offset + 1}–${Math.min(page.offset + PAGE_SIZE, page.total)} of ${page.total}`}
        </span>
      </div>

      <div className="aqi-records">
        {page.records.map((record) => (
          <RecordCard
            key={record.id}
            record={record}
            state={decisions[record.id]}
            editable={editable}
            topicLabel={topics[record.normalized_payload?.topic_id || record.source_payload?.topic_id]}
            onDecision={(id, value) => setDecisions((current) => setDecision(current, id, value))}
            onAcknowledge={(id, value) => setDecisions((current) => setAcknowledged(current, id, value))}
          />
        ))}
      </div>

      <div className="aqm__pager">
        <button
          type="button"
          className="aqe-button aqe-button--ghost"
          disabled={page.offset === 0}
          onClick={() => loadPage(Math.max(0, page.offset - PAGE_SIZE), filter).catch(setLoadError)}
        >
          Previous
        </button>
        <button
          type="button"
          className="aqe-button aqe-button--ghost"
          disabled={lastPage}
          onClick={() => loadPage(page.offset + PAGE_SIZE, filter).catch(setLoadError)}
        >
          Next
        </button>
      </div>
    </div>
  )
}

export default function AdminQuestionImportReviewPage() {
  const { user } = useOutletContext()
  const { batchId } = useParams()

  if (!canManageQbank(user)) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Bulk import</h1>
          <p className="admin__muted">Question-bank admin permission is required to review imports.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Bulk import
          </Link>
          <h1 className="admin__title">Review import</h1>
        </div>
        <div className="admin-badge">Admin</div>
      </div>
      <ImportReview key={batchId} batchId={batchId} />
    </div>
  )
}
