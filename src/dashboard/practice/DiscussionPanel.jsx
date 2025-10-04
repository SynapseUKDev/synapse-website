import React, { useEffect, useRef, useState } from 'react'
import './Practice.css'
import { LuThumbsUp } from 'react-icons/lu'

export default function DiscussionPanel({ questionId, API_BASE }) {
  const [expanded, setExpanded] = useState(true)
  const [loading, setLoading] = useState(false)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const [posting, setPosting] = useState(false)
  const containerRef = useRef(null)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    if (!expanded) return
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, questionId])

  const load = async () => {
    if (!questionId) return
    try {
      setLoading(true)
      const res = await fetch(`${API_BASE}/qbank/questions/${questionId}/comments`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load comments')
      const data = await res.json()
      setComments(Array.isArray(data.comments) ? data.comments : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    if (!text.trim() || posting) return
    try {
      setPosting(true)
      const res = await fetch(`${API_BASE}/qbank/questions/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: text.trim() })
      })
      if (!res.ok) throw new Error('Failed to post comment')
      setText('')
      await load()
      // Smoothly scroll to bottom to reveal the new comment
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    } catch (e) {
      console.error(e)
      alert('Failed to post comment')
    } finally {
      setPosting(false)
    }
  }

  const toggleLike = async (commentId) => {
    const updateLocal = (id) => {
      setComments((prev) => prev.map((c) => {
        if (c.id !== id) return c
        const wasLiked = !!c.liked
        return { ...c, liked: !wasLiked, like_count: Math.max(0, (c.like_count || 0) + (wasLiked ? -1 : 1)) }
      }))
      setExpandedReplies((prev) => {
        const next = { ...prev }
        Object.keys(next).forEach((k) => {
          const arr = next[k]
          if (Array.isArray(arr)) {
            next[k] = arr.map((r) => {
              if (r.id !== id) return r
              const wasLiked = !!r.liked
              return { ...r, liked: !wasLiked, like_count: Math.max(0, (r.like_count || 0) + (wasLiked ? -1 : 1)) }
            })
          }
        })
        return next
      })
    }

    updateLocal(commentId)
    try {
      await fetch(`${API_BASE}/qbank/comments/${commentId}/like`, { method: 'POST', credentials: 'include' })
    } catch (e) {
      console.error(e)
      // revert on error
      updateLocal(commentId)
    }
  }

  const openReply = (commentId) => {
    setReplyingTo(commentId)
    setReplyText('')
  }

  const cancelReply = () => {
    setReplyingTo(null)
    setReplyText('')
  }

  const submitReply = async (parentId) => {
    if (!replyText.trim()) return
    try {
      const res = await fetch(`${API_BASE}/qbank/questions/${questionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content: replyText.trim(), parent_id: parentId })
      })
      if (!res.ok) throw new Error('Failed to post reply')
      cancelReply()
      await load()
      setTimeout(() => {
        containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight, behavior: 'smooth' })
      }, 50)
    } catch (e) {
      console.error(e)
      alert('Failed to post reply')
    }
  }

  const [expandedReplies, setExpandedReplies] = useState({})
  const toggleReplies = async (commentId) => {
    const isOpen = !!expandedReplies[commentId]
    if (isOpen) {
      setExpandedReplies((m) => ({ ...m, [commentId]: undefined }))
      return
    }
    try {
      const res = await fetch(`${API_BASE}/qbank/comments/${commentId}/replies`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load replies')
      const data = await res.json()
      setExpandedReplies((m) => ({ ...m, [commentId]: data.replies || [] }))
    } catch (e) {
      console.error(e)
    }
  }

  const count = comments.length

  return (
    <div className="card discussion-card">
      <div className="card__header discussion-card__header">
        <div className="discussion-card__title">Student Discussion</div>
        <button className="btn btn--ghost btn--icon discussion-card__toggle" onClick={() => setExpanded((x) => !x)}>
          {expanded ? 'Hide' : `Show (${count})`}
        </button>
      </div>
      <div className={`discussion__content ${expanded ? 'is-open' : ''}`} style={{ maxHeight: expanded ? 640 : 0 }}>
        <div className="discussion__inner">
          <div ref={containerRef} className="discussion__list">
            {loading ? (
              <div className="discussion__loading">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="discussion__empty">Be the first to start the discussion for this question.</div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="comment">
                  <div className="comment__avatar">{(c.user?.username || 'U').slice(0, 1).toUpperCase()}</div>
                  <div className="comment__body">
                    <div className="comment__meta">
                      <span className="comment__author">{c.user?.username || 'User'}</span>
                      <span className="comment__time">{new Date(c.created_at).toLocaleDateString()}, {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="comment__content">{c.content}</div>
                    <div className="comment__actions">
                      <button className={`action like ${c.liked ? 'is-active' : ''}`} onClick={() => toggleLike(c.id)}>
                        <LuThumbsUp className={`thumb ${c.liked ? 'liked' : ''}`} strokeWidth={c.liked ? 2 : 2} />
                        <span className="num">{c.like_count || 0}</span>
                      </button>
                      <button className="action reply" onClick={() => openReply(c.id)}>Reply</button>
                      {c.reply_count > 0 && (
                        <button className="action" onClick={() => toggleReplies(c.id)}>
                          {expandedReplies[c.id] ? 'Hide' : 'View'} replies ({c.reply_count})
                        </button>
                      )}
                    </div>

                    {replyingTo === c.id && (
                      <div className="reply-composer">
                        <textarea value={replyText} onChange={(e)=>setReplyText(e.target.value)} placeholder="Write a reply…" />
                        <div className="reply-composer__actions">
                          <button className="btn btn--ghost" onClick={cancelReply}>Cancel</button>
                          <button className="btn btn--primary" disabled={!replyText.trim()} onClick={()=>submitReply(c.id)}>Post Reply</button>
                        </div>
                      </div>
                    )}

                    {Array.isArray(expandedReplies[c.id]) && (
                      <div className="replies">
                        {expandedReplies[c.id].length === 0 ? (
                          <div className="discussion__empty">No replies yet.</div>
                        ) : (
                          expandedReplies[c.id].map((r) => (
                            <div key={r.id} className="comment reply">
                              <div className="comment__avatar">{(r.user?.username || 'U').slice(0, 1).toUpperCase()}</div>
                              <div className="comment__body">
                                <div className="comment__meta">
                                  <span className="comment__author">{r.user?.username || 'User'}</span>
                                  <span className="comment__time">{new Date(r.created_at).toLocaleDateString()}, {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <div className="comment__content">{r.content}</div>
                                <div className="comment__actions">
                                  <button className={`action like ${r.liked ? 'is-active' : ''}`} onClick={() => toggleLike(r.id)}>
                                    <LuThumbsUp className={`thumb ${r.liked ? 'liked' : ''}`} strokeWidth={r.liked ? 2 : 2} />
                                    <span className="num">{r.like_count || 0}</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="discussion__composer">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Share your insights, ask questions, or contribute mnemonics…"
            />
            <button className="btn btn--primary" disabled={!text.trim() || posting} onClick={submit}>
              {posting ? 'Posting…' : 'Post Comment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


