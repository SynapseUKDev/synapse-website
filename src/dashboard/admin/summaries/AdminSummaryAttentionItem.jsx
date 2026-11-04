import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import TopicSummary from '../../practice/TopicSummary'
import { canManageQbank } from '../questions/questionAdminAccess'
import QuestionSummaryControl from './QuestionSummaryControl'
import {
  ATTENTION_STATE_LABELS,
  CATEGORY_LABELS,
  SUMMARIES_PAGE_PATH,
  approveAttention,
  fetchAttentionItem,
  rejectAttention,
  saveAttentionDraft,
  referencesToText,
  textToReferences,
  toPreviewSummary,
} from './summaryAdminApi'
import './AdminSummaries.css'

const ACTION_LABELS = { edit: 'Draft saved', approve: 'Approved', reject: 'Rejected' }

function formatDateTime(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : ''
}

const formFrom = (item) => ({
  title: item?.draft?.title || '',
  body: item?.draft?.body_markdown || '',
  refs: referencesToText(item?.draft?.external_references),
})

function ReviewNotes({ item }) {
  const notes = item.review_notes
  const warnings = (item.warnings || '').split(' | ').filter(Boolean)
  return (
    <section className="asum-panel asum-report" aria-labelledby="asum-why-heading">
      <h2 id="asum-why-heading" className="asum-panel__title">Why it needs attention</h2>
      <p><strong>{item.reason}</strong></p>
      {warnings.length > 0 && (
        <ul>
          {warnings.map((w) => <li key={w}>{w}</li>)}
        </ul>
      )}
      {notes && (
        <>
          {(notes.relevance || notes.completeness) && (
            <p>
              Generator review: relevance {notes.relevance || '—'}, completeness {notes.completeness || '—'}.
            </p>
          )}
          {notes.coverage_note && <p>{notes.coverage_note}</p>}
          {notes.issues.length > 0 && (
            <>
              <p><strong>Issues found</strong></p>
              <ul>{notes.issues.map((i) => <li key={i}>{i}</li>)}</ul>
            </>
          )}
          {notes.source_gaps.length > 0 && (
            <>
              <p><strong>Missing evidence</strong></p>
              <ul>{notes.source_gaps.map((g) => <li key={g}>{g}</li>)}</ul>
            </>
          )}
          {notes.suggested_sources.length > 0 && (
            <>
              <p><strong>Sources the generator used or tried</strong></p>
              <ul>
                {notes.suggested_sources.map((url) => (
                  <li key={url}><a href={url} target="_blank" rel="noreferrer noopener">{url}</a></li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  )
}

function History({ data }) {
  const { events, item, other_cases: others } = data
  return (
    <section className="asum-panel" aria-labelledby="asum-history-heading">
      <h2 id="asum-history-heading" className="asum-panel__title">History</h2>
      <ul className="asum-versions">
        <li className="asum-version">
          <span className="asum-version__name">Uploaded</span>
          <span className="asum-version__meta">{formatDateTime(item.created_at)}</span>
        </li>
        {events.map((e) => (
          <li key={e.revision} className="asum-version">
            <span className="asum-version__name">{ACTION_LABELS[e.action] || e.action}</span>
            <span className="asum-version__meta">
              {formatDateTime(e.created_at)} · {e.actor_email || e.actor_id}
            </span>
            {e.note && <span>{e.note}</span>}
            {e.published_summary_id && (
              <Link to={`${SUMMARIES_PAGE_PATH}/${e.published_summary_id}`}>Open the published staff edition</Link>
            )}
          </li>
        ))}
      </ul>
      {item.original_draft?.body_markdown && (
        <details>
          <summary>Original generated draft</summary>
          <p><strong>{item.original_draft.title}</strong></p>
          <pre className="asum-original">{item.original_draft.body_markdown}</pre>
        </details>
      )}
      {others.length > 0 && (
        <p className="admin__muted">
          Other review items for this question:{' '}
          {others.map((o, i) => (
            <React.Fragment key={o.id}>
              {i > 0 && ', '}
              <Link to={`${SUMMARIES_PAGE_PATH}/attention/${o.id}`}>
                {ATTENTION_STATE_LABELS[o.state] || o.state} ({formatDateTime(o.created_at)})
              </Link>
            </React.Fragment>
          ))}
        </p>
      )}
    </section>
  )
}

function AttentionItem({ itemId }) {
  const [data, setData] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [form, setForm] = useState(formFrom(null))
  const [editNote, setEditNote] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const accept = useCallback((next) => {
    setData(next)
    setForm(formFrom(next.item))
  }, [])

  const reload = useCallback(
    (signal) =>
      fetchAttentionItem(itemId, { signal })
        .then(accept)
        .catch((e) => e?.name !== 'AbortError' && setLoadError(e.message)),
    [itemId, accept],
  )

  // After a selector change: new state and history, without discarding unsaved edits.
  const refreshKeepingEdits = useCallback(() => {
    fetchAttentionItem(itemId).then(setData).catch((e) => setError(e.message))
  }, [itemId])

  useEffect(() => {
    const controller = new AbortController()
    reload(controller.signal)
    return () => controller.abort()
  }, [reload])

  const item = data?.item
  const saved = useMemo(() => formFrom(item), [item])
  const dirty = form.title !== saved.title || form.body !== saved.body || form.refs !== saved.refs
  const preview = useMemo(() => {
    if (!item?.target_summary || !form.body.trim()) return null
    return toPreviewSummary(
      { ...item.target_summary, id: item.id },
      { id: `${item.id}-draft`, version: 0, title: form.title, body_markdown: form.body, external_references: textToReferences(form.refs) },
    )
  }, [item, form])

  if (loadError) return <p className="asum-error" role="alert">{loadError}</p>
  if (!data) return <p className="asum-results">Loading…</p>

  const open = item.state === 'draft' || item.state === 'awaiting_content'
  const savedRefs = item.draft?.external_references || []
  const canApprove = item.state === 'draft' && !dirty && savedRefs.length > 0 && approveNote.trim().length >= 3

  async function run(action, success) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      accept(await action())
      setNotice(success)
      return true
    } catch (e) {
      setError(e.message)
      return false
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(
      () =>
        saveAttentionDraft(itemId, {
          expectedRevision: item.revision,
          title: form.title.trim(),
          bodyMarkdown: form.body,
          externalReferences: textToReferences(form.refs, savedRefs),
          reason: editNote.trim(),
        }),
      'Draft saved. It is still hidden from students.',
    ).then((ok) => ok && setEditNote(''))

  const approve = () => {
    if (!window.confirm('Publish this text to students for this question only?')) return
    run(() => approveAttention(itemId, item.revision, approveNote.trim()), 'Approved. Students now see this text on this question.')
  }

  const reject = () => {
    const reason = window.prompt('Reject this item? Optionally say why (the question keeps its current summary).', '')
    if (reason === null) return
    run(() => rejectAttention(itemId, item.revision, reason.trim()), 'Rejected. Nothing was shown to students.')
  }

  return (
    <div className="asum-detail">
      <div className="asum-detail__meta">
        <span className={`asum-status asum-status--${item.state === 'approved' ? 'published' : item.state === 'rejected' ? 'archived' : 'draft'}`}>
          {ATTENTION_STATE_LABELS[item.state] || item.state}
        </span>
        <span>{item.condition_name}</span>
        <span>{CATEGORY_LABELS[item.question_category] || item.question_category || 'No category'}</span>
        {item.target_summary && (
          <span>
            Summary: {item.target_summary.subject_label}
            {item.target_summary.scope_label && item.target_summary.scope_label !== 'General' ? ` (${item.target_summary.scope_label})` : ''}
          </span>
        )}
      </div>

      {data.question && (
        <section className="asum-panel" aria-labelledby="asum-question-heading">
          <h2 id="asum-question-heading" className="asum-panel__title">Question</h2>
          <p className="asum-question-stem">{data.question.stem}</p>
          <p className="admin__muted">
            Topic: {data.question.topic?.name || '—'} ·{' '}
            <Link to={`/dashboard/admin/questions/${data.question.id}`}>Open the question</Link>
          </p>
        </section>
      )}

      {notice && <p className="asum-success" role="status">{notice}</p>}
      {error && <p className="asum-error" role="alert">{error}</p>}

      <div className="asum-detail__grid">
        <ReviewNotes item={item} />

        <section className="asum-panel" aria-labelledby="asum-draft-heading">
          <h2 id="asum-draft-heading" className="asum-panel__title">
            {open ? (item.state === 'awaiting_content' ? 'Write the summary' : 'Draft') : 'Final text'}
          </h2>
          {open && !item.target_summary && (
            <p className="admin__muted">
              This question has no summary target (missing category or drug identity), so no text can be written here.
              Choose an existing summary under &quot;Shown to students&quot;, then reject this item.
            </p>
          )}
          {open && item.target_summary ? (
            <div className="asum-editor">
              <label htmlFor="asum-att-title">Title</label>
              <input
                id="asum-att-title"
                value={form.title}
                maxLength={120}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
              <label htmlFor="asum-att-body">Body (Markdown)</label>
              <textarea
                id="asum-att-body"
                value={form.body}
                rows={14}
                maxLength={8000}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
              <label htmlFor="asum-att-refs">Evidence links, one per line: https://… | Label</label>
              <textarea
                id="asum-att-refs"
                value={form.refs}
                rows={4}
                onChange={(e) => setForm({ ...form, refs: e.target.value })}
              />
              <label htmlFor="asum-att-note">What you changed (optional)</label>
              <input id="asum-att-note" value={editNote} maxLength={500} onChange={(e) => setEditNote(e.target.value)} />
              {dirty && <p className="admin__muted">Unsaved changes</p>}
              <div className="asum-actions">
                <button type="button" className="asum-button asum-button--primary" disabled={busy || !dirty} onClick={save}>
                  Save draft
                </button>
              </div>
            </div>
          ) : (
            !open && item.draft && <p><strong>{item.draft.title}</strong></p>
          )}
          {preview ? (
            <TopicSummary key={item.revision} summary={preview} questionId={null} API_BASE="" />
          ) : (
            <p className="admin__muted">No text yet.</p>
          )}
        </section>
      </div>

      {open && (
        <section className="asum-panel" aria-labelledby="asum-decide-heading">
          <h2 id="asum-decide-heading" className="asum-panel__title">Decision</h2>
          <p className="admin__muted">
            Approving publishes this text as a staff edition for <strong>this question only</strong> and makes it the
            question&apos;s manual summary choice. Other questions, and any shared summary (such as a drug overview), are
            not changed. Save the draft with at least one evidence link first.
          </p>
          <label className="asum-field" htmlFor="asum-att-approve-note">
            Approval note (required)
            <input
              id="asum-att-approve-note"
              value={approveNote}
              maxLength={500}
              placeholder="e.g. Checked against NICE NG115"
              onChange={(e) => setApproveNote(e.target.value)}
            />
          </label>
          <div className="asum-actions">
            <button type="button" className="asum-button asum-button--primary" disabled={busy || !canApprove} onClick={approve}>
              Approve for this question
            </button>
            <button type="button" className="asum-button asum-button--danger" disabled={busy} onClick={reject}>
              Reject
            </button>
          </div>
        </section>
      )}

      <section className="asum-panel" aria-labelledby="asum-shown-heading">
        <h2 id="asum-shown-heading" className="asum-panel__title">Shown to students</h2>
        <p className="admin__muted">
          Under the wrong topic? Choose the right approved summary here, then reject this item. A choice made here
          means this draft can no longer be approved.
        </p>
        <QuestionSummaryControl questionId={item.question_id} onChange={refreshKeepingEdits} />
      </section>

      <History data={data} />
    </div>
  )
}

/** Summary review → one item from Needs attention. */
export default function AdminSummaryAttentionItem() {
  const { user } = useOutletContext()
  const { itemId } = useParams()

  if (!canManageQbank(user)) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Summary review</h1>
          <p className="admin__muted">Question-bank admin permission is required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to={`${SUMMARIES_PAGE_PATH}/attention`}>
            <LuChevronLeft aria-hidden /> Needs attention
          </Link>
          <h1 className="admin__title">Review summary draft</h1>
        </div>
        <div className="admin-badge">Admin</div>
      </div>
      <AttentionItem key={itemId} itemId={itemId} />
    </div>
  )
}
