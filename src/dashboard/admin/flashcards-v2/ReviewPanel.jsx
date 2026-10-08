import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import AdminCardItem from './AdminCardItem'
import BlockersPanel from './BlockersPanel'
import PublishDialog from './PublishDialog'
import RetirePanel, { RetireDialog } from './RetirePanel'
import RevalidateControl from './RevalidateControl'
import RunSummary from './RunSummary'
import TextbookIssuesPanel from './TextbookIssuesPanel'
import UnpublishDialog from './UnpublishDialog'
import { expectedVersionsFor, getTopicReview, publishTopic, retireCards, unpublishTopic } from './flashcardsV2AdminApi'
import { finalVerdicts, plural } from './reviewModel'

/**
 * Review of one topic's current run. Reloads keep the previous data on screen (card editors stay
 * mounted, keyed by card id, so unsaved text survives). `onChanged` tells the topic list to refresh
 * its counts after a mutation.
 */
export default function ReviewPanel({ topicId, topicName, onChanged }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState('')
  const [selected, setSelected] = useState(() => new Set())
  const [dialog, setDialog] = useState(null) // 'publish' | 'unpublish' | 'retire'
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const requestRef = useRef(0)
  const publishReasonId = useId()

  const load = useCallback(async () => {
    const n = ++requestRef.current
    setLoading(true)
    try {
      const next = await getTopicReview(topicId)
      if (n !== requestRef.current) return
      setData(next)
      setLoadError(null)
      const candidates = new Set(next?.diff?.retiredCandidates ?? [])
      setSelected((prev) => new Set([...prev].filter((k) => candidates.has(k))))
    } catch (error) {
      if (n !== requestRef.current) return
      setLoadError(error)
    } finally {
      if (n === requestRef.current) setLoading(false)
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  const verdicts = useMemo(() => finalVerdicts(data?.run), [data])

  const changed = useCallback(() => {
    onChanged?.()
    return load()
  }, [onChanged, load])

  const closeDialog = () => {
    setDialog(null)
    setActionError(null)
  }
  const openDialog = (name) => {
    setActionError(null)
    setDialog(name)
  }

  const toggleRetire = (key) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  async function runAction(fn, success) {
    setBusy(true)
    setActionError(null)
    try {
      const result = await fn()
      setDialog(null)
      setNotice(success(result ?? {}))
      changed()
    } catch (error) {
      setActionError(error)
    } finally {
      setBusy(false)
    }
  }

  const confirmPublish = () =>
    runAction(
      () => publishTopic(topicId, { runId: data.review.currentRunId, expectedVersions: expectedVersionsFor(data.cards) }),
      (r) => {
        const published = r.publishedIds?.length ?? 0
        const waiting = r.mediaPendingIds?.length ?? 0
        const already = r.alreadyPublishedIds?.length ?? 0
        return (
          `Published ${plural(published, 'card')}; ${waiting} ${waiting === 1 ? 'stays' : 'stay'} awaiting an image` +
          (already ? `; ${already} already published.` : '.')
        )
      },
    )

  const confirmUnpublish = (reason) =>
    runAction(
      () => unpublishTopic(topicId, reason),
      (r) => `Unpublished ${plural(r.unpublishedIds?.length ?? 0, 'card')}. The topic now needs approval again.`,
    )

  const confirmRetire = () =>
    runAction(
      () => retireCards(topicId, { runId: data.review.currentRunId, semanticKeys: [...selected].sort() }),
      (r) => {
        const retired = r.retired ?? []
        setSelected(new Set())
        return `Retired ${plural(retired.length, 'card')}: ${retired.join(', ')}.`
      },
    )

  const reloadFromDialog = () => {
    closeDialog()
    load()
  }

  if (!data) {
    if (loadError) {
      return (
        <div role="alert" className="admin-alert">
          {`${loadError.message}${loadError.code ? ` (${loadError.code})` : ''}`}
        </div>
      )
    }
    return (
      <p role="status" className="fcv2a-muted">
        Loading review…
      </p>
    )
  }

  const { review, run, cards = [], blockers = [], diff } = data
  const candidates = diff?.retiredCandidates ?? []
  const candidateSet = new Set(candidates)
  const blocked = blockers.length > 0
  const anyPublished = cards.some((c) => c.isPublished) || review.status === 'approved'

  return (
    <div className="fcv2a-review">
      <div className="fcv2a-review__head">
        <h2 className="fcv2a-review__title">{topicName}</h2>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={load} disabled={loading}>
          {loading ? 'Reloading…' : 'Reload'}
        </button>
      </div>
      <div role="status" aria-live="polite" aria-label="Review notices" className="fcv2a-notice">
        {notice}
      </div>
      {loadError && (
        <div role="alert" className="admin-alert">
          {`Reload failed: ${loadError.message}`}
        </div>
      )}

      <RunSummary review={review} run={run} />
      <BlockersPanel blockers={blockers} />

      <div className="fcv2a-actions">
        <RevalidateControl
          topicId={topicId}
          runId={review.currentRunId}
          onSucceeded={() => {
            setNotice('Revalidation finished; showing the new run.')
            changed()
          }}
          onStaleRun={load}
        />
        <div className="fcv2a-actions__publish">
          <button
            type="button"
            className="admin-btn-issue"
            onClick={() => openDialog('publish')}
            disabled={blocked || loading}
            aria-describedby={blocked ? publishReasonId : undefined}
          >
            Publish topic
          </button>
          {blocked && (
            <p id={publishReasonId} className="fcv2a-text-error">
              {`Publishing is blocked: ${plural(blockers.length, 'blocker')} must be resolved (listed above).`}
            </p>
          )}
          <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={() => openDialog('unpublish')} disabled={!anyPublished}>
            Unpublish topic
          </button>
        </div>
      </div>

      <RetirePanel candidates={candidates} selected={selected} onToggle={toggleRetire} onRetire={() => openDialog('retire')} />
      <TextbookIssuesPanel runId={run.id} topicName={topicName} issues={run.textbookIssues} />

      <h3 className="fcv2a-panel__title">Cards ({cards.length})</h3>
      <ul className="fcv2a-cards">
        {cards.map((card) => (
          <li key={card.id}>
            <AdminCardItem
              card={card}
              verdict={card.legacy ? null : verdicts.get(card.semanticKey) ?? null}
              retirable={candidateSet.has(card.semanticKey)}
              selected={selected.has(card.semanticKey)}
              onToggleRetire={toggleRetire}
              onReload={load}
              onMediaChanged={(message) => {
                setNotice(message)
                changed()
              }}
              onSaved={(updated) => {
                setNotice(`Saved ${card.semanticKey}. It is now ${updated.qaStatus ?? 'draft'} and unpublished; it needs validation before the topic can be published.`)
                changed()
              }}
            />
          </li>
        ))}
      </ul>

      {dialog === 'publish' && (
        <PublishDialog
          topicName={topicName}
          cards={cards}
          busy={busy}
          error={actionError}
          onConfirm={confirmPublish}
          onCancel={closeDialog}
          onReload={reloadFromDialog}
        />
      )}
      {dialog === 'unpublish' && (
        <UnpublishDialog topicName={topicName} busy={busy} error={actionError} onConfirm={confirmUnpublish} onCancel={closeDialog} />
      )}
      {dialog === 'retire' && (
        <RetireDialog keys={[...selected].sort()} busy={busy} error={actionError} onConfirm={confirmRetire} onCancel={closeDialog} />
      )}
    </div>
  )
}
