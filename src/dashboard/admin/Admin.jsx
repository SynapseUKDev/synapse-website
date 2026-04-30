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

  useEffect(() => {
    if (!serverAllowsAdmin) return
    loadIssues()
  }, [serverAllowsAdmin, loadIssues])

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
          <h1 className="admin__title">Admin Issues</h1>
          <p className="admin__muted">Review user-reported issues, then edit the related question or textbook page.</p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-tabs">
        <button className={activeTab === 'question-issues' ? 'is-active' : ''} onClick={() => setActiveTab('question-issues')}>
          Question Issues
        </button>
        <button className={activeTab === 'topic-issues' ? 'is-active' : ''} onClick={() => setActiveTab('topic-issues')}>
          Textbook Issues
        </button>
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
      </div>

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
    </div>
  )
}
