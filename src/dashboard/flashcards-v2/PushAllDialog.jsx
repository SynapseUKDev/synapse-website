import { useState } from 'react'
import Dialog from '../admin/flashcards-v2/Dialog'
import { pushAllLive } from '../admin/flashcards-v2/flashcardsV2AdminApi'
import '../admin/flashcards-v2/AdminFlashcardsV2.css'

export const PUSH_ALL_PHRASE = 'PUSH ALL'

/**
 * "Push all approved live": every approved card in every topic goes live at once, so the admin has to
 * type PUSH ALL first. Afterwards it reports how many were pushed and how many were skipped.
 * onDone() runs when the dialog closes after a successful push (the owner reloads its topic counts).
 */
export default function PushAllDialog({ onClose, onDone }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  async function submit(event) {
    event.preventDefault()
    if (typed !== PUSH_ALL_PHRASE || busy) return
    setBusy(true)
    setError(null)
    try {
      setResult(await pushAllLive())
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (result) onDone?.()
    onClose()
  }

  return (
    <Dialog title="Push all approved live" onClose={close}>
      {result ? (
        <>
          <p role="status">{`${result.changed} ${result.changed === 1 ? 'card' : 'cards'} pushed live, ${result.skippedCount ?? result.skipped?.length ?? 0} skipped`}</p>
          <div className="fcv2a-row fcv2a-dialog__actions">
            <button type="button" className="admin-btn-issue" onClick={close}>
              Close
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          <p>Every approved card in every topic becomes visible to learners. Cards that cannot go live are skipped.</p>
          <label className="fcv2a-field">
            {`Type ${PUSH_ALL_PHRASE} to confirm`}
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
          </label>
          {error && (
            <div role="alert" className="admin-alert">
              {`${error.message || 'The request failed.'}${error.code ? ` (${error.code})` : ''}`}
            </div>
          )}
          <div className="fcv2a-row fcv2a-dialog__actions">
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={close} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="admin-btn-issue" disabled={typed !== PUSH_ALL_PHRASE || busy}>
              {busy ? 'Pushing…' : 'Push all live'}
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
