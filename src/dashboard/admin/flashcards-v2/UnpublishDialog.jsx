import { useId, useState } from 'react'
import Dialog from './Dialog'

export default function UnpublishDialog({ topicName, busy, error, onConfirm, onCancel }) {
  const [reason, setReason] = useState('')
  const id = useId()
  const blank = reason.trim() === ''
  return (
    <Dialog title={`Unpublish ${topicName}?`} onClose={onCancel}>
      <label htmlFor={id} className="fcv2a-label">
        Reason for unpublishing
      </label>
      <textarea id={id} rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      <p className="fcv2a-muted">Every published card of the topic is hidden from learners and the approval is withdrawn.</p>
      {error && (
        <div role="alert" className="admin-alert">
          {`${error.message}${error.code ? ` (${error.code})` : ''}`}
        </div>
      )}
      <div className="fcv2a-row fcv2a-dialog__actions">
        <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="admin-btn-issue admin-btn-issue--danger" onClick={() => onConfirm(reason.trim())} disabled={busy || blank}>
          {busy ? 'Unpublishing…' : 'Confirm unpublish'}
        </button>
      </div>
    </Dialog>
  )
}
