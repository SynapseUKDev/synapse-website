import { useEffect, useId, useRef, useState } from 'react'
import { ALT_HELP, IMAGE_LIMITS, IMAGE_TYPES, MAX_IMAGE_MB, validateImageForm } from './imageRules'

/**
 * Image upload form for one side of a card (shared by the needs-attention queue and the Flashcards
 * page Manage mode). It validates before anything is sent; the owner does the upload.
 *
 * side 'front' | 'back' (labels only); busy; initial {alt, attribution, license, sourceUrl} to prefill;
 * onSubmit({file, alt, attribution, license, sourceUrl}) with trimmed text; onCancel() (button shown
 * only when given).
 */
export default function ImageForm({ side = 'front', busy = false, initial, onSubmit, onCancel }) {
  const [file, setFile] = useState(null)
  const [values, setValues] = useState(() => ({
    alt: initial?.alt ?? '',
    attribution: initial?.attribution ?? '',
    license: initial?.license ?? '',
    sourceUrl: initial?.sourceUrl ?? '',
  }))
  const [problems, setProblems] = useState([])
  const fileRef = useRef(null)
  const ids = { file: useId(), alt: useId(), help: useId(), attribution: useId(), license: useId(), sourceUrl: useId() }
  const sideLabel = side === 'back' ? 'Back' : 'Front'

  useEffect(() => {
    fileRef.current?.focus()
  }, [])

  const set = (key) => (event) => setValues((v) => ({ ...v, [key]: event.target.value }))

  function submit(event) {
    event.preventDefault()
    if (busy) return
    const found = validateImageForm({ file, ...values })
    setProblems(found)
    if (found.length > 0) return
    onSubmit?.({
      file,
      alt: values.alt.trim(),
      attribution: values.attribution.trim(),
      license: values.license.trim(),
      sourceUrl: values.sourceUrl.trim(),
    })
  }

  return (
    <form className="fcv2a-media__form" aria-label={`${sideLabel} image form`} onSubmit={submit} noValidate>
      <label className="fcv2a-label" htmlFor={ids.file}>
        {`${sideLabel} image file (PNG, JPEG or WebP, up to ${MAX_IMAGE_MB} MB)`}
      </label>
      <input
        id={ids.file}
        ref={fileRef}
        type="file"
        accept={IMAGE_TYPES.join(',')}
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
        value={values.alt}
        maxLength={IMAGE_LIMITS.alt}
        onChange={set('alt')}
        aria-describedby={ids.help}
        aria-required="true"
        disabled={busy}
      />
      <p id={ids.help} className="fcv2a-muted">
        {ALT_HELP}
      </p>
      <label className="fcv2a-label" htmlFor={ids.attribution}>
        Attribution (optional)
      </label>
      <input
        id={ids.attribution}
        type="text"
        className="fcv2a-media__alt"
        value={values.attribution}
        maxLength={IMAGE_LIMITS.attribution}
        onChange={set('attribution')}
        disabled={busy}
      />
      <label className="fcv2a-label" htmlFor={ids.license}>
        Licence (optional)
      </label>
      <input
        id={ids.license}
        type="text"
        className="fcv2a-media__alt"
        value={values.license}
        maxLength={IMAGE_LIMITS.license}
        onChange={set('license')}
        disabled={busy}
      />
      <label className="fcv2a-label" htmlFor={ids.sourceUrl}>
        Source URL (optional)
      </label>
      <input
        id={ids.sourceUrl}
        type="url"
        className="fcv2a-media__alt"
        value={values.sourceUrl}
        maxLength={IMAGE_LIMITS.sourceUrl}
        onChange={set('sourceUrl')}
        placeholder="https://"
        disabled={busy}
      />
      {problems.length > 0 && (
        <div role="alert" className="admin-alert">
          <ul>
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="fcv2a-row">
        <button type="submit" className="admin-btn-issue" disabled={busy}>
          {busy ? 'Uploading…' : `Upload ${side} image`}
        </button>
        {onCancel && (
          <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
