import { useId, useState } from 'react'
import { importTopicRun } from './flashcardsV2AdminApi'
import { plural } from './reviewModel'

function summary(r) {
  const n = r.retiredCandidates?.length ?? 0
  return (
    `Imported: ${r.inserted ?? 0} inserted, ${r.changed ?? 0} changed, ${r.unchanged ?? 0} unchanged, ` +
    `${r.reactivated ?? 0} reactivated; ${plural(n, 'retire candidate')}` +
    (r.idempotent ? ' (this run was already imported; nothing changed).' : '.')
  )
}

/** Optional: upload one TopicRun JSON file produced by the generation pipeline (imported unpublished). */
export default function ImportRunControl({ onImported }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState(null) // {tone, text, issues?}
  const id = useId()

  async function onFile(event) {
    const input = event.target
    const file = input.files?.[0]
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      let artifact
      try {
        artifact = JSON.parse(await file.text())
      } catch (e) {
        setMessage({ tone: 'error', text: `${file.name} is not valid JSON (${e?.name || 'Error'}: ${e?.message || 'parse failed'}).` })
        return
      }
      try {
        const result = await importTopicRun(artifact)
        setMessage({ tone: 'info', text: summary(result ?? {}) })
        onImported?.(result)
      } catch (e) {
        setMessage({
          tone: 'error',
          text: `Import failed: ${e.message}${e.code ? ` (${e.code})` : ''}`,
          issues: Array.isArray(e.details) ? e.details.slice(0, 10) : [],
        })
      }
    } finally {
      setBusy(false)
      input.value = ''
    }
  }

  return (
    <div className="fcv2a-import">
      <label htmlFor={id} className="fcv2a-label">
        Import TopicRun JSON
      </label>
      <input id={id} type="file" accept="application/json,.json" onChange={onFile} disabled={busy} />
      <div role="status" aria-live="polite">
        {busy && <p className="fcv2a-muted">Importing…</p>}
        {message && <p className={message.tone === 'error' ? 'fcv2a-text-error' : undefined}>{message.text}</p>}
        {message?.issues?.length > 0 && (
          <ul>
            {message.issues.map((i, n) => (
              <li key={n}>{`${i.path || 'artifact'}: ${i.message}`}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
