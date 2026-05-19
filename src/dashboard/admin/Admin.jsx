import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { AdminQuestionInlineEditor, AdminTextbookInlineEditor } from './AdminEditors'
import './Admin.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function readJsonError(res) {
  const json = await res.json().catch(() => ({}))
  return json?.error ? JSON.stringify(json.error) : 'Request failed'
}

function formatCategory(category) {
  return String(category || 'other')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

function formatDate(value) {
  if (!value) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return String(value)
  }
}

export default function Admin() {
  const { user } = useOutletContext()
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin
  const [activeTab, setActiveTab] = useState('question-issues')

  const [mockSlug, setMockSlug] = useState('')
  const [mockTitle, setMockTitle] = useState('')
  const [mockDescription, setMockDescription] = useState('')
  const [mockDurationMinutes, setMockDurationMinutes] = useState(180)
  const [mockReplaceExisting, setMockReplaceExisting] = useState(true)
  const [mockStudentFile, setMockStudentFile] = useState(null)
  const [mockKeyFile, setMockKeyFile] = useState(null)
  const [mockImportBusy, setMockImportBusy] = useState(false)
  const [mockImportMsg, setMockImportMsg] = useState('')
  const [checking, setChecking] = useState(true)
  const [serverAllowsAdmin, setServerAllowsAdmin] = useState(false)
  const [error, setError] = useState('')

  const [questionIssues, setQuestionIssues] = useState([])
  const [topicIssues, setTopicIssues] = useState([])
  const [issuesLoading, setIssuesLoading] = useState(false)
  const [includeCompleted, setIncludeCompleted] = useState(false)
  const [selectedQuestionIssue, setSelectedQuestionIssue] = useState(null)
  const [selectedTopicIssue, setSelectedTopicIssue] = useState(null)

  const statusQuery = includeCompleted ? 'all' : 'ongoing'

  const activeIssues = activeTab === 'question-issues' ? questionIssues : topicIssues

  /** After refresh, keep selection only if row still appears in the fetched list */
  const reconcileSelections = useCallback((nextQuestion, nextTopic) => {
    setSelectedQuestionIssue((curr) => {
      if (!curr) return nextQuestion[0] || null
      const found = nextQuestion.find((x) => x.id === curr.id)
      return found ?? (nextQuestion[0] || null)
    })
    setSelectedTopicIssue((curr) => {
      if (!curr) return nextTopic[0] || null
      const found = nextTopic.find((x) => x.id === curr.id)
      return found ?? (nextTopic[0] || null)
    })
  }, [])

  const selectedTopicPageId = useMemo(() => {
    if (!selectedTopicIssue) return null
    return selectedTopicIssue.page_id || selectedTopicIssue.page?.id || null
  }, [selectedTopicIssue])

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

  const loadIssues = useCallback(async () => {
    setIssuesLoading(true)
    setError('')
    try {
      const qs = `limit=100&status=${encodeURIComponent(statusQuery)}`
      const [questionRes, topicRes] = await Promise.all([
        authenticatedFetch(`${API_BASE}/admin/question-issues?${qs}`, { cache: 'no-store' }),
        authenticatedFetch(`${API_BASE}/admin/topic-issues?${qs}`, { cache: 'no-store' }),
      ])
      if (!questionRes.ok) throw new Error(await readJsonError(questionRes))
      if (!topicRes.ok) throw new Error(await readJsonError(topicRes))
      const [questionData, topicData] = await Promise.all([questionRes.json(), topicRes.json()])
      const nextQuestionIssues = questionData.issues || []
      const nextTopicIssues = topicData.issues || []
      setQuestionIssues(nextQuestionIssues)
      setTopicIssues(nextTopicIssues)
      reconcileSelections(nextQuestionIssues, nextTopicIssues)
    } catch (e) {
      setError(e.message || 'Could not load reported issues.')
    } finally {
      setIssuesLoading(false)
    }
  }, [API_BASE, statusQuery, reconcileSelections])

  const patchIssueStatus = useCallback(
    async (kind, issueId, status) => {
      const path =
        kind === 'question'
          ? `${API_BASE}/admin/question-issues/${encodeURIComponent(String(issueId))}`
          : `${API_BASE}/admin/topic-issues/${encodeURIComponent(String(issueId))}`
      const res = await authenticatedFetch(path, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      await loadIssues()
    },
    [API_BASE, loadIssues]
  )

  const submitMockPaperImport = useCallback(async () => {
    setMockImportMsg('')
    if (!mockSlug.trim() || !mockTitle.trim()) {
      setMockImportMsg('Slug and title are required.')
      return
    }
    if (!mockStudentFile || !mockKeyFile) {
      setMockImportMsg('Choose both JSON files: student paper and answer key.')
      return
    }
    setMockImportBusy(true)
    try {
      let student
      let answer_key
      try {
        student = JSON.parse(await mockStudentFile.text())
      } catch {
        throw new Error('Student file is not valid JSON.')
      }
      try {
        answer_key = JSON.parse(await mockKeyFile.text())
      } catch {
        throw new Error('Answer key file is not valid JSON.')
      }
      const res = await authenticatedFetch(`${API_BASE}/admin/mock-papers/import`, {
        method: 'POST',
        body: JSON.stringify({
          slug: mockSlug.trim().toLowerCase(),
          title: mockTitle.trim(),
          description: mockDescription.trim() || null,
          duration_minutes: mockDurationMinutes,
          replace_existing: mockReplaceExisting,
          student,
          answer_key,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || res.statusText || 'Import failed')
      setMockImportMsg(`Created mock paper "${data.slug}" with ${data.questionCount} questions (id: ${data.mockPaperId}).`)
    } catch (e) {
      setMockImportMsg(e.message || 'Import failed')
    } finally {
      setMockImportBusy(false)
    }
  }, [
    API_BASE,
    mockSlug,
    mockTitle,
    mockDescription,
    mockDurationMinutes,
    mockReplaceExisting,
    mockStudentFile,
    mockKeyFile,
  ])

  useEffect(() => {
    if (!serverAllowsAdmin) return
    if (activeTab === 'mock-papers') return
    loadIssues()
  }, [serverAllowsAdmin, loadIssues, activeTab])

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
          <h1 className="admin__title">
            {activeTab === 'mock-papers' ? 'Import mock exam' : 'Admin Issues'}
          </h1>
          <p className="admin__muted">
            {activeTab === 'mock-papers'
              ? 'Upload the same JSON pair used by the backend seed script (student stems/options + answer key). Creates catalog row, questions, and solutions.'
              : 'Review user-reported issues, then edit the related question or textbook page.'}
          </p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      {error && activeTab !== 'mock-papers' && <div className="admin-alert">{error}</div>}

      <div className="admin-tabs">
        <button type="button" className={activeTab === 'question-issues' ? 'is-active' : ''} onClick={() => setActiveTab('question-issues')}>
          Question Issues
        </button>
        <button type="button" className={activeTab === 'topic-issues' ? 'is-active' : ''} onClick={() => setActiveTab('topic-issues')}>
          Textbook Issues
        </button>
        <button type="button" className={activeTab === 'mock-papers' ? 'is-active' : ''} onClick={() => setActiveTab('mock-papers')}>
          Mock papers
        </button>
        {activeTab !== 'mock-papers' && (
          <>
            <label className="admin-tabs__toggle">
              <input
                type="checkbox"
                checked={includeCompleted}
                onChange={(e) => setIncludeCompleted(e.target.checked)}
              />
              Include completed
            </label>
            <button type="button" onClick={loadIssues} disabled={issuesLoading}>
              {issuesLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </>
        )}
      </div>

      {activeTab === 'mock-papers' && (
        <section className="admin-card admin-mock-import">
          <h2 className="admin-mock-import__h2">Required files</h2>
          <ul className="admin-mock-import__list">
            <li>
              <strong>Student paper JSON</strong> — Array of objects: <code>number</code> (question index, 1-based),{' '}
              <code>stem</code> (string), <code>options</code> (object with keys <code>A</code>–<code>E</code>, string values).
            </li>
            <li>
              <strong>Answer key JSON</strong> — Array of objects with matching <code>number</code> for each question;{' '}
              <code>correct_answer</code> must be <code>A</code>, <code>B</code>, <code>C</code>, <code>D</code>, or <code>E</code>.
              Optional fields stored as explanations/metadata: <code>rationale</code> → detailed explanation (L2),{' '}
              <code>simplified_explanation</code> → ELI5, plus <code>clinical_context</code>, <code>guideline_anchor</code>,{' '}
              <code>exam_tip</code>, <code>topic_id</code>, <code>topic_name</code>, <code>specialty</code>, etc.
            </li>
            <li>
              Every question <code>number</code> must appear in <em>both</em> files. Same format as{' '}
              <code>synapse-backend/mock_paper_001_student.json</code> and{' '}
              <code>synapse-backend/mock_paper_001_answer_key.json</code>.
            </li>
          </ul>

          <div className="admin-mock-import__grid">
            <label className="admin-mock-import__field">
              <span>URL slug</span>
              <input
                type="text"
                value={mockSlug}
                onChange={(e) => setMockSlug(e.target.value)}
                placeholder="e.g. mock-paper-002"
                autoComplete="off"
              />
              <small className="admin__muted">Lowercase letters, numbers, hyphens only. Used in /dashboard/mock-exams/&lt;slug&gt;</small>
            </label>
            <label className="admin-mock-import__field">
              <span>Title</span>
              <input type="text" value={mockTitle} onChange={(e) => setMockTitle(e.target.value)} placeholder="Exam title shown in catalog" />
            </label>
            <label className="admin-mock-import__field admin-mock-import__field--full">
              <span>Description (optional)</span>
              <textarea value={mockDescription} onChange={(e) => setMockDescription(e.target.value)} rows={3} placeholder="Short blurb for the mock exams list" />
            </label>
            <label className="admin-mock-import__field">
              <span>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                max={1440}
                value={mockDurationMinutes}
                onChange={(e) => setMockDurationMinutes(parseInt(e.target.value, 10) || 180)}
              />
            </label>
            <label className="admin-mock-import__field admin-mock-import__checkbox">
              <input
                type="checkbox"
                checked={mockReplaceExisting}
                onChange={(e) => setMockReplaceExisting(e.target.checked)}
              />
              <span>Replace existing paper with this slug (deletes previous mock paper + questions)</span>
            </label>
            <label className="admin-mock-import__field">
              <span>Student paper (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => setMockStudentFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <label className="admin-mock-import__field">
              <span>Answer key (.json)</span>
              <input type="file" accept=".json,application/json" onChange={(e) => setMockKeyFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>

          <div className="admin-mock-import__actions">
            <button type="button" className="admin-btn-issue" disabled={mockImportBusy} onClick={submitMockPaperImport}>
              {mockImportBusy ? 'Importing…' : 'Create mock paper in database'}
            </button>
          </div>
          {mockImportMsg && (
            <div className={mockImportMsg.startsWith('Created') ? 'admin-alert admin-alert--success' : 'admin-alert'}>
              {mockImportMsg}
            </div>
          )}
        </section>
      )}

      {activeTab !== 'mock-papers' && (
      <div className="admin-grid">
        <section className="admin-card">
          {issuesLoading ? (
            <LoadingScreen message="Loading reported issues..." inline />
          ) : activeIssues.length === 0 ? (
            <p className="admin__muted">
              {includeCompleted ? 'No reported issues in the archive yet.' : 'No ongoing issues.'}
            </p>
          ) : (
            <div className="admin-list admin-issue-list">
              {activeTab === 'question-issues' && questionIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={selectedQuestionIssue?.id === issue.id ? 'is-active' : ''}
                  onClick={() => setSelectedQuestionIssue(issue)}
                >
                  <span className="admin-issue-list__title">
                    <span>{formatCategory(issue.category)}</span>
                    {(issue.status || 'ongoing') === 'complete' ? (
                      <span className="admin-issue-pill admin-issue-pill--done">Done</span>
                    ) : (
                      <span className="admin-issue-pill admin-issue-pill--open">Ongoing</span>
                    )}
                  </span>
                  <small>{issue.topic?.name || 'No topic'} · {formatDate(issue.created_at)}</small>
                  <p>{issue.details || 'No details provided.'}</p>
                </button>
              ))}
              {activeTab === 'topic-issues' && topicIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={selectedTopicIssue?.id === issue.id ? 'is-active' : ''}
                  onClick={() => setSelectedTopicIssue(issue)}
                >
                  <span className="admin-issue-list__title">
                    <span>{formatCategory(issue.category)}</span>
                    {(issue.status || 'ongoing') === 'complete' ? (
                      <span className="admin-issue-pill admin-issue-pill--done">Done</span>
                    ) : (
                      <span className="admin-issue-pill admin-issue-pill--open">Ongoing</span>
                    )}
                  </span>
                  <small>{issue.topic?.name || issue.page?.title || 'No topic'} · {formatDate(issue.created_at)}</small>
                  <p>{issue.details || 'No details provided.'}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          {activeTab === 'question-issues' && (
            selectedQuestionIssue ? (
              <>
                <div className="admin-issue-summary">
                  <div className="admin-issue-summary__head">
                    <h2>{formatCategory(selectedQuestionIssue.category)}</h2>
                    <div className="admin-issue-actions">
                      {(selectedQuestionIssue.status || 'ongoing') === 'complete' ? (
                        <>
                          <span className="admin-issue-pill admin-issue-pill--done">Complete</span>
                          {includeCompleted && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--ghost"
                              disabled={issuesLoading}
                              onClick={() =>
                                patchIssueStatus('question', selectedQuestionIssue.id, 'ongoing').catch((err) =>
                                  setError(err?.message || 'Could not reopen issue.')
                                )}
                            >
                              Re-open
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-issue"
                          disabled={issuesLoading}
                          onClick={() =>
                            patchIssueStatus('question', selectedQuestionIssue.id, 'complete').catch((err) =>
                              setError(err?.message || 'Could not complete issue.')
                            )}
                        >
                          Mark complete
                        </button>
                      )}
                    </div>
                  </div>
                  <p>{selectedQuestionIssue.details || 'No details provided.'}</p>
                  {selectedQuestionIssue.question?.stem && <small>{selectedQuestionIssue.question.stem}</small>}
                </div>
                {selectedQuestionIssue.question_id ? (
                  <AdminQuestionInlineEditor
                    questionId={selectedQuestionIssue.question_id}
                    initialQuestion={selectedQuestionIssue.question}
                    API_BASE={API_BASE}
                  />
                ) : (
                  <p className="admin__muted">This issue is not linked to a question row.</p>
                )}
              </>
            ) : (
              <p className="admin__muted">Select a question issue to inspect or edit.</p>
            )
          )}

          {activeTab === 'topic-issues' && (
            selectedTopicIssue ? (
              <>
                <div className="admin-issue-summary">
                  <div className="admin-issue-summary__head">
                    <h2>{formatCategory(selectedTopicIssue.category)}</h2>
                    <div className="admin-issue-actions">
                      {(selectedTopicIssue.status || 'ongoing') === 'complete' ? (
                        <>
                          <span className="admin-issue-pill admin-issue-pill--done">Complete</span>
                          {includeCompleted && (
                            <button
                              type="button"
                              className="admin-btn-issue admin-btn-issue--ghost"
                              disabled={issuesLoading}
                              onClick={() =>
                                patchIssueStatus('topic', selectedTopicIssue.id, 'ongoing').catch((err) =>
                                  setError(err?.message || 'Could not reopen issue.')
                                )}
                            >
                              Re-open
                            </button>
                          )}
                        </>
                      ) : (
                        <button
                          type="button"
                          className="admin-btn-issue"
                          disabled={issuesLoading}
                          onClick={() =>
                            patchIssueStatus('topic', selectedTopicIssue.id, 'complete').catch((err) =>
                              setError(err?.message || 'Could not complete issue.')
                            )}
                        >
                          Mark complete
                        </button>
                      )}
                    </div>
                  </div>
                  <p>{selectedTopicIssue.details || 'No details provided.'}</p>
                  <small>{selectedTopicIssue.topic?.name || selectedTopicIssue.page?.title || 'Textbook topic'}</small>
                </div>
                {selectedTopicPageId ? (
                  <AdminTextbookInlineEditor pageId={selectedTopicPageId} API_BASE={API_BASE} />
                ) : (
                  <p className="admin__muted">No textbook page linked to this topic.</p>
                )}
              </>
            ) : (
              <p className="admin__muted">Select a textbook issue to inspect or edit.</p>
            )
          )}
        </section>
      </div>
      )}
    </div>
  )
}
