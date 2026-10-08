import { useEffect, useId, useRef, useState } from 'react'
import { removeCardMedia, uploadCardMedia } from './flashcardsV2AdminApi'

const MAX_BYTES = 8 * 1024 * 1024
const MAX_ALT = 300
const ACCEPT = 'image/png,image/jpeg,image/webp'
export const ALT_HINT = 'Describe what the image shows without naming the diagnosis being tested'

/**
 * Image for a media card (backend flashcardsV2MediaRoutes.ts, sql/100). Upload attaches or replaces
 * the image, remove detaches it; both send the card's contentVersion and, on success, the parent
 * reloads the review (the card's version, QA status and approval all change server-side).
 *
 * If the card's content changed after its image was attached (an import keeps the image but sets
 * media_pending), the admin confirms the image by uploading it again or a replacement: re-attaching
 * the same stored asset is not possible.
 */
export default function CardMediaControl({ card, onChanged, onReload }) {
  const media = card.media?.url ? card.media : null
  const needsConfirm = !!media && card.qaStatus === 'media_pending'
  const [formOpen, setFormOpen] = useState(false)
  const [file, setFile] = useState(null)
  const [alt, setAlt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  // A reload that brings a new contentVersion makes a 409 "changed since you loaded it" message
  // obsolete: clear it (adjusting state during render, React's pattern for derived resets).
  const [seenVersion, setSeenVersion] = useState(card.contentVersion)
  if (seenVersion !== card.contentVersion) {
    setSeenVersion(card.contentVersion)
    if (error?.kind === 'stale') setError(null)
    setConfirmingRemove(false)
  }
  const fileRef = useRef(null)
  const [focusFile, setFocusFile] = useState(0) // bumped to move focus to the file input once it renders
  const ids = { file: useId(), alt: useId(), hint: useId() }

  const showForm = !media || formOpen
  const altOk = alt.trim() !== '' && alt.length <= MAX_ALT
  const canUpload = !!file && altOk && !busy

  function openForm(prefillAlt) {
    setError(null)
    setAlt(prefillAlt ?? '')
    setFile(null)
    setFormOpen(true)
    setFocusFile((n) => n + 1)
  }

  useEffect(() => {
    if (focusFile) fileRef.current?.focus()
  }, [focusFile])

  function closeForm() {
    setFormOpen(false)
    setFile(null)
    setAlt('')
    setError(null)
  }

  async function run(action, message) {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      setFormOpen(false)
      setFile(null)
      setAlt('')
      if (fileRef.current) fileRef.current.value = ''
      onChanged?.(message(result ?? {}))
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  function upload(event) {
    event.preventDefault()
    if (!canUpload) return
    if (file.size > MAX_BYTES) {
      setError({ kind: 'too_large', message: 'Images must be 8 MB or smaller.' })
      return
    }
    run(
      () => uploadCardMedia(card.id, { file, alt: alt.trim(), expectedVersion: card.contentVersion }),
      (r) =>
        `Image attached to ${card.semanticKey}. It is now ${r.qaStatus ?? 'updated'} and unpublished; the topic needs approval again.`,
    )
  }

  function remove() {
    setConfirmingRemove(false)
    run(
      () => removeCardMedia(card.id, card.contentVersion),
      (r) => `Image removed from ${card.semanticKey}. It is now ${r.qaStatus ?? 'updated'} and unpublished.`,
    )
  }

  return (
    <section aria-label={`Card image ${card.semanticKey}`} className="fcv2a-media">
      <p className="fcv2a-diag__title">Card image</p>
      <p className="fcv2a-media__req">
        <strong>Required image: </strong>
        <span>{card.mediaRequirement || 'no description given'}</span>
      </p>

      {media ? (
        <figure className="fcv2a-media__current">
          <img src={media.url} alt={media.alt || ''} loading="lazy" className="fcv2a-media__img" />
          <figcaption className="fcv2a-muted">{`Alt text: ${media.alt || '(none)'}`}</figcaption>
        </figure>
      ) : (
        <p className="fcv2a-muted">No image attached yet.</p>
      )}

      {needsConfirm && (
        <div className="fcv2a-media__confirm">
          <p className="fcv2a-text-warn">Content changed — confirm the image still matches</p>
          <button type="button" className="admin-btn-issue" onClick={() => openForm(media.alt)} disabled={busy}>
            Re-attach current image
          </button>
          <p className="fcv2a-muted">Upload the same image again, or a replacement, to confirm it.</p>
        </div>
      )}

      {media && !formOpen && !confirmingRemove && (
        <div className="fcv2a-row">
          <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => openForm('')} disabled={busy}>
            Replace image
          </button>
          <button
            type="button"
            className="admin-btn-issue admin-btn-issue--danger"
            onClick={() => {
              setError(null)
              setConfirmingRemove(true)
            }}
            disabled={busy}
          >
            {busy ? 'Removing…' : 'Remove image'}
          </button>
        </div>
      )}

      {media && confirmingRemove && (
        <div className="fcv2a-media__confirm" role="group" aria-label="Confirm image removal">
          <p className="fcv2a-text-warn">Removing the image unpublishes this card and withdraws the topic approval</p>
          <div className="fcv2a-row">
            <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={remove} disabled={busy}>
              Confirm remove
            </button>
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={() => setConfirmingRemove(false)} disabled={busy}>
              Keep image
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form className="fcv2a-media__form" onSubmit={upload}>
          <label className="fcv2a-label" htmlFor={ids.file}>
            Image file (PNG, JPEG or WebP, up to 8 MB)
          </label>
          <input
            id={ids.file}
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={busy}
          />
          <label className="fcv2a-label" htmlFor={ids.alt}>
            Alt text
          </label>
          <input
            id={ids.alt}
            type="text"
            className="fcv2a-media__alt"
            value={alt}
            maxLength={MAX_ALT}
            onChange={(e) => setAlt(e.target.value)}
            aria-describedby={ids.hint}
            disabled={busy}
          />
          <p id={ids.hint} className="fcv2a-muted">
            {ALT_HINT}
          </p>
          <div className="fcv2a-row">
            <button type="submit" className="admin-btn-issue" disabled={!canUpload}>
              {busy ? 'Uploading…' : 'Upload image'}
            </button>
            {media && (
              <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={closeForm} disabled={busy}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && <MediaError error={error} onReload={onReload} />}
    </section>
  )
}

function MediaError({ error, onReload }) {
  if (error.kind === 'stale') {
    const current = error.details?.currentVersion
    return (
      <div role="alert" className="admin-alert">
        <p>{`This card changed since you loaded it${current != null ? ` (now version ${current})` : ''}. Reload the review, then try again.`}</p>
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onReload}>
          Reload review
        </button>
      </div>
    )
  }
  return (
    <div role="alert" className="admin-alert">
      {error.message || 'The image could not be saved.'}
    </div>
  )
}
