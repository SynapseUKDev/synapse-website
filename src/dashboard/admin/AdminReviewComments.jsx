import React, { useEffect, useState, useCallback } from 'react'
import { authHeaders } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { AdminQuestionInlineEditor, AdminTextbookInlineEditor } from './AdminEditors'
import './Admin.css'

export default function AdminReviewComments({ API_BASE, defaultContentType = null }) {
  const [activeTab, setActiveTab] = useState(defaultContentType || 'qbank_question')
  const [comments, setComments] = useState([])
  const [selectedComment, setSelectedComment] = useState(null)
  const [loading, setLoading] = useState(false)
  const [patching, setPatching] = useState(false)
  const [error, setError] = useState('')
  const [includeCompleted, setIncludeCompleted] = useState(false)

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const status = includeCompleted ? 'all' : 'pending'
      const res = await fetch(
        `${API_BASE}/admin/review-comments?content_type=${activeTab}&status=${status}`,
        {
          headers: authHeaders(),
          credentials: 'include',
        }
      )
      if (!res.ok) {
        throw new Error('Failed to fetch review comments')
      }
      const data = await res.json()
      setComments(data.comments || [])
      
      // Reselect if already selected is still in the list, otherwise select first or null
      if (selectedComment) {
        const found = (data.comments || []).find((c) => c.id === selectedComment.id)
        if (found) {
          setSelectedComment(found)
        } else {
          setSelectedComment(null)
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load review comments.')
    } finally {
      setLoading(false)
    }
  }, [API_BASE, activeTab, includeCompleted, selectedComment])

  useEffect(() => {
    fetchComments()
  }, [activeTab, includeCompleted])

  const handleStatusChange = async (commentId, newStatus) => {
    setPatching(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/admin/review-comments/${commentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error || 'Failed to update review comment status')
      }
      const data = await res.json()
      
      // Update local state
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, ...data.comment } : c))
      )
      setSelectedComment((prev) =>
        prev && prev.id === commentId ? { ...prev, ...data.comment } : prev
      )
    } catch (err) {
      setError(err.message || 'Could not update comment status.')
    } finally {
      setPatching(false)
    }
  }

  const formatContentType = (type) => {
    switch (type) {
      case 'qbank_question':
        return 'QBank Question'
      case 'textbook_page':
        return 'Textbook Page'
      case 'osce_station':
        return 'OSCE Station'
      case 'mock_paper_question':
        return 'Mock Exam Question'
      default:
        return type
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="admin-review-comments">
      {error && <div className="admin-alert">{error}</div>}

      <div className="admin-tabs">
        {!defaultContentType ? (
          <>
            <button
              type="button"
              className={activeTab === 'qbank_question' ? 'is-active' : ''}
              onClick={() => {
                setActiveTab('qbank_question')
                setSelectedComment(null)
              }}
            >
              QBank
            </button>
            <button
              type="button"
              className={activeTab === 'textbook_page' ? 'is-active' : ''}
              onClick={() => {
                setActiveTab('textbook_page')
                setSelectedComment(null)
              }}
            >
              Textbook
            </button>
            <button
              type="button"
              className={activeTab === 'osce_station' ? 'is-active' : ''}
              onClick={() => {
                setActiveTab('osce_station')
                setSelectedComment(null)
              }}
            >
              OSCE
            </button>
            <button
              type="button"
              className={activeTab === 'mock_paper_question' ? 'is-active' : ''}
              onClick={() => {
                setActiveTab('mock_paper_question')
                setSelectedComment(null)
              }}
            >
              Mock Papers
            </button>
          </>
        ) : (
          <span style={{ fontSize: '14px', fontWeight: 800, color: '#92400e', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
            Reviewer Feedback Comments
          </span>
        )}

        <div className="admin-tabs__toggle" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={includeCompleted}
              onChange={(e) => setIncludeCompleted(e.target.checked)}
            />
            Include completed
          </label>
          <button
            type="button"
            className="admin-btn-issue admin-btn-issue--ghost"
            style={{ padding: '4px 10px', height: 'auto', fontSize: '12px' }}
            onClick={fetchComments}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="admin-grid">
        <section className="admin-card">
          {loading && comments.length === 0 ? (
            <LoadingScreen message="Loading review comments..." inline />
          ) : comments.length === 0 ? (
            <p className="admin__muted">
              {includeCompleted ? 'No review comments in this category yet.' : 'No pending review comments.'}
            </p>
          ) : (
            <div className="admin-list admin-issue-list">
              {comments.map((comment) => (
                <button
                  key={comment.id}
                  type="button"
                  className={selectedComment?.id === comment.id ? 'is-active' : ''}
                  onClick={() => setSelectedComment(comment)}
                >
                  <span className="admin-issue-list__title">
                    <span>{comment.reviewer?.username || comment.reviewer?.email || 'Reviewer'}</span>
                    {comment.status === 'complete' ? (
                      <span className="admin-issue-pill admin-issue-pill--done">Done</span>
                    ) : (
                      <span className="admin-issue-pill admin-issue-pill--open">Pending</span>
                    )}
                  </span>
                  <small>
                    {comment.content_title || formatContentType(comment.content_type)} · {formatDate(comment.created_at)}
                  </small>
                  {comment.quote && (
                    <blockquote style={{ margin: '4px 0', paddingLeft: '8px', borderLeft: '2px solid var(--syn-border)', fontStyle: 'italic', fontSize: '12px', color: 'var(--syn-muted)' }}>
                      "{comment.quote.length > 80 ? comment.quote.slice(0, 80) + '…' : comment.quote}"
                    </blockquote>
                  )}
                  <p>{comment.comment_text}</p>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="admin-card">
          {selectedComment ? (
            <>
              <div className="admin-issue-summary" style={{ borderBottom: '1px solid var(--syn-border)', paddingBottom: '16px', marginBottom: '16px' }}>
                <div className="admin-issue-summary__head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h2>Review Comment</h2>
                    <small style={{ color: 'var(--syn-muted)', display: 'block', marginTop: '4px' }}>
                      Submitted by <strong>{selectedComment.reviewer?.username || selectedComment.reviewer?.email || 'Reviewer'}</strong> on {formatDate(selectedComment.created_at)}
                    </small>
                  </div>
                  <div className="admin-issue-actions">
                    {selectedComment.status === 'complete' ? (
                      <>
                        <span className="admin-issue-pill admin-issue-pill--done" style={{ marginRight: '8px' }}>Complete</span>
                        <button
                          type="button"
                          className="admin-btn-issue admin-btn-issue--ghost"
                          disabled={patching}
                          onClick={() => handleStatusChange(selectedComment.id, 'pending')}
                        >
                          Re-open
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="admin-btn-issue"
                        disabled={patching}
                        onClick={() => handleStatusChange(selectedComment.id, 'complete')}
                      >
                        Mark complete
                      </button>
                    )}
                  </div>
                </div>

                {selectedComment.quote && (
                  <div style={{ marginTop: '16px' }}>
                    <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--syn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Selected Text</h3>
                    <blockquote style={{ margin: 0, padding: '10px 14px', background: 'var(--surface-bg)', borderLeft: '4px solid #f59e0b', borderRadius: '4px', fontSize: '13px', fontStyle: 'italic' }}>
                      "{selectedComment.quote}"
                    </blockquote>
                  </div>
                )}

                <div style={{ marginTop: '16px' }}>
                  <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--syn-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Reviewer's Notes</h3>
                  <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5 }}>{selectedComment.comment_text}</p>
                </div>
              </div>

              {selectedComment.content_type === 'qbank_question' && (
                <AdminQuestionInlineEditor
                  questionId={selectedComment.content_id}
                  API_BASE={API_BASE}
                />
              )}

              {selectedComment.content_type === 'textbook_page' && (
                <AdminTextbookInlineEditor
                  pageId={selectedComment.content_id}
                  API_BASE={API_BASE}
                />
              )}

              {selectedComment.content_type === 'osce_station' && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>OSCE Station: {selectedComment.content_title || 'Untitled Station'}</p>
                  <p className="admin__muted" style={{ fontSize: '13px' }}>
                    OSCE Stations are fully structured scenarios. To edit this station, please go to the <strong>OSCE Stations</strong> tab above.
                  </p>
                </div>
              )}

              {selectedComment.content_type === 'mock_paper_question' && (
                <div style={{ padding: '20px 0', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, marginBottom: '8px' }}>Mock Exam Question Reference: {selectedComment.content_title || 'Untitled'}</p>
                  <p className="admin__muted" style={{ fontSize: '13px' }}>
                    Mock exams have static multi-paper configurations. To edit mock exam questions, please edit the original source files and re-import.
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="admin__muted" style={{ textAlign: 'center', padding: '40px 0' }}>
              Select a review comment to inspect details and edit content.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
