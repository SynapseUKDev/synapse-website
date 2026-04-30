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
  const [selectedQuestionIssue, setSelectedQuestionIssue] = useState(null)
  const [selectedTopicIssue, setSelectedTopicIssue] = useState(null)

  const activeIssues = activeTab === 'question-issues' ? questionIssues : topicIssues

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
      const [questionRes, topicRes] = await Promise.all([
        authenticatedFetch(`${API_BASE}/admin/question-issues?limit=100`, { cache: 'no-store' }),
        authenticatedFetch(`${API_BASE}/admin/topic-issues?limit=100`, { cache: 'no-store' }),
      ])
      if (!questionRes.ok) throw new Error(await readJsonError(questionRes))
      if (!topicRes.ok) throw new Error(await readJsonError(topicRes))
      const [questionData, topicData] = await Promise.all([questionRes.json(), topicRes.json()])
      const nextQuestionIssues = questionData.issues || []
      const nextTopicIssues = topicData.issues || []
      setQuestionIssues(nextQuestionIssues)
      setTopicIssues(nextTopicIssues)
      setSelectedQuestionIssue((current) => current || nextQuestionIssues[0] || null)
      setSelectedTopicIssue((current) => current || nextTopicIssues[0] || null)
    } catch (e) {
      setError(e.message || 'Could not load reported issues.')
    } finally {
      setIssuesLoading(false)
    }
  }, [])

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
        <button type="button" onClick={loadIssues} disabled={issuesLoading}>
          {issuesLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          {issuesLoading ? (
            <LoadingScreen message="Loading reported issues..." inline />
          ) : activeIssues.length === 0 ? (
            <p className="admin__muted">No reported issues yet.</p>
          ) : (
            <div className="admin-list admin-issue-list">
              {activeTab === 'question-issues' && questionIssues.map((issue) => (
                <button
                  key={issue.id}
                  type="button"
                  className={selectedQuestionIssue?.id === issue.id ? 'is-active' : ''}
                  onClick={() => setSelectedQuestionIssue(issue)}
                >
                  <span>{formatCategory(issue.category)}</span>
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
                  <span>{formatCategory(issue.category)}</span>
                  <small>{issue.topic?.name || issue.page?.title || 'No topic'} · {formatDate(issue.created_at)}</small>
                  <p>{issue.details || 'No details provided.'}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          {activeTab === 'question-issues' && (
            selectedQuestionIssue?.question_id ? (
              <>
                <div className="admin-issue-summary">
                  <h2>{formatCategory(selectedQuestionIssue.category)}</h2>
                  <p>{selectedQuestionIssue.details || 'No details provided.'}</p>
                  {selectedQuestionIssue.question?.stem && <small>{selectedQuestionIssue.question.stem}</small>}
                </div>
                <AdminQuestionInlineEditor
                  questionId={selectedQuestionIssue.question_id}
                  initialQuestion={selectedQuestionIssue.question}
                  API_BASE={API_BASE}
                />
              </>
            ) : (
              <p className="admin__muted">Select a question issue to edit its question.</p>
            )
          )}

          {activeTab === 'topic-issues' && (
            selectedTopicPageId ? (
              <>
                <div className="admin-issue-summary">
                  <h2>{formatCategory(selectedTopicIssue.category)}</h2>
                  <p>{selectedTopicIssue.details || 'No details provided.'}</p>
                  <small>{selectedTopicIssue.topic?.name || selectedTopicIssue.page?.title || 'Textbook topic'}</small>
                </div>
                <AdminTextbookInlineEditor
                  pageId={selectedTopicPageId}
                  API_BASE={API_BASE}
                />
              </>
            ) : (
              <div>
                <p className="admin__muted">Select a textbook issue with a linked page to edit it.</p>
                {selectedTopicIssue && (
                  <div className="admin-issue-summary">
                    <h2>{formatCategory(selectedTopicIssue.category)}</h2>
                    <p>{selectedTopicIssue.details || 'No details provided.'}</p>
                    <small>{selectedTopicIssue.topic?.name || 'No linked topic'}</small>
                  </div>
                )}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  )
}
