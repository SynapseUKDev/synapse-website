import { useCallback, useEffect, useState } from 'react'
import { LuArrowLeft } from 'react-icons/lu'
import { setTopicLive } from '../admin/flashcards-v2/flashcardsV2AdminApi'
import { getAllCards } from './flashcardsV2Api'
import ManageCardRow from './ManageCardRow'
import '../admin/flashcards-v2/AdminFlashcardsV2.css'

const FILTERS = [
  { id: 'all', label: 'All', match: () => true },
  { id: 'live', label: 'Live', match: (c) => c.isLive },
  { id: 'notlive', label: 'Not live', match: (c) => !c.isLive },
]

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const errorText = (e) => `${e?.message || 'The request failed.'}${e?.code ? ` (${e.code})` : ''}`

/**
 * Manage mode for one topic (admin only): its approved cards, live or not, from the preview cards
 * endpoint. Edit text, attach images, and push cards (or the whole topic) live or off live.
 * topic: {id, name}.
 */
export default function ManageTopic({ topic, onBack }) {
  const [state, setState] = useState({ status: 'loading', cards: [], error: null })
  const [filter, setFilter] = useState('all')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)

  const load = useCallback(
    async ({ signal } = {}) => {
      try {
        const cards = await getAllCards([topic.id], { preview: true, signal, cache: 'no-store' })
        setState({ status: 'ready', cards, error: null })
      } catch (error) {
        if (error?.name === 'AbortError') return
        console.warn('Flashcards V2: loading the topic cards failed', error?.name, error?.kind, error?.message)
        setState({ status: 'error', cards: [], error })
      }
    },
    [topic.id],
  )

  useEffect(() => {
    const controller = new AbortController()
    load({ signal: controller.signal })
    return () => controller.abort()
  }, [load])

  const replaceCard = (next) => {
    setNotice('')
    setState((s) => ({ ...s, cards: s.cards.map((c) => (c.id === next.id ? next : c)) }))
  }
  const reloadStale = async () => {
    await load()
    setNotice('This card changed — reloaded')
  }

  async function pushTopic(live) {
    setBusy(true)
    setActionError(null)
    setNotice('')
    try {
      const res = await setTopicLive(topic.id, live)
      const skipped = res?.skipped?.length ?? 0
      await load()
      setNotice(
        live
          ? `${plural(res?.changed ?? 0, 'card')} pushed live, ${skipped} skipped`
          : `${plural(res?.changed ?? 0, 'card')} taken off live, ${skipped} skipped`,
      )
    } catch (e) {
      setActionError(e)
    } finally {
      setBusy(false)
    }
  }

  const { cards } = state
  const active = FILTERS.find((f) => f.id === filter)
  const shown = cards.filter(active.match)
  const liveCount = cards.filter((c) => c.isLive).length

  return (
    <section className="fc2-manage" aria-label={`Manage ${topic.name}`}>
      <button type="button" className="fc-page__back" onClick={onBack}>
        <LuArrowLeft size={18} aria-hidden="true" />
        <span>All topics</span>
      </button>
      <header className="fc2-header">
        <h2 className="fc2-header__title">{topic.name}</h2>
        <p className="fc2-header__beta">
          {`Manage — ${liveCount} live of ${plural(cards.length, 'approved card')}`}
        </p>
      </header>

      <div className="fcv2a-row fcv2a-row--between">
        <div className="fcv2a-row" role="group" aria-label="Filter cards">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              className={`admin-btn-issue${filter === f.id ? '' : ' admin-btn-issue--ghost'}`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="fcv2a-row">
          <button type="button" className="admin-btn-issue" onClick={() => pushTopic(true)} disabled={busy || state.status !== 'ready'}>
            Push topic live
          </button>
          <button
            type="button"
            className="admin-btn-issue admin-btn-issue--ghost"
            onClick={() => pushTopic(false)}
            disabled={busy || state.status !== 'ready'}
          >
            Take topic off live
          </button>
        </div>
      </div>

      <p role="status" className="fcv2a-notice">
        {notice}
      </p>
      {actionError && (
        <div role="alert" className="admin-alert">
          {errorText(actionError)}
        </div>
      )}

      {state.status === 'loading' && (
        <div className="fc2-picker__state" role="status">
          <div className="fc-spinner" aria-hidden="true" />
          <p>Loading cards…</p>
        </div>
      )}
      {state.status === 'error' && (
        <div className="fc2-picker__state">
          <div role="alert" className="fc2-alert">
            We could not load the cards. {state.error?.message}
          </div>
          <button type="button" className="fc2-btn fc2-btn--primary" onClick={() => load()}>
            Retry
          </button>
        </div>
      )}
      {state.status === 'ready' && shown.length === 0 && <p className="fcv2a-muted">No cards in this view.</p>}
      {state.status === 'ready' &&
        shown.map((c) => <ManageCardRow key={c.id} card={c} onChange={replaceCard} onStale={reloadStale} />)}
    </section>
  )
}
