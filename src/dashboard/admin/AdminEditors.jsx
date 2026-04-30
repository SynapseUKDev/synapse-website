import React, { useEffect, useMemo, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Admin.css'

function normaliseOptions(options) {
  if (Array.isArray(options)) {
    return options.map((option) => {
      if (typeof option === 'string') return option
      if (option && typeof option === 'object') {
        return option.body || option.text || option.label || ''
      }
      return String(option ?? '')
    }).filter(Boolean)
  }
  if (typeof options === 'string' && options.trim()) {
    try {
      const parsed = JSON.parse(options)
      return normaliseOptions(parsed)
    } catch {
      return []
    }
  }
  return []
}

async function readJsonError(res) {
  const json = await res.json().catch(() => ({}))
  return json?.error ? JSON.stringify(json.error) : 'Request failed'
}

function questionToForm(question) {
  return {
    stem: question?.stem || '',
    optionsText: normaliseOptions(question?.options).join('\n'),
    correct_answer: question?.correct_answer ?? '',
    difficulty: question?.difficulty ?? '',
    is_active: !!question?.is_active,
    explanation_l2: question?.explanation_l2 || question?.explanations?.detailed || '',
    explanation_eli5: question?.explanation_eli5 || question?.explanations?.eli5 || '',
    explanation_points_by_option: question?.explanation_points_by_option
      ? JSON.stringify(question.explanation_points_by_option, null, 2)
      : question?.explanations?.points_by_option
        ? JSON.stringify(question.explanations.points_by_option, null, 2)
        : '',
  }
}

export function AdminQuestionInlineEditor({ questionId, initialQuestion = null, API_BASE, onSaved }) {
  const [question, setQuestion] = useState(initialQuestion)
  const [form, setForm] = useState(initialQuestion ? questionToForm(initialQuestion) : null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function loadQuestion() {
      if (!questionId) return
      setLoading(true)
      setError('')
      try {
        const res = await authenticatedFetch(`${API_BASE}/admin/questions/${questionId}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(await readJsonError(res))
        const data = await res.json()
        if (cancelled) return
        setQuestion(data.question)
        setForm(questionToForm(data.question))
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load question.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadQuestion()
    return () => { cancelled = true }
  }, [API_BASE, questionId])

  async function saveQuestion(e) {
    e.preventDefault()
    if (!questionId || !form) return
    setSaving(true)
    setError('')
    try {
      let pointsByOption = null
      if (form.explanation_points_by_option.trim()) {
        pointsByOption = JSON.parse(form.explanation_points_by_option)
      }

      const options = form.optionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const payload = {
        stem: form.stem,
        options,
        correct_answer: form.correct_answer === '' ? null : Number(form.correct_answer),
        difficulty: form.difficulty === '' ? null : Number(form.difficulty),
        is_active: form.is_active,
        explanation_l2: form.explanation_l2 || null,
        explanation_eli5: form.explanation_eli5 || null,
        explanation_points_by_option: pointsByOption,
      }

      const res = await authenticatedFetch(`${API_BASE}/admin/questions/${questionId}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setQuestion(data.question)
      setForm(questionToForm(data.question))
      onSaved?.(data.question)
    } catch (e) {
      setError(e.message || 'Could not save question.')
    } finally {
      setSaving(false)
    }
  }

  if (!questionId) return <p className="admin__muted">Select a question to edit.</p>
  if (loading && !form) return <LoadingScreen message="Loading question editor..." inline />

  return (
    <div className="admin-inline-editor">
      {question?.topics && (
        <p className="admin__muted admin-inline-editor__context">
          {question.topics?.specialties?.name ? `${question.topics.specialties.name} · ` : ''}{question.topics?.name}
        </p>
      )}
      {error && <div className="admin-alert">{error}</div>}
      {!form ? (
        <p className="admin__muted">Question editor unavailable.</p>
      ) : (
        <form className="admin-form" onSubmit={saveQuestion}>
          <label>Stem<textarea rows={6} value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} /></label>
          <label>Options, one per line<textarea rows={5} value={form.optionsText} onChange={(e) => setForm({ ...form, optionsText: e.target.value })} /></label>
          <div className="admin-form__row">
            <label>Correct answer index<input type="number" min="0" value={form.correct_answer} onChange={(e) => setForm({ ...form, correct_answer: e.target.value })} /></label>
            <label>Difficulty<input type="number" min="1" max="5" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} /></label>
          </div>
          <label className="admin-check"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Active</label>
          <label>Detailed explanation<textarea rows={7} value={form.explanation_l2} onChange={(e) => setForm({ ...form, explanation_l2: e.target.value })} /></label>
          <label>ELI5 explanation<textarea rows={4} value={form.explanation_eli5} onChange={(e) => setForm({ ...form, explanation_eli5: e.target.value })} /></label>
          <label>Explanation points by option JSON<textarea rows={6} value={form.explanation_points_by_option} onChange={(e) => setForm({ ...form, explanation_points_by_option: e.target.value })} /></label>
          <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save question'}</button>
        </form>
      )}
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
