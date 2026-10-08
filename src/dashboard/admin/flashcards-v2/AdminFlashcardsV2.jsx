import { useCallback, useEffect, useRef, useState } from 'react'
import ImportRunControl from './ImportRunControl'
import ReportsQueue from './ReportsQueue'
import ReviewPanel from './ReviewPanel'
import TopicList from './TopicList'
import { listTopics } from './flashcardsV2AdminApi'
import '../../osce/Flashcards.css'
import './AdminFlashcardsV2.css'

/**
 * Flashcards V2 admin review hub: topic list on the left, the selected topic's review on the right.
 * Generated decks arrive unpublished; nothing reaches learners until an admin publishes a topic here.
 * The "Reports" sub-tab is the learner report queue; "Open card in review" switches back to Review
 * with that card's topic selected.
 */
export default function AdminFlashcardsV2() {
  const [topics, setTopics] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [selected, setSelected] = useState(null) // {topicId, topicName}
  const [reviewNonce, setReviewNonce] = useState(0)
  const [tab, setTab] = useState('review') // 'review' | 'reports'
  const requestRef = useRef(0)

  const load = useCallback(async () => {
    const n = ++requestRef.current
    setLoading(true)
    try {
      const res = await listTopics()
      if (n !== requestRef.current) return
      setTopics(Array.isArray(res?.topics) ? res.topics : [])
      setError(null)
    } catch (e) {
      if (n !== requestRef.current) return
      setError(e)
    } finally {
      if (n === requestRef.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const openCardInReview = ({ topicId, topicName }) => {
    setSelected({ topicId, topicName })
    setReviewNonce((n) => n + 1)
    setTab('review')
  }

  const tabs = [
    { id: 'review', label: 'Review' },
    { id: 'reports', label: 'Reports' },
  ]

  return (
    <section className="admin-card fcv2a" aria-label="Flashcards V2 review">
      <div role="tablist" aria-label="Flashcards V2 admin" className="fcv2a-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`fcv2a-tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`fcv2a-tabpanel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            className={`fcv2a-tab${tab === t.id ? ' is-active' : ''}`}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
              e.preventDefault()
              const next = tabs[(tabs.findIndex((x) => x.id === t.id) + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length]
              setTab(next.id)
              document.getElementById(`fcv2a-tab-${next.id}`)?.focus()
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'reports' ? (
        <div role="tabpanel" id="fcv2a-tabpanel-reports" aria-labelledby="fcv2a-tab-reports">
          <ReportsQueue onOpenCard={openCardInReview} />
        </div>
      ) : (
        <div role="tabpanel" id="fcv2a-tabpanel-review" aria-labelledby="fcv2a-tab-review" className="fcv2a-layout">
          <aside className="fcv2a-layout__side">
            <div className="fcv2a-row fcv2a-row--between">
              <h2 className="fcv2a-review__title">Topics</h2>
              <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={load} disabled={loading}>
                {loading ? 'Loading…' : 'Refresh'}
              </button>
            </div>
            <ImportRunControl
              onImported={() => {
                load()
                setReviewNonce((n) => n + 1)
              }}
            />
            {error && (
              <div role="alert" className="admin-alert">
                {`${error.message}${error.code ? ` (${error.code})` : ''}`}
              </div>
            )}
            {!error && !loading && topics.length === 0 && <p className="fcv2a-muted">No topics have V2 flashcards yet. Import a TopicRun to start.</p>}
            <TopicList
              topics={topics}
              query={query}
              status={status}
              onQuery={setQuery}
              onStatus={setStatus}
              selectedId={selected?.topicId}
              onSelect={(t) => setSelected({ topicId: t.topicId, topicName: t.topicName })}
            />
          </aside>
          <div className="fcv2a-layout__main">
            {selected ? (
              <ReviewPanel key={`${selected.topicId}:${reviewNonce}`} topicId={selected.topicId} topicName={selected.topicName} onChanged={load} />
            ) : (
              <p className="fcv2a-muted">Select a topic to review its deck.</p>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
