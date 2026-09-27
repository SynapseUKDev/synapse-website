import React, { useEffect, useRef, useState } from 'react'
import { LuArrowDown, LuArrowUp, LuImagePlus, LuRefreshCw, LuTrash2 } from 'react-icons/lu'
import { removeQuestionImage, updateQuestionImages, uploadQuestionImage } from './questionAdminApi'
import {
  ACCEPTED_TYPES,
  MAX_IMAGES,
  imagesSnapshot,
  missingAltCount,
  moveImage,
  precheckImageFile,
  toEditableImages,
  toImageUpdates,
} from './questionImageModel'
import './AdminQuestions.css'

let pendingCounter = 0
const NO_IMAGES = []

function MetadataFields({ idPrefix, image, onChange, disabled }) {
  const altMissing = !image.alt.trim()
  return (
    <div className="aqg-item__fields">
      <label htmlFor={`${idPrefix}-alt`}>
        Alt text <span className={altMissing ? 'aqg-required' : 'aqf__hint'}>{altMissing ? '(required before activation)' : ''}</span>
      </label>
      <input
        id={`${idPrefix}-alt`}
        value={image.alt}
        maxLength={500}
        disabled={disabled}
        onChange={(event) => onChange({ alt: event.target.value })}
        placeholder="Describe what the image shows, e.g. 12-lead ECG with ST elevation in V1–V4"
      />
      <div className="admin-form__row">
        <label>
          Caption
          <input value={image.caption} maxLength={2000} disabled={disabled} onChange={(event) => onChange({ caption: event.target.value })} />
        </label>
        <label>
          Credit
          <input value={image.credit} maxLength={500} disabled={disabled} onChange={(event) => onChange({ credit: event.target.value })} />
        </label>
      </div>
    </div>
  )
}

/**
 * Question image manager. For a saved inactive question every upload, replace
 * and remove is saved immediately (version-checked); alt/caption/credit and
 * order edits are local until "Save image details". For a new question files
 * stay local (`pending`) and the editor uploads them right after the first save.
 */
export default function QuestionImageGallery({
  questionId,
  version,
  savedImages = NO_IMAGES,
  pending = NO_IMAGES,
  onPendingChange,
  onSaved,
  onDirtyChange,
  onPreviewChange,
  readOnly = false,
}) {
  const [images, setImages] = useState(() => toEditableImages(savedImages))
  const [baseline, setBaseline] = useState(() => imagesSnapshot(toEditableImages(savedImages)))
  const [statuses, setStatuses] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const addRef = useRef(null)
  const replaceRef = useRef(null)
  const replaceTarget = useRef(null)

  useEffect(() => {
    const editable = toEditableImages(savedImages)
    setImages(editable)
    setBaseline(imagesSnapshot(editable))
  }, [savedImages])

  const dirty = imagesSnapshot(images) !== baseline
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])
  useEffect(() => onPreviewChange?.(images), [images, onPreviewChange])

  const total = (questionId ? images.length : 0) + pending.length
  const disabled = readOnly || busy

  const applySaved = (nextImages, nextVersion) => {
    onSaved?.({ images: nextImages, version: nextVersion })
  }

  const reportError = (err) => {
    setError(err.kind === 'conflict' ? 'This question changed elsewhere. Reload the question before changing images.' : err.message)
  }

  const addFiles = async (files) => {
    setError(null)
    const room = MAX_IMAGES - total
    const chosen = Array.from(files).slice(0, Math.max(room, 0))
    const skipped = Array.from(files).length - chosen.length
    const results = chosen.map((file) => ({ name: file.name, state: 'waiting', message: '' }))
    if (skipped > 0) results.push({ name: `${skipped} more file(s)`, state: 'failed', message: `A question can have at most ${MAX_IMAGES} images.` })
    setStatuses(results)

    if (!questionId) {
      const accepted = []
      chosen.forEach((file, index) => {
        const problem = precheckImageFile(file)
        if (problem) results[index] = { ...results[index], state: 'failed', message: problem }
        else {
          pendingCounter += 1
          accepted.push({ key: `pending-${pendingCounter}`, file, url: URL.createObjectURL(file), alt: '', caption: '', credit: '' })
          results[index] = { ...results[index], state: 'ready', message: 'Uploads when the question is first saved' }
        }
      })
      setStatuses([...results])
      onPendingChange?.([...pending, ...accepted])
      return
    }

    // Saved question: upload one at a time; each success is kept even if a later file fails.
    setBusy(true)
    let currentVersion = version
    let currentImages = images
    for (let index = 0; index < chosen.length; index += 1) {
      const file = chosen[index]
      const problem = precheckImageFile(file)
      if (problem) {
        results[index] = { ...results[index], state: 'failed', message: problem }
        setStatuses([...results])
        continue
      }
      results[index] = { ...results[index], state: 'uploading' }
      setStatuses([...results])
      try {
        const data = await uploadQuestionImage(questionId, { file, expectedVersion: currentVersion })
        currentVersion = data.question_version
        currentImages = [...currentImages, data.asset]
        results[index] = { ...results[index], state: 'done' }
        applySaved(currentImages, currentVersion)
      } catch (err) {
        results[index] = { ...results[index], state: 'failed', message: err.message }
        if (err.kind === 'conflict' || err.kind === 'active_locked') {
          reportError(err)
          break
        }
      }
      setStatuses([...results])
    }
    setStatuses([...results])
    setBusy(false)
  }

  const replaceFile = async (file) => {
    const target = replaceTarget.current
    replaceTarget.current = null
    if (!file || !target) return
    setError(null)
    const problem = precheckImageFile(file)
    if (problem) return setError(problem)
    setBusy(true)
    try {
      const data = await uploadQuestionImage(questionId, { file, expectedVersion: version, replaceImageId: target })
      applySaved(images.map((image) => (image.id === target ? data.asset : image)), data.question_version)
    } catch (err) {
      reportError(err)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (image, index) => {
    if (!window.confirm(`Remove image ${index + 1}? This cannot be undone.`)) return
    setError(null)
    setBusy(true)
    try {
      const data = await removeQuestionImage(questionId, image.id, version)
      applySaved(data.images, data.question_version)
    } catch (err) {
      reportError(err)
    } finally {
      setBusy(false)
    }
  }

  const saveDetails = async () => {
    setError(null)
    setBusy(true)
    try {
      const data = await updateQuestionImages(questionId, version, toImageUpdates(images))
      applySaved(data.images, data.question_version)
    } catch (err) {
      reportError(err)
    } finally {
      setBusy(false)
    }
  }

  const updatePending = (key, patch) => onPendingChange?.(pending.map((item) => (item.key === key ? { ...item, ...patch } : item)))
  const removePending = (key) => {
    const item = pending.find((entry) => entry.key === key)
    if (item) URL.revokeObjectURL(item.url)
    onPendingChange?.(pending.filter((entry) => entry.key !== key))
  }

  const missingAlt = missingAltCount(questionId ? images : pending)

  return (
    <section
      className="aqg"
      aria-labelledby="aqg-heading"
      // The gallery sits inside the question form; Enter in its fields must not submit the question.
      onKeyDown={(event) => {
        if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault()
      }}
    >
      <div className="aqg__head">
        <h2 id="aqg-heading" className="aqe__heading">
          Images <span className="aqf__hint">({total}/{MAX_IMAGES})</span>
        </h2>
        <button type="button" className="aqe-button aqe-button--ghost" onClick={() => addRef.current?.click()} disabled={disabled || total >= MAX_IMAGES || (!!questionId && dirty)}>
          <LuImagePlus aria-hidden /> Add images
        </button>
        <input
          ref={addRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          hidden
          aria-label="Add images"
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />
        <input
          ref={replaceRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          hidden
          aria-label="Replacement image"
          onChange={(event) => {
            replaceFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
      </div>
      <p className="aqf__hint">
        PNG, JPEG or WebP up to 8 MB each. Images appear to learners in this order; several images show as a carousel.
      </p>

      {error && (
        <div className="admin-alert" role="alert">
          {error}
        </div>
      )}
      {statuses.length > 0 && (
        <ul className="aqg-status" aria-live="polite">
          {statuses.map((status, index) => (
            <li key={`${status.name}-${index}`} className={`aqg-status--${status.state}`}>
              <strong>{status.name}</strong>: {status.state === 'done' ? 'uploaded' : status.state === 'failed' ? `failed – ${status.message}` : status.state === 'ready' ? status.message : status.state}
            </li>
          ))}
        </ul>
      )}

      {missingAlt > 0 && (
        <p className="aqg-required" role="status">
          {missingAlt} image{missingAlt === 1 ? ' needs' : 's need'} alt text before this question can be activated.
        </p>
      )}

      <ol className="aqg-list">
        {questionId &&
          images.map((image, index) => (
            <li key={image.id} className="aqg-item">
              <img src={image.asset_url} alt="" className="aqg-item__thumb" />
              <div className="aqg-item__body">
                <div className="aqg-item__bar">
                  <strong>Image {index + 1}</strong>
                  <div className="aqf-option__actions">
                    <button type="button" onClick={() => setImages((list) => moveImage(list, image.id, -1))} disabled={disabled || index === 0} aria-label={`Move image ${index + 1} up`}>
                      <LuArrowUp aria-hidden />
                    </button>
                    <button type="button" onClick={() => setImages((list) => moveImage(list, image.id, 1))} disabled={disabled || index === images.length - 1} aria-label={`Move image ${index + 1} down`}>
                      <LuArrowDown aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        replaceTarget.current = image.id
                        replaceRef.current?.click()
                      }}
                      disabled={disabled || dirty}
                      aria-label={`Replace image ${index + 1}`}
                      title={dirty ? 'Save or undo image detail changes first' : undefined}
                    >
                      <LuRefreshCw aria-hidden />
                    </button>
                    <button type="button" onClick={() => remove(image, index)} disabled={disabled || dirty} aria-label={`Remove image ${index + 1}`}>
                      <LuTrash2 aria-hidden />
                    </button>
                  </div>
                </div>
                <MetadataFields
                  idPrefix={`aqg-${image.id}`}
                  image={image}
                  disabled={disabled}
                  onChange={(patch) => setImages((list) => list.map((item) => (item.id === image.id ? { ...item, ...patch } : item)))}
                />
              </div>
            </li>
          ))}
        {pending.map((item, index) => (
          <li key={item.key} className="aqg-item">
            <img src={item.url} alt="" className="aqg-item__thumb" />
            <div className="aqg-item__body">
              <div className="aqg-item__bar">
                <strong>New image {index + 1}</strong> <span className="aqf__hint">not uploaded yet</span>
                <div className="aqf-option__actions">
                  <button type="button" onClick={() => removePending(item.key)} disabled={disabled} aria-label={`Remove new image ${index + 1}`}>
                    <LuTrash2 aria-hidden />
                  </button>
                </div>
              </div>
              <MetadataFields idPrefix={`aqg-${item.key}`} image={item} disabled={disabled} onChange={(patch) => updatePending(item.key, patch)} />
            </div>
          </li>
        ))}
      </ol>

      {questionId && images.length > 0 && (
        <div className="aqe__actions">
          <button type="button" className="aqe-button" onClick={saveDetails} disabled={disabled || !dirty}>
            {busy ? 'Saving…' : 'Save image details and order'}
          </button>
          {dirty && (
            <button type="button" className="aqe-button aqe-button--ghost" onClick={() => setImages(toEditableImages(savedImages))} disabled={busy}>
              Undo image changes
            </button>
          )}
        </div>
      )}
    </section>
  )
}
