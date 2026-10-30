import { useState } from 'react'
import ImageCredit from '../../flashcards-v2/ImageCredit'
import ImageForm from './ImageForm'
import { removeCardMedia, uploadCardMedia } from './flashcardsV2AdminApi'

const SIDES = [
  { side: 'front', label: 'Front image' },
  { side: 'back', label: 'Back image' },
]

/** The card after an attach/detach answer: new version and QA status, that side's image replaced. */
function withImage(card, side, image, result) {
  const media = { front: card.media?.front ?? null, back: card.media?.back ?? null, [side]: image }
  const qaStatus = result?.qaStatus ?? card.qaStatus
  const next = {
    ...card,
    media: media.front || media.back ? media : null,
    contentVersion: result?.contentVersion ?? card.contentVersion,
    qaStatus,
  }
  // The server unpublishes a card that leaves 'validated' (removing a media card's front image →
  // media_pending); the answer carries no publish flag, so a card that is no longer validated is not live.
  if (qaStatus !== 'validated') {
    next.isLive = false
    next.isPublished = false
  }
  return next
}

export { ImageCredit }

function ImageSlot({ card, side, label, onChange, onStale }) {
  const image = card.media?.[side] ?? null
  const [formOpen, setFormOpen] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const required = side === 'front' && card.isMediaRequired

  async function run(action, next) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      setFormOpen(false)
      setConfirmingRemove(false)
      onChange?.(next(result ?? {}))
    } catch (e) {
      if (e?.kind === 'stale') onStale?.(e)
      else setError(e)
    } finally {
      setBusy(false)
    }
  }

  function upload(values) {
    run(
      () => uploadCardMedia(card.id, { ...values, side, expectedVersion: card.contentVersion }),
      (r) =>
        withImage(
          card,
          side,
          r.asset
            ? {
                id: r.asset.id,
                url: r.asset.url,
                alt: r.asset.alt,
                attribution: r.asset.attribution ?? null,
                license: r.asset.license ?? null,
                sourceUrl: r.asset.sourceUrl ?? null,
              }
            : null,
          r,
        ),
    )
  }

  function remove() {
    run(
      () => removeCardMedia(card.id, { side, expectedVersion: card.contentVersion }),
      (r) => withImage(card, side, null, r),
    )
  }

  return (
    <section aria-label={`${label} ${card.semanticKey ?? card.id}`} className="fcv2a-slot">
      <p className="fcv2a-diag__title">{`${label}${required ? ' (required)' : ''}`}</p>
      {image ? (
        <figure className="fcv2a-media__current">
          <img src={image.url} alt={image.alt || ''} loading="lazy" className="fcv2a-media__img" />
          <figcaption className="fcv2a-muted">{`Alt text: ${image.alt || '(none)'}`}</figcaption>
          <ImageCredit image={image} />
        </figure>
      ) : (
        <p className="fcv2a-muted">{required ? 'No front image yet — this card needs one before it can be approved.' : 'No image.'}</p>
      )}

      {!formOpen && !confirmingRemove && (
        <div className="fcv2a-row">
          <button
            type="button"
            className="admin-btn-issue admin-btn-issue--ghost"
            onClick={() => {
              setError(null)
              setFormOpen(true)
            }}
            disabled={busy}
          >
            {image ? `Replace ${side} image` : `Add ${side} image`}
          </button>
          {image && (
            <button
              type="button"
              className="admin-btn-issue admin-btn-issue--danger"
              onClick={() => {
                setError(null)
                setConfirmingRemove(true)
              }}
              disabled={busy}
            >
              {`Remove ${side} image`}
            </button>
          )}
        </div>
      )}

      {confirmingRemove && (
        <div className="fcv2a-media__confirm" role="group" aria-label={`Confirm ${side} image removal`}>
          {required && <p className="fcv2a-text-warn">Without a front image this card goes back to Needs attention and is taken off live.</p>}
          <div className="fcv2a-row">
            <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={remove} disabled={busy}>
              {busy ? 'Removing…' : 'Confirm remove'}
            </button>
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => setConfirmingRemove(false)} disabled={busy}>
              Keep image
            </button>
          </div>
        </div>
      )}

      {formOpen && <ImageForm side={side} busy={busy} onSubmit={upload} onCancel={() => setFormOpen(false)} />}

      {error && (
        <div role="alert" className="admin-alert">
          {`${error.message || 'The image could not be saved.'}${error.code ? ` (${error.code})` : ''}`}
        </div>
      )}
    </section>
  )
}

/**
 * Front and back image slots for one card (backend flashcardsV2MediaRoutes.ts). Each slot attaches,
 * replaces or removes its side's image with the card's contentVersion; on success onChange gets the
 * card with the new image, contentVersion and qaStatus applied (no refetch needed).
 *
 * card: AdminCardDto (media = {front, back} | null); onChange(nextCard); onStale(error) on a 409
 * STALE_VERSION — the owner refetches the card and says so ("This card changed — reloaded"); an open
 * form keeps its values so the admin can submit again.
 */
export default function CardImagesControl({ card, onChange, onStale }) {
  return (
    <section aria-label={`Images ${card.semanticKey ?? card.id}`} className="fcv2a-media">
      <p className="fcv2a-diag__title">Images</p>
      <div className="fcv2a-slots">
        {SIDES.map(({ side, label }) => (
          <ImageSlot key={side} card={card} side={side} label={label} onChange={onChange} onStale={onStale} />
        ))}
      </div>
    </section>
  )
}
