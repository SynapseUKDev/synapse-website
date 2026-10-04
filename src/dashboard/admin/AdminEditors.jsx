import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { useUnsavedChangesGuard } from '../navigationGuard'
import AdminImageGallery from './AdminImageGallery.jsx'
import AdminQuestionForm from './questions/AdminQuestionForm'
import QuestionErrorSummary from './questions/QuestionErrorSummary'
import QuestionStatusBadge from './questions/QuestionStatusBadge'
import { ADMIN_QUESTIONS_PATH } from './questions/questionAdminAccess'
import { fetchQuestion, fetchTaxonomyCached, updateQuestion } from './questions/questionAdminApi'
import {
  createEmptyForm,
  formFromQuestion,
  isFormDirty,
  mapServerIssues,
  normalizedSnapshot,
  questionFormReducer,
  summaryEntries,
  toQuestionPayload,
} from './questions/questionFormModel'
import './Admin.css'

async function readJsonError(res) {
  const json = await res.json().catch(() => ({}))
  return json?.error ? JSON.stringify(json.error) : 'Request failed'
}

/**
 * Inline question editor used beside practice questions, reported issues and
 * review comments. It shares the full editor's form, validation, versioned
 * saves and conflict handling; active questions are read-only until deactivated.
 */
export function AdminQuestionInlineEditor({ questionId, onSaved }) {
  const [form, dispatch] = useReducer(questionFormReducer, undefined, createEmptyForm)
  const [baseline, setBaseline] = useState(null)
  const [meta, setMeta] = useState(null)
  const [taxonomy, setTaxonomy] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({ fields: {}, options: {} })
  const [summary, setSummary] = useState([])
  const [notice, setNotice] = useState(null)
  const summaryRef = useRef(null)

  const applyLoadedQuestion = useCallback((question) => {
    const next = formFromQuestion(question)
    dispatch({ type: 'reset', form: next })
    setBaseline(normalizedSnapshot(next))
    setMeta(question)
    setErrors({ fields: {}, options: {} })
    setSummary([])
  }, [])

  const load = useCallback(async (signal) => {
    if (!questionId) return
    setLoading(true)
    setLoadError(null)
    setNotice(null)
    try {
      const [taxonomyData, questionData] = await Promise.all([
        fetchTaxonomyCached().catch(() => ({ specialties: [] })),
        fetchQuestion(questionId, { signal }),
      ])
      setTaxonomy(taxonomyData?.specialties || [])
      applyLoadedQuestion(questionData.question)
    } catch (error) {
      if (error?.name !== 'AbortError') setLoadError(error)
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [applyLoadedQuestion, questionId])

  useEffect(() => {
    const controller = new AbortController()
    setMeta(null)
    setBaseline(null)
    load(controller.signal)
    return () => controller.abort()
  }, [load])

  const dirty = !!baseline && isFormDirty(form, baseline)
  useUnsavedChangesGuard(dirty)
  const isActive = !!meta?.is_active

  async function saveQuestion(event) {
    event.preventDefault()
    if (!meta || saving) return
    const formAtSave = form
    setSaving(true)
    setNotice(null)
    try {
      const data = await updateQuestion(questionId, meta.version, toQuestionPayload(formAtSave))
      applyLoadedQuestion(data.question)
      setNotice({ kind: 'success', version: data.question.version })
      onSaved?.(data.question)
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

  const loadLatest = () => {
    if (!window.confirm('Load the latest saved version? Your unsaved changes here will be discarded.')) return
    load()
  }

  if (!questionId) return <p className="admin__muted">Select a question to edit.</p>
  if (loading && !meta) return <LoadingScreen message="Loading question editor..." inline />
  if (loadError) {
    return (
      <div className="admin-inline-editor">
        <div className="admin-alert" role="alert">
          {loadError.kind === 'not_found' ? 'This question no longer exists.' : loadError.message}
        </div>
        <button type="button" className="aqe-button aqe-button--ghost" onClick={() => load()}>
          Try again
        </button>
      </div>
    )
  }
  if (!meta) return <p className="admin__muted">Question editor unavailable.</p>

  const images = meta.images || []

  return (
    <div className="admin-inline-editor">
      <div className="aqe__status">
        <QuestionStatusBadge active={isActive} />
        <span className="admin__muted">Version {meta.version}</span>
        {dirty && <span className="aqe__dirty">Unsaved changes</span>}
        <Link className="aqe-inline__full" to={`${ADMIN_QUESTIONS_PATH}/${questionId}`}>
          Open in full editor
        </Link>
      </div>

      {isActive && (
        <div className="aqe-live-note" role="status">
          This question is live. Saved changes are visible to learners immediately.
        </div>
      )}

      <QuestionErrorSummary entries={summary} summaryRef={summaryRef} />

      {notice?.kind === 'success' && (
        <div className="admin-alert admin-alert--success" role="status">
          Saved (version {notice.version}).
        </div>
      )}
      {notice?.kind === 'conflict' && (
        <div className="admin-alert" role="alert">
          <p>
            {notice.message}
            {notice.currentVersion ? ` The latest saved version is ${notice.currentVersion}.` : ''} Your changes are still
            here.
          </p>
          <button type="button" className="aqe-button" onClick={loadLatest}>
            Load latest version
          </button>
        </div>
      )}
      {notice && !['success', 'conflict'].includes(notice.kind) && (
        <div className="admin-alert" role="alert">
          {notice.message}
        </div>
      )}

      <form className="admin-form" onSubmit={saveQuestion} noValidate>
        <AdminQuestionForm form={form} dispatch={dispatch} taxonomy={taxonomy} errors={errors} readOnly={saving} />

        <div className="admin-form__section">
          <div className="admin-form__section-title">Question images</div>
          <p className="admin__muted admin-form__section-hint">
            {images.length === 0
              ? 'No images.'
              : `${images.length} image${images.length === 1 ? '' : 's'} attached.`}{' '}
            Image upload and ordering move to the new question image manager; existing images are unchanged by saving
            here.
          </p>
        </div>

        <button type="submit" disabled={saving || !dirty}>
          {saving ? 'Saving...' : 'Save question'}
        </button>
      </form>
    </div>
  )
}

function pageToForm(page) {
  return {
    title: page?.title || '',
    slug: page?.slug || '',
    summary: page?.summary || '',
    status: page?.status || 'draft',
  }
}

export function AdminTextbookInlineEditor({ pageId, API_BASE, onSaved }) {
  const [page, setPage] = useState(null)
  const [pageForm, setPageForm] = useState(null)
  const [sections, setSections] = useState([])
  const [blocks, setBlocks] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [sectionForm, setSectionForm] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [blockForm, setBlockForm] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const sectionById = useMemo(() => {
    const map = new Map()
    sections.forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  async function loadPage(id = pageId) {
    if (!id) return
    setLoading(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setPage(data.page)
      setPageForm(pageToForm(data.page))
      setSections(data.sections || [])
      setBlocks(data.blocks || [])
      setSelectedSection(null)
      setSectionForm(null)
      setSelectedBlock(null)
      setBlockForm(null)
      onSaved?.(data)
    } catch (e) {
      setError(e.message || 'Could not load textbook page.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitial() {
      if (!pageId) return
      setLoading(true)
      setError('')
      try {
        const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${pageId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(await readJsonError(res))
        const data = await res.json()
        if (cancelled) return
        setPage(data.page)
        setPageForm(pageToForm(data.page))
        setSections(data.sections || [])
        setBlocks(data.blocks || [])
        setSelectedSection(null)
        setSectionForm(null)
        setSelectedBlock(null)
        setBlockForm(null)
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load textbook page.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadInitial()
    return () => { cancelled = true }
  }, [API_BASE, pageId])

  async function savePage(e) {
    e.preventDefault()
    if (!pageId || !pageForm) return
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${pageId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: pageForm.title,
          slug: pageForm.slug,
          summary: pageForm.summary || null,
          status: pageForm.status,
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      await loadPage(pageId)
    } catch (e) {
      setError(e.message || 'Could not save page.')
    } finally {
      setSaving(false)
    }
  }

  function chooseSection(section) {
    setSelectedSection(section)
    setSectionForm({
      title: section.title || '',
      anchor_slug: section.anchor_slug || '',
      section_type: section.section_type || 'custom',
      position: section.position || 1,
    })
  }

  async function saveSection(e) {
    e.preventDefault()
    if (!selectedSection || !sectionForm) return
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/sections/${selectedSection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...sectionForm,
          position: Number(sectionForm.position),
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      await loadPage(pageId)
    } catch (e) {
      setError(e.message || 'Could not save section.')
    } finally {
      setSaving(false)
    }
  }

  function chooseBlock(block) {
    setSelectedBlock(block)
    setBlockForm({
      block_type: block.block_type || 'markdown',
      content: block.content || '',
      data: block.data ? JSON.stringify(block.data, null, 2) : '{}',
      position: block.position || 1,
    })
  }

  async function saveBlock(e) {
    e.preventDefault()
    if (!selectedBlock || !blockForm) return
    setSaving(true)
    setError('')
    try {
      const data = blockForm.data.trim() ? JSON.parse(blockForm.data) : {}
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${selectedBlock.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          block_type: blockForm.block_type,
          content: blockForm.content || null,
          data,
          position: Number(blockForm.position),
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      await loadPage(pageId)
    } catch (e) {
      setError(e.message || 'Could not save block.')
    } finally {
      setSaving(false)
    }
  }

  if (!pageId) return <p className="admin__muted">Select a textbook page to edit.</p>
  if (loading && !pageForm) return <LoadingScreen message="Loading textbook editor..." inline />

  return (
    <div className="admin-inline-editor">
      {page && <p className="admin__muted admin-inline-editor__context">{page.slug} · {page.status}</p>}
      {error && <div className="admin-alert">{error}</div>}
      {!pageForm ? (
        <p className="admin__muted">Textbook editor unavailable.</p>
      ) : (
        <>
          <form className="admin-form" onSubmit={savePage}>
            <label>Title<input value={pageForm.title} onChange={(e) => setPageForm({ ...pageForm, title: e.target.value })} /></label>
            <label>Slug<input value={pageForm.slug} onChange={(e) => setPageForm({ ...pageForm, slug: e.target.value })} /></label>
            <label>Status<select value={pageForm.status} onChange={(e) => setPageForm({ ...pageForm, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select></label>
            <label>Summary<textarea rows={4} value={pageForm.summary} onChange={(e) => setPageForm({ ...pageForm, summary: e.target.value })} /></label>
            <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save page'}</button>
          </form>

          <div className="admin-editor-split">
            <div>
              <h2>Sections</h2>
              <div className="admin-list admin-list--compact">
                {sections.map((section) => (
                  <button key={section.id} type="button" className={selectedSection?.id === section.id ? 'is-active' : ''} onClick={() => chooseSection(section)}>
                    <span>{section.position}. {section.title}</span>
                    <small>{section.anchor_slug}</small>
                  </button>
                ))}
              </div>
              {sectionForm && (
                <form className="admin-form admin-form--small" onSubmit={saveSection}>
                  <label>Section title<input value={sectionForm.title} onChange={(e) => setSectionForm({ ...sectionForm, title: e.target.value })} /></label>
                  <label>Anchor slug<input value={sectionForm.anchor_slug} onChange={(e) => setSectionForm({ ...sectionForm, anchor_slug: e.target.value })} /></label>
                  <label>Type<input value={sectionForm.section_type} onChange={(e) => setSectionForm({ ...sectionForm, section_type: e.target.value })} /></label>
                  <label>Position<input type="number" min="1" value={sectionForm.position} onChange={(e) => setSectionForm({ ...sectionForm, position: e.target.value })} /></label>
                  <button type="submit" disabled={saving}>Save section</button>
                </form>
              )}
            </div>
            <div>
              <h2>Blocks</h2>
              <div className="admin-list admin-list--compact">
                {blocks.map((block) => (
                  <button key={block.id} type="button" className={selectedBlock?.id === block.id ? 'is-active' : ''} onClick={() => chooseBlock(block)}>
                    <span>{block.position}. {block.block_type}</span>
                    <small>{sectionById.get(block.section_id)?.title || 'Unknown section'}</small>
                  </button>
                ))}
              </div>
              {blockForm && (
                <form className="admin-form admin-form--small" onSubmit={saveBlock}>
                  <label>Block type<input value={blockForm.block_type} onChange={(e) => setBlockForm({ ...blockForm, block_type: e.target.value })} /></label>
                  <label>Position<input type="number" min="1" value={blockForm.position} onChange={(e) => setBlockForm({ ...blockForm, position: e.target.value })} /></label>
                  <label>Content<textarea rows={10} value={blockForm.content} onChange={(e) => setBlockForm({ ...blockForm, content: e.target.value })} /></label>
                  <label>Data JSON<textarea rows={6} value={blockForm.data} onChange={(e) => setBlockForm({ ...blockForm, data: e.target.value })} /></label>
                  <button type="submit" disabled={saving}>Save block</button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
