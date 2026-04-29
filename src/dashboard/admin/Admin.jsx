import React, { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './Admin.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function normaliseOptions(options) {
  if (Array.isArray(options)) return options
  if (typeof options === 'string' && options.trim()) {
    try {
      const parsed = JSON.parse(options)
      return Array.isArray(parsed) ? parsed : []
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

export default function Admin() {
  const { user } = useOutletContext()
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin
  const [activeTab, setActiveTab] = useState('questions')
  const [checking, setChecking] = useState(true)
  const [serverAllowsAdmin, setServerAllowsAdmin] = useState(false)
  const [error, setError] = useState('')

  const [questionSearch, setQuestionSearch] = useState('')
  const [questions, setQuestions] = useState([])
  const [questionLoading, setQuestionLoading] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [questionForm, setQuestionForm] = useState(null)
  const [questionSaving, setQuestionSaving] = useState(false)

  const [pageSearch, setPageSearch] = useState('')
  const [pages, setPages] = useState([])
  const [pagesLoading, setPagesLoading] = useState(false)
  const [selectedPage, setSelectedPage] = useState(null)
  const [pageForm, setPageForm] = useState(null)
  const [sections, setSections] = useState([])
  const [blocks, setBlocks] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [sectionForm, setSectionForm] = useState(null)
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [blockForm, setBlockForm] = useState(null)
  const [textbookSaving, setTextbookSaving] = useState(false)

  const sectionById = useMemo(() => {
    const map = new Map()
    sections.forEach((section) => map.set(section.id, section))
    return map
  }, [sections])

  useEffect(() => {
    let cancelled = false
    async function checkAdmin() {
      if (!isAdmin) {
        setChecking(false)
        return
      }
      try {
        const res = await authenticatedFetch(`${API_BASE}/admin/health`, { cache: 'no-store' })
        if (cancelled) return
        setServerAllowsAdmin(res.ok)
        if (!res.ok) setError(res.status === 403 ? 'Admin access is not enabled for this account.' : await readJsonError(res))
      } catch {
        if (!cancelled) setError('Could not verify admin access.')
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    checkAdmin()
    return () => { cancelled = true }
  }, [isAdmin])

  async function loadQuestions(search = questionSearch) {
    setQuestionLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      const res = await authenticatedFetch(`${API_BASE}/admin/questions?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setQuestions(data.questions || [])
    } catch (e) {
      setError(e.message || 'Could not load questions.')
    } finally {
      setQuestionLoading(false)
    }
  }

  async function selectQuestion(questionId) {
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/questions/${questionId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      const question = data.question
      setSelectedQuestion(question)
      setQuestionForm({
        stem: question.stem || '',
        optionsText: normaliseOptions(question.options).join('\n'),
        correct_answer: question.correct_answer ?? '',
        difficulty: question.difficulty ?? '',
        is_active: !!question.is_active,
        explanation_l2: question.explanation_l2 || '',
        explanation_eli5: question.explanation_eli5 || '',
        explanation_points_by_option: question.explanation_points_by_option
          ? JSON.stringify(question.explanation_points_by_option, null, 2)
          : '',
      })
    } catch (e) {
      setError(e.message || 'Could not load question.')
    }
  }

  async function saveQuestion(e) {
    e.preventDefault()
    if (!selectedQuestion || !questionForm) return
    setQuestionSaving(true)
    setError('')
    try {
      let pointsByOption = null
      if (questionForm.explanation_points_by_option.trim()) {
        pointsByOption = JSON.parse(questionForm.explanation_points_by_option)
      }

      const options = questionForm.optionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)

      const payload = {
        stem: questionForm.stem,
        options,
        correct_answer: questionForm.correct_answer === '' ? null : Number(questionForm.correct_answer),
        difficulty: questionForm.difficulty === '' ? null : Number(questionForm.difficulty),
        is_active: questionForm.is_active,
        explanation_l2: questionForm.explanation_l2 || null,
        explanation_eli5: questionForm.explanation_eli5 || null,
        explanation_points_by_option: pointsByOption,
      }

      const res = await authenticatedFetch(`${API_BASE}/admin/questions/${selectedQuestion.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setSelectedQuestion(data.question)
      await loadQuestions()
    } catch (e) {
      setError(e.message || 'Could not save question.')
    } finally {
      setQuestionSaving(false)
    }
  }

  async function loadPages(search = pageSearch) {
    setPagesLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (search.trim()) params.set('q', search.trim())
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setPages(data.pages || [])
    } catch (e) {
      setError(e.message || 'Could not load textbook pages.')
    } finally {
      setPagesLoading(false)
    }
  }

  async function selectPage(pageId) {
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${pageId}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(await readJsonError(res))
      const data = await res.json()
      setSelectedPage(data.page)
      setPageForm({
        title: data.page.title || '',
        slug: data.page.slug || '',
        summary: data.page.summary || '',
        status: data.page.status || 'draft',
      })
      setSections(data.sections || [])
      setBlocks(data.blocks || [])
      setSelectedSection(null)
      setSectionForm(null)
      setSelectedBlock(null)
      setBlockForm(null)
    } catch (e) {
      setError(e.message || 'Could not load textbook page.')
    }
  }

  async function savePage(e) {
    e.preventDefault()
    if (!selectedPage || !pageForm) return
    setTextbookSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${selectedPage.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: pageForm.title,
          slug: pageForm.slug,
          summary: pageForm.summary || null,
          status: pageForm.status,
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      await selectPage(selectedPage.id)
      await loadPages()
    } catch (e) {
      setError(e.message || 'Could not save page.')
    } finally {
      setTextbookSaving(false)
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
    if (!selectedPage || !selectedSection || !sectionForm) return
    setTextbookSaving(true)
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
      await selectPage(selectedPage.id)
    } catch (e) {
      setError(e.message || 'Could not save section.')
    } finally {
      setTextbookSaving(false)
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
    if (!selectedPage || !selectedBlock || !blockForm) return
    setTextbookSaving(true)
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
      await selectPage(selectedPage.id)
    } catch (e) {
      setError(e.message || 'Could not save block.')
    } finally {
      setTextbookSaving(false)
    }
  }

  useEffect(() => {
    if (!serverAllowsAdmin) return
    loadQuestions('')
    loadPages('')
  }, [serverAllowsAdmin])

  if (checking) {
    return (
      <div className="admin">
        <LoadingScreen message="Checking admin access..." inline />
      </div>
    )
  }

  if (!isAdmin || !serverAllowsAdmin) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Admin</h1>
          <p className="admin__muted">This page is only available to accounts with Supabase Auth app metadata role set to admin.</p>
          {error && <div className="admin-alert">{error}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="admin">
      <div className="admin__header">
        <div>
          <h1 className="admin__title">Admin</h1>
          <p className="admin__muted">Edit live question bank and textbook content. All saves are rechecked on the server.</p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-tabs">
        <button className={activeTab === 'questions' ? 'is-active' : ''} onClick={() => setActiveTab('questions')}>Questions</button>
        <button className={activeTab === 'textbook' ? 'is-active' : ''} onClick={() => setActiveTab('textbook')}>Textbook</button>
      </div>

      {activeTab === 'questions' && (
        <div className="admin-grid">
          <section className="admin-card">
            <form className="admin-search" onSubmit={(e) => { e.preventDefault(); loadQuestions(questionSearch) }}>
              <input value={questionSearch} onChange={(e) => setQuestionSearch(e.target.value)} placeholder="Search question stems" />
              <button type="submit">Search</button>
            </form>
            <div className="admin-list">
              {questionLoading ? <p className="admin__muted">Loading...</p> : questions.map((question) => (
                <button key={question.id} className={selectedQuestion?.id === question.id ? 'is-active' : ''} onClick={() => selectQuestion(question.id)}>
                  <span>{question.stem}</span>
                  <small>{question.topics?.name || 'No topic'} · {question.is_active ? 'Active' : 'Inactive'}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-card">
            {!questionForm ? (
              <p className="admin__muted">Select a question to edit.</p>
            ) : (
              <form className="admin-form" onSubmit={saveQuestion}>
                <label>Stem<textarea rows={6} value={questionForm.stem} onChange={(e) => setQuestionForm({ ...questionForm, stem: e.target.value })} /></label>
                <label>Options, one per line<textarea rows={5} value={questionForm.optionsText} onChange={(e) => setQuestionForm({ ...questionForm, optionsText: e.target.value })} /></label>
                <div className="admin-form__row">
                  <label>Correct answer index<input type="number" min="0" value={questionForm.correct_answer} onChange={(e) => setQuestionForm({ ...questionForm, correct_answer: e.target.value })} /></label>
                  <label>Difficulty<input type="number" min="1" max="5" value={questionForm.difficulty} onChange={(e) => setQuestionForm({ ...questionForm, difficulty: e.target.value })} /></label>
                </div>
                <label className="admin-check"><input type="checkbox" checked={questionForm.is_active} onChange={(e) => setQuestionForm({ ...questionForm, is_active: e.target.checked })} /> Active</label>
                <label>Detailed explanation<textarea rows={7} value={questionForm.explanation_l2} onChange={(e) => setQuestionForm({ ...questionForm, explanation_l2: e.target.value })} /></label>
                <label>ELI5 explanation<textarea rows={4} value={questionForm.explanation_eli5} onChange={(e) => setQuestionForm({ ...questionForm, explanation_eli5: e.target.value })} /></label>
                <label>Explanation points by option JSON<textarea rows={6} value={questionForm.explanation_points_by_option} onChange={(e) => setQuestionForm({ ...questionForm, explanation_points_by_option: e.target.value })} /></label>
                <button type="submit" disabled={questionSaving}>{questionSaving ? 'Saving...' : 'Save question'}</button>
              </form>
            )}
          </section>
        </div>
      )}

      {activeTab === 'textbook' && (
        <div className="admin-grid">
          <section className="admin-card">
            <form className="admin-search" onSubmit={(e) => { e.preventDefault(); loadPages(pageSearch) }}>
              <input value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} placeholder="Search textbook pages" />
              <button type="submit">Search</button>
            </form>
            <div className="admin-list">
              {pagesLoading ? <p className="admin__muted">Loading...</p> : pages.map((page) => (
                <button key={page.id} className={selectedPage?.id === page.id ? 'is-active' : ''} onClick={() => selectPage(page.id)}>
                  <span>{page.title}</span>
                  <small>{page.slug} · {page.status}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="admin-card">
            {!pageForm ? (
              <p className="admin__muted">Select a textbook page to edit.</p>
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
                  <button type="submit" disabled={textbookSaving}>{textbookSaving ? 'Saving...' : 'Save page'}</button>
                </form>

                <div className="admin-editor-split">
                  <div>
                    <h2>Sections</h2>
                    <div className="admin-list admin-list--compact">
                      {sections.map((section) => (
                        <button key={section.id} className={selectedSection?.id === section.id ? 'is-active' : ''} onClick={() => chooseSection(section)}>
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
                        <button type="submit" disabled={textbookSaving}>Save section</button>
                      </form>
                    )}
                  </div>
                  <div>
                    <h2>Blocks</h2>
                    <div className="admin-list admin-list--compact">
                      {blocks.map((block) => (
                        <button key={block.id} className={selectedBlock?.id === block.id ? 'is-active' : ''} onClick={() => chooseBlock(block)}>
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
                        <button type="submit" disabled={textbookSaving}>Save block</button>
                      </form>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
