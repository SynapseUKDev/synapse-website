import { useCallback, useEffect, useRef, useState } from 'react'
import ImportRunControl from './ImportRunControl'
import NeedsAttentionQueue from './NeedsAttentionQueue'
import ReportedCardDialog from './ReportedCardDialog'
import ReportsQueue from './ReportsQueue'
import { getAdminCardCounts } from './flashcardsV2AdminApi'
import '../../osce/Flashcards.css'
import './AdminFlashcardsV2.css'

/**
 * Flashcards V2 admin tab. "Needs attention" is the cross-topic queue of cards an admin has to act
 * on (flagged by the generator, or waiting for an image): fix, add images, approve or discard, one
 * card at a time. Approved cards are managed (and pushed live) on the Flashcards page. "Learner
 * reports" is the learner report queue; "Open card" there shows that card (edit, images, live).
 */
export default function AdminFlashcardsV2() {
  const [tab, setTab] = useState('queue') // 'queue' | 'reports'
  const [counts, setCounts] = useState(null)
  const [countsError, setCountsError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [openCard, setOpenCard] = useState(null) // {topicId, topicName, cardId} from a learner report
  const countsRef = useRef(0)

  const loadCounts = useCallback(async () => {
    const n = ++countsRef.current
    try {
      const res = await getAdminCardCounts()
      if (n !== countsRef.current) return
      setCounts(res ?? null)
      setCountsError(null)
    } catch (e) {
      if (n === countsRef.current) setCountsError(e)
    }
  }, [])

  useEffect(() => {
    loadCounts()
  }, [loadCounts])

  const needsAction = typeof counts?.needsAction === 'number' ? counts.needsAction : null
  const tabs = [
    { id: 'queue', label: needsAction === null ? 'Needs attention' : `Needs attention (${needsAction})` },
    { id: 'reports', label: 'Learner reports' },
  ]

  return (
    <section className="admin-card fcv2a" aria-label="Flashcards V2 admin">
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
          <ReportsQueue onOpenCard={setOpenCard} />
          {openCard && <ReportedCardDialog key={openCard.cardId} target={openCard} onClose={() => setOpenCard(null)} />}
        </div>
      ) : (
        <div role="tabpanel" id="fcv2a-tabpanel-queue" aria-labelledby="fcv2a-tab-queue" className="fcv2a-review">
          <ImportRunControl
            onImported={() => {
              setReloadKey((k) => k + 1)
              loadCounts()
            }}
          />
          {countsError && (
            <div role="alert" className="admin-alert">
              {`Counts unavailable: ${countsError.message}${countsError.code ? ` (${countsError.code})` : ''}`}
            </div>
          )}
          {counts && (
            <p className="fcv2a-muted">
              {`${counts.flagged ?? 0} flagged · ${counts.needsImage ?? 0} need an image · ${counts.approved ?? 0} approved, not live · ${counts.live ?? 0} live`}
            </p>
          )}
          <NeedsAttentionQueue reloadKey={reloadKey} onCountsChanged={loadCounts} />
        </div>
      )}
    </section>
  )
}
