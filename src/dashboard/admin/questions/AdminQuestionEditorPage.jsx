import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { useUnsavedChangesGuard } from '../../navigationGuard'
import AdminQuestionForm from './AdminQuestionForm'
import QuestionErrorSummary from './QuestionErrorSummary'
import QuestionPreview from './QuestionPreview'
import QuestionStatusBadge from './QuestionStatusBadge'
import { ADMIN_QUESTIONS_PATH, canManageQbank } from './questionAdminAccess'
import { createQuestion, fetchQuestion, fetchTaxonomy, updateQuestion } from './questionAdminApi'
import {
  createEmptyForm,
  formFromQuestion,
  isFormDirty,
  mapServerIssues,
  normalizedSnapshot,
  questionFormReducer,
  summaryEntries,
  toQuestionPayload,
} from './questionFormModel'
import '../Admin.css'
import './AdminQuestions.css'

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

function QuestionEditor({ questionId }) {
  const isNew = !questionId
  const navigate = useNavigate()
  const location = useLocation()
  const [form, dispatch] = useReducer(questionFormReducer, undefined, createEmptyForm)
  const [baseline, setBaseline] = useState(() => normalizedSnapshot(form))
  const [meta, setMeta] = useState(null)
  const [taxonomy, setTaxonomy] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({ fields: {}, options: {} })
  const [summary, setSummary] = useState([])
  const [notice, setNotice] = useState(location.state?.savedVersion ? { kind: 'success', version: location.state.savedVersion } : null)
  const summaryRef = useRef(null)

  const applyLoadedQuestion = useCallback((question) => {
    const next = question ? formFromQuestion(question) : createEmptyForm()
    dispatch({ type: 'reset', form: next })
    setBaseline(normalizedSnapshot(next))
    setMeta(question)
    setErrors({ fields: {}, options: {} })
    setSummary([])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [taxonomyData, questionData] = await Promise.all([
        fetchTaxonomy(),
        isNew ? Promise.resolve(null) : fetchQuestion(questionId),
      ])
      setTaxonomy(taxonomyData?.specialties || [])
      applyLoadedQuestion(questionData?.question || null)
    } catch (error) {
      setLoadError(error)
    } finally {
      setLoading(false)
    }
  }, [applyLoadedQuestion, isNew, questionId])

  useEffect(() => {
    load()
  }, [load])

  const dirty = !loading && isFormDirty(form, baseline)
  useUnsavedChangesGuard(dirty)

  const isActive = !!meta?.is_active
  const payload = useMemo(() => toQuestionPayload(form), [form])

  const save = async (event) => {
    event.preventDefault()
    if (saving || isActive) return
    const formAtSave = form
    setSaving(true)
    setNotice(null)
    try {
      const data = isNew
        ? await createQuestion(toQuestionPayload(formAtSave))
        : await updateQuestion(questionId, meta.version, toQuestionPayload(formAtSave))
      const saved = data.question
      if (isNew) {
        // The route change remounts the editor with the saved question loaded.
        applyLoadedQuestion(saved)
        navigate(`${ADMIN_QUESTIONS_PATH}/${saved.id}`, { replace: true, state: { savedVersion: saved.version } })
        return
      }
      applyLoadedQuestion(saved)
      setNotice({ kind: 'success', version: saved.version })
    } catch (error) {
      if (error.kind === 'validation') {
        const mapped = mapServerIssues(error.issues, formAtSave)
        setErrors(mapped)
        const entries = summaryEntries(mapped, formAtSave)
        setSummary(entries.length ? entries : [{ id: null, label: 'Question', message: error.message }])
        requestAnimationFrame(() => summaryRef.current?.focus())
      } else {
        setNotice({ kind: error.kind, message: error.message, currentVersion: error.currentVersion })
      }
    } finally {
      setSaving(false)
    }
  }

  const loadLatest = async () => {
    if (!window.confirm('Load the latest saved version? Your unsaved changes on this page will be discarded.')) return
    setNotice(null)
    await load()
  }

  if (loading) {
    return <p className="admin__muted" role="status">Loading question…</p>
  }

  if (loadError) {
    return (
      <div className="admin-card admin-card--narrow">
        <div className="admin-alert" role="alert">
          {loadError.kind === 'not_found' ? 'This question does not exist or was removed.' : loadError.message}
        </div>
        <button type="button" className="aqe-button" onClick={load}>
          Try again
        </button>
      </div>
    )
  }

  return (
    <form className="aqe" onSubmit={save} noValidate>
      <div className="aqe__status" aria-live="polite">
        <QuestionStatusBadge active={isActive} />
        {meta && (
          <span className="admin__muted">
            Version {meta.version} · Last saved {formatDate(meta.updated_at)}
          </span>
        )}
        {dirty && <span className="aqe__dirty">Unsaved changes</span>}
      </div>

      {isNew && (
        <p className="admin__muted">
          New questions are saved as inactive drafts. Learners cannot see them until they are reviewed and activated.
        </p>
      )}

      {isActive && (
        <div className="admin-alert" role="status">
          This question is active, so its content is read-only. Deactivate it before editing; it will then need a fresh review
          before reactivation.
        </div>
      )}

      <QuestionErrorSummary entries={summary} summaryRef={summaryRef} />

      {notice?.kind === 'success' && (
        <div className="admin-alert admin-alert--success" role="status">
          Saved as an inactive draft (version {notice.version}).
        </div>
      )}
      {notice?.kind === 'conflict' && (
        <div className="admin-alert" role="alert">
          <p>
            {notice.message}
            {notice.currentVersion ? ` The latest saved version is ${notice.currentVersion}; you were editing version ${meta?.version}.` : ''}
          </p>
          <p>Your changes are still on this page. Copy anything you need, then load the latest version and reapply it.</p>
          <div className="aqe__actions">
            <button type="button" className="aqe-button" onClick={loadLatest}>
              Load latest version
            </button>
            <a className="aqe-button aqe-button--ghost" href={window.location.pathname} target="_blank" rel="noreferrer">
              Open latest in a new tab
            </a>
          </div>
        </div>
      )}
      {notice && !['success', 'conflict'].includes(notice.kind) && (
        <div className="admin-alert" role="alert">
          {notice.message}
        </div>
      )}

      <div className="aqe__layout">
        <div className="admin-card admin-form">
          <AdminQuestionForm form={form} dispatch={dispatch} taxonomy={taxonomy} errors={errors} readOnly={isActive || saving} />
        </div>
        <div className="aqe__preview">
          <h2 className="aqe__heading">Learner preview</h2>
          <p className="admin__muted">Shows your unsaved changes. Previewing never saves or records an attempt.</p>
          <QuestionPreview question={payload} />
        </div>
      </div>

      <div className="aqe__actions aqe__actions--sticky">
        <button type="submit" className="aqe-button" disabled={saving || isActive || (!dirty && !isNew)}>
          {saving ? 'Saving…' : isNew ? 'Save inactive draft' : 'Save changes'}
        </button>
        <Link className="aqe-button aqe-button--ghost" to="/dashboard/admin">
          {dirty ? 'Cancel' : 'Back to questions'}
        </Link>
      </div>
    </form>
  )
}

export default function AdminQuestionEditorPage() {
  const { user } = useOutletContext()
  const { questionId } = useParams()

  if (!canManageQbank(user)) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Question editor</h1>
          <p className="admin__muted">Question-bank admin permission is required to create or edit questions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Questions
          </Link>
          <h1 className="admin__title">{questionId ? 'Edit question' : 'New question'}</h1>
        </div>
        <div className="admin-badge">Admin</div>
      </div>
      <QuestionEditor key={questionId || 'new'} questionId={questionId} />
    </div>
  )
}
