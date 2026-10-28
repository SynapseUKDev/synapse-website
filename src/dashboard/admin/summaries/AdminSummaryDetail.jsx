import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import TopicSummary from '../../practice/TopicSummary'
import { useUnsavedChangesGuard } from '../../navigationGuard'
import { canManageQbank } from '../questions/questionAdminAccess'
import {
  CATEGORY_LABELS,
  SUMMARIES_PAGE_PATH,
  createVersion,
  deleteSummary,
  fetchPracticePreview,
  fetchSummary,
  publishVersion,
  redraftSummary,
  toPreviewSummary,
  withdrawSummary,
} from './summaryAdminApi'
import SummaryStatusBadge, { ValidationBadge } from './SummaryStatusBadge'
import { dropFromSummariesCache } from './summariesListCache'
import './AdminSummaries.css'

const VALIDATION_LABELS = { passed: 'Passed validation', needs_review: 'Needs review', failed: 'Failed validation' }
const ORIGIN_LABELS = { generated: 'Generated', admin_edit: 'Admin edit' }
const SELECTION_LABELS = { manual: 'Manual choice', overridden: 'Manually moved to another summary', automatic: 'Automatic' }

function formatDate(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
}

function ValidationReport({ version }) {
  const report = version?.validation_report || {}
  const structural = report.structural || {}
  const review = report.review || {}
  return (
    <section className="asum-panel asum-report" aria-labelledby="asum-validation-heading">
      <h2 id="asum-validation-heading" className="asum-panel__title">Validation for v{version.version}</h2>
      <p><strong>Status:</strong> <ValidationBadge status={version.validation_status} /></p>
      {version.section_fallback && (
        <p><strong>Section fallback:</strong> the textbook had no section for this learning task, so the whole page was used.</p>
      )}
      <p><strong>Structural errors:</strong> {(structural.errors || []).length ? structural.errors.join(', ') : 'none'}</p>
      <p><strong>Warnings:</strong> {(structural.warnings || []).length ? structural.warnings.join(', ') : 'none'}</p>
      {review.relevance && (
        <p><strong>Review:</strong> relevance {review.relevance}, completeness {review.completeness}</p>
      )}
      {(review.unsupported_claims || []).length > 0 && (
        <>
          <p><strong>Unsupported claims:</strong></p>
          <ul>{review.unsupported_claims.map((claim, i) => <li key={i}>{claim}</li>)}</ul>
        </>
      )}
      {(review.question_conflicts || []).length > 0 && (
        <>
          <p><strong>Conflicts with question keys:</strong></p>
          <ul>{review.question_conflicts.map((c) => <li key={c.question_id}>{c.question_id}: {c.issue}</li>)}</ul>
        </>
      )}
    </section>
  )
}

const PRACTICE_PATH = '/dashboard/question-bank/practice'

function SummaryDetail({ summaryId }) {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null) // { title, body, baseVersionId }
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // { kind: 'error' | 'success', text, fields? }

  const load = useCallback(
    async (preferVersionId) => {
      try {
        const result = await fetchSummary(summaryId)
        setData(result)
        setLoadError(null)
        const versions = result.versions || []
        const keep = versions.find((v) => v.id === preferVersionId)
        setSelectedId(keep?.id || result.summary.active_version_id || versions[0]?.id || null)
      } catch (e) {
        setLoadError(e.message)
      }
    },
    [summaryId],
  )

  useEffect(() => {
    load()
  }, [load])

  const selected = useMemo(() => data?.versions.find((v) => v.id === selectedId) || null, [data, selectedId])
  const editPreview = useMemo(
    () =>
      editing && data
        ? toPreviewSummary(data.summary, { ...selected, id: 'preview', title: editing.title, body_markdown: editing.body, reviewed_at: null })
        : null,
    [editing, data, selected],
  )
  const dirty = !!editing && !!selected && (editing.title !== selected.title || editing.body !== selected.body_markdown)
  useUnsavedChangesGuard(dirty)

  if (loadError) return <p className="asum-error" role="alert">{loadError}</p>
  if (!data) return <p className="admin__muted">Loading summary…</p>

  const { summary } = data
  const active = data.versions.find((v) => v.id === summary.active_version_id)

  async function run(action, success) {
    setBusy(true)
    setMessage(null)
    try {
      const result = await action()
      setMessage({ kind: 'success', text: success })
      return result
    } catch (e) {
      setMessage({ kind: 'error', text: e.message, fields: e.fields || [] })
      return null
    } finally {
      setBusy(false)
    }
  }

  async function saveEdit() {
    const result = await run(
      () =>
        createVersion(summary.id, {
          title: editing.title,
          bodyMarkdown: editing.body,
          baseVersionId: editing.baseVersionId,
          expectedRowVersion: summary.row_version,
        }),
      'Saved as a new version.',
    )
    if (result?.version) {
      setEditing(null)
      await load(result.version.id)
      setMessage({
        kind: 'success',
        text: `Saved as v${result.version.version} (${VALIDATION_LABELS[result.version.validation_status] || result.version.validation_status}).`,
      })
    }
  }

  async function publishSelected(label) {
    if (!window.confirm(`${label}? Learners will see v${selected.version} on every linked question.`)) return
    if (await run(() => publishVersion(summary.id, selected.id, summary.row_version), `${label}: done.`)) await load(selected.id)
  }

  async function withdraw() {
    if (!window.confirm('Withdraw this summary? Learners stop seeing it immediately. You can re-draft and publish it again later.')) return
    if (await run(() => withdrawSummary(summary.id, summary.row_version), 'Withdrawn.')) await load(selectedId)
  }

  async function remove() {
    const linked = data.linked_questions.length
    const message =
      `Delete this summary permanently? All ${data.versions.length} version(s) are removed` +
      (linked ? ` and ${linked} question(s) stop showing it` : '') +
      '. This cannot be undone; generating it again creates a new draft.'
    if (!window.confirm(message)) return
    if (await run(() => deleteSummary(summary.id, summary.row_version), 'Deleted.')) {
      dropFromSummariesCache(summary.id)
      navigate('/dashboard/admin', { replace: true })
    }
  }

  // Opens the linked questions in Practice review mode with this version attached, so it can be
  // seen exactly where learners see it (drafts included). Nothing is saved or published.
  async function previewInPractice() {
    const result = await run(() => fetchPracticePreview(summary.id, selected.id), 'Opening the practice preview…')
    if (!result) return
    navigate(PRACTICE_PATH, {
      state: {
        reviewMode: true,
        questions: result.questions,
        userAnswers: {},
        sessionStats: {
          totalQuestions: result.questions.length,
          correct: 0,
          skipped: 0,
          totalMs: 0,
          specialtyName: `Summary preview: ${summary.subject_label} v${result.version}`,
        },
      },
    })
  }

  async function redraft() {
    if (await run(() => redraftSummary(summary.id, summary.row_version), 'Returned to draft.')) await load(selectedId)
  }

  const canPublishSelected =
    selected?.validation_status === 'passed' && !(summary.status === 'published' && selected.id === summary.active_version_id)
  const publishLabel =
    summary.status === 'published' && active && selected && selected.version < active.version
      ? `Roll back to v${selected?.version}`
      : `Publish v${selected?.version}`

  return (
    <div className="asum-detail">
      <div className="asum-detail__meta">
        <SummaryStatusBadge status={summary.status} />
        <span>{summary.kind === 'drug' ? `Drug: ${summary.subject_label}` : summary.topic?.name || summary.subject_label}</span>
        <span>{CATEGORY_LABELS[summary.question_category] || summary.question_category}</span>
        <span>Scope: {summary.scope_label}</span>
        {active && <span>Live: v{active.version}</span>}
      </div>
      {summary.withdrawn_reason && <p className="admin__muted">Withdrawn: {summary.withdrawn_reason}</p>}

      {message && (
        <div className={message.kind === 'error' ? 'asum-error' : 'asum-success'} role={message.kind === 'error' ? 'alert' : 'status'}>
          <p>{message.text}</p>
          {(message.fields || []).length > 0 && (
            <ul>{message.fields.map((f) => <li key={f.field}>{f.field}: {f.message}</li>)}</ul>
          )}
        </div>
      )}

      <div className="asum-detail__grid">
        <section className="asum-panel" aria-labelledby="asum-versions-heading">
          <h2 id="asum-versions-heading" className="asum-panel__title">Versions</h2>
          <ol className="asum-versions">
            {data.versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className={`asum-version ${v.id === selectedId ? 'is-selected' : ''}`}
                  aria-pressed={v.id === selectedId}
                  aria-label={`v${v.version}${v.id === summary.active_version_id ? ' (live)' : ''} — ${
                    VALIDATION_LABELS[v.validation_status] || v.validation_status
                  } — ${ORIGIN_LABELS[v.origin] || v.origin}, ${formatDate(v.created_at)}`}
                  onClick={() => {
                    if (dirty && !window.confirm('Discard your unsaved edit?')) return
                    setEditing(null)
                    setSelectedId(v.id)
                  }}
                >
                  <span className="asum-version__name">v{v.version}{v.id === summary.active_version_id ? ' (live)' : ''}</span>
                  <span><ValidationBadge status={v.validation_status} /></span>
                  <span className="asum-version__meta">{ORIGIN_LABELS[v.origin] || v.origin} · {formatDate(v.created_at)}</span>
                </button>
              </li>
            ))}
          </ol>

          <div className="asum-actions">
            {selected && !editing && (
              <button
                type="button"
                className="asum-button"
                disabled={busy}
                onClick={() => setEditing({ title: selected.title, body: selected.body_markdown, baseVersionId: selected.id })}
              >
                Edit v{selected.version}
              </button>
            )}
            {selected && !editing && data.linked_questions.length > 0 && (
              <button type="button" className="asum-button" disabled={busy} onClick={previewInPractice}>
                Preview v{selected.version} in practice
              </button>
            )}
            {selected && canPublishSelected && !editing && (
              <button type="button" className="asum-button asum-button--primary" disabled={busy} onClick={() => publishSelected(publishLabel)}>
                {publishLabel}
              </button>
            )}
            {summary.status === 'published' && (
              <button type="button" className="asum-button" disabled={busy} onClick={withdraw}>
                Withdraw
              </button>
            )}
            {summary.status === 'archived' && (
              <button type="button" className="asum-button" disabled={busy} onClick={redraft}>
                Re-draft
              </button>
            )}
            {!editing && (
              <button type="button" className="asum-button asum-button--danger" disabled={busy} onClick={remove}>
                Delete summary
              </button>
            )}
          </div>
          {selected && selected.validation_status !== 'passed' && !editing && (
            <p className="admin__muted">Only a version that passed validation can be published. Edit it to create a new version.</p>
          )}

        </section>

        <section className="asum-panel" aria-labelledby="asum-preview-heading">
          <h2 id="asum-preview-heading" className="asum-panel__title">
            {editing ? 'Editing (live preview)' : selected ? `Learner preview of v${selected.version}` : 'No versions yet'}
          </h2>
          {editing && (
            <div className="asum-editor">
              <label htmlFor="asum-edit-title">Title</label>
              <input
                id="asum-edit-title"
                value={editing.title}
                maxLength={120}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              />
              <label htmlFor="asum-edit-body">Body (Markdown)</label>
              <textarea
                id="asum-edit-body"
                value={editing.body}
                rows={14}
                maxLength={8000}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              />
              {dirty && <p className="admin__muted">Unsaved changes</p>}
              <div className="asum-actions">
                <button type="button" className="asum-button asum-button--primary" disabled={busy || !dirty} onClick={saveEdit}>
                  Save as new version
                </button>
                <button
                  type="button"
                  className="asum-button"
                  onClick={() => {
                    if (dirty && !window.confirm('Discard your unsaved edit?')) return
                    setEditing(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {editing ? (
            <TopicSummary summary={editPreview} questionId={null} API_BASE="" />
          ) : (
            selected && <TopicSummary key={selected.id} summary={toPreviewSummary(summary, selected)} questionId={null} API_BASE="" />
          )}
        </section>
      </div>

      {selected && <ValidationReport version={selected} />}

      <section className="asum-panel" aria-labelledby="asum-linked-heading">
        <h2 id="asum-linked-heading" className="asum-panel__title">Linked questions ({data.linked_questions.length})</h2>
        <div className="asum-table-wrap">
          <table className="asum-table">
            <thead>
              <tr>
                <th scope="col">Question</th>
                <th scope="col">Topic</th>
                <th scope="col">Keyed answer</th>
                <th scope="col">Link</th>
                <th scope="col">Active</th>
              </tr>
            </thead>
            <tbody>
              {data.linked_questions.map((q) => (
                <tr key={q.id}>
                  <td><Link to={`/dashboard/admin/questions/${q.id}`}>{q.stem_excerpt}</Link></td>
                  <td>{q.topic_name}{q.drug_focus ? ` · ${q.drug_focus.replace(/_/g, ' ')}` : ''}</td>
                  <td>{q.keyed_answer || 'Unknown'}</td>
                  <td>{SELECTION_LABELS[q.selection] || SELECTION_LABELS.automatic}</td>
                  <td>{q.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
              {data.linked_questions.length === 0 && (
                <tr><td colSpan={5} className="asum-table__empty">No questions are linked yet. Links are applied with the generated link SQL, or chosen per question in practice.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="asum-panel" aria-labelledby="asum-reports-heading">
        <h2 id="asum-reports-heading" className="asum-panel__title">Open learner reports ({data.open_reports.length})</h2>
        {data.open_reports.length === 0 ? (
          <p className="asum-results">No open reports.</p>
        ) : (
          <ul>
            {data.open_reports.map((r) => {
              const version = data.versions.find((v) => v.id === r.learning_summary_version_id)
              return (
                <li key={r.id}>
                  {formatDate(r.created_at)} on v{version?.version ?? '?'}: {r.details}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

export default function AdminSummaryDetail() {
  const { user } = useOutletContext()
  const { summaryId } = useParams()

  if (!canManageQbank(user)) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Summary</h1>
          <p className="admin__muted">Question-bank admin permission is required to review summaries.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Summaries
          </Link>
          <h1 className="admin__title">Review summary</h1>
        </div>
        <div className="admin-badge">Admin</div>
      </div>
      <SummaryDetail key={summaryId} summaryId={summaryId} />
      <p className="admin__muted">
        <Link to={`${SUMMARIES_PAGE_PATH}/queue`}>Unresolved queue</Link>
      </p>
    </div>
  )
}
