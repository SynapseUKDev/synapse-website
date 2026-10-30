import { useCallback, useEffect, useRef, useState } from 'react'
import QueueCardItem from './QueueCardItem'
import QueueFilters from './QueueFilters'
import { findAdminCard } from './cardLookup'
import { listAdminCards, listTopics } from './flashcardsV2AdminApi'

export const QUEUE_PAGE = 50
const NEEDS_ACTION = new Set(['needs_attention', 'media_pending', 'draft'])
const RELOADED = 'This card changed — reloaded'

const errorText = (e) => `${e?.message || 'The request failed.'}${e?.code ? ` (${e.code})` : ''}`

/** Unique specialties of the admin topic list (it covers every topic with cards), sorted by name. */
function specialtiesOf(topics) {
  const byId = new Map()
  for (const t of topics ?? []) if (t?.specialtyId && !byId.has(t.specialtyId)) byId.set(t.specialtyId, { id: t.specialtyId, name: t.specialtyName || t.specialtyId })
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The cross-topic queue of cards needing an admin (GET /cards?state=needs_action): flagged by the
 * generator or waiting for an image. Approve / Discard drop the item and ask the owner to refresh
 * the tab counts (onCountsChanged). `reloadKey` changes (e.g. after an import) reload the list.
 */
export default function NeedsAttentionQueue({ reloadKey = 0, onCountsChanged }) {
  const [filters, setFilters] = useState({ q: '', specialtyId: '', kind: '' })
  const [cards, setCards] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)
  const [moreError, setMoreError] = useState(null)
  const [notices, setNotices] = useState({}) // cardId → text shown on that card
  const [status, setStatus] = useState('')
  const [specialties, setSpecialties] = useState([])
  const [specialtyError, setSpecialtyError] = useState(null)
  const requestRef = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    listTopics({ signal: controller.signal })
      .then((res) => setSpecialties(specialtiesOf(res?.topics)))
      .catch((e) => {
        if (e?.name !== 'AbortError') setSpecialtyError(e)
      })
    return () => controller.abort()
  }, [])

  const query = useCallback(
    (cursor) => ({
      state: 'needs_action',
      kind: filters.kind || undefined,
      specialtyId: filters.specialtyId || undefined,
      q: filters.q || undefined,
      cursor: cursor || undefined,
      limit: QUEUE_PAGE,
    }),
    [filters],
  )

  useEffect(() => {
    const n = ++requestRef.current
    const controller = new AbortController()
    setLoading(true)
    setMoreError(null)
    listAdminCards({ ...query(null), signal: controller.signal })
      .then((res) => {
        if (n !== requestRef.current) return
        setCards(Array.isArray(res?.cards) ? res.cards : [])
        setNextCursor(res?.nextCursor ?? null)
        setNotices({})
        setError(null)
      })
      .catch((e) => {
        if (n !== requestRef.current || e?.name === 'AbortError') return
        setError(e)
        setCards([])
        setNextCursor(null)
      })
      .finally(() => {
        if (n === requestRef.current) setLoading(false)
      })
    return () => controller.abort()
  }, [query, reloadKey])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    const n = requestRef.current
    setLoadingMore(true)
    setMoreError(null)
    try {
      const res = await listAdminCards(query(nextCursor))
      if (n !== requestRef.current) return
      setCards((prev) => {
        const seen = new Set(prev.map((c) => c.id))
        return prev.concat((res?.cards ?? []).filter((c) => !seen.has(c.id)))
      })
      setNextCursor(res?.nextCursor ?? null)
    } catch (e) {
      if (n === requestRef.current) setMoreError(e)
    } finally {
      setLoadingMore(false)
    }
  }

  const replaceCard = (next) => setCards((prev) => prev.map((c) => (c.id === next.id ? next : c)))
  const dropCard = (cardId) => setCards((prev) => prev.filter((c) => c.id !== cardId))

  function removed(card, message) {
    dropCard(card.id)
    setStatus(message)
    onCountsChanged?.()
  }

  /** After a 409 STALE_VERSION: read the card again; it stays only while it still needs action. */
  async function refetch(cardId) {
    const card = cards.find((c) => c.id === cardId)
    if (!card) return
    const label = card.semanticKey ?? card.id
    try {
      const fresh = await findAdminCard(cardId, card.topicId)
      if (!fresh) {
        dropCard(cardId)
        setStatus(`${label} was discarded by someone else.`)
        onCountsChanged?.()
      } else if (!NEEDS_ACTION.has(fresh.qaStatus)) {
        dropCard(cardId)
        setStatus(`${RELOADED}: ${label} no longer needs attention.`)
        onCountsChanged?.()
      } else {
        replaceCard(fresh)
        setNotices((prev) => ({ ...prev, [cardId]: RELOADED }))
      }
    } catch (e) {
      setNotices((prev) => ({ ...prev, [cardId]: `This card changed, and reloading it failed: ${errorText(e)}` }))
    }
  }

  const filtered = !!(filters.q || filters.specialtyId || filters.kind)

  return (
    <section aria-label="Needs attention" className="fcv2a-queue">
      <QueueFilters value={filters} specialties={specialties} onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))} />
      {specialtyError && <p className="fcv2a-muted">{`Specialty list unavailable: ${errorText(specialtyError)}`}</p>}

      <div role="status" aria-live="polite" className="fcv2a-notice">
        {status}
      </div>

      {error && (
        <div role="alert" className="admin-alert">
          {errorText(error)}
        </div>
      )}
      {loading && cards.length === 0 && <p className="fcv2a-muted">Loading…</p>}
      {!loading && !error && cards.length === 0 && (
        <p className="fcv2a-muted">{filtered ? 'No cards match these filters.' : 'Nothing needs attention.'}</p>
      )}

      <ul className="fcv2a-cards" aria-label="Cards needing attention">
        {cards.map((card) => (
          <li key={card.id}>
            <QueueCardItem card={card} notice={notices[card.id]} onCardChange={replaceCard} onRemoved={removed} onStale={refetch} />
          </li>
        ))}
      </ul>

      {moreError && (
        <div role="alert" className="admin-alert">
          {errorText(moreError)}
        </div>
      )}
      {nextCursor && (
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={loadMore} disabled={loadingMore || loading}>
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  )
}
