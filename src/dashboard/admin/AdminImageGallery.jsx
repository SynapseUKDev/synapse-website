import React, { useEffect, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'
import './AdminImageGallery.css'

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',').pop() : result)
    }
    reader.onerror = () => reject(reader.error || new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

function imageMimeForUpload(file) {
  const t = file?.type
  if (t && /^image\/(png|jpe?g|webp|gif|svg\+xml)$/i.test(t)) return t
  return 'image/png'
}

async function readJsonError(res) {
  const json = await res.json().catch(() => ({}))
  return json?.error ? JSON.stringify(json.error) : 'Request failed'
}

/**
 * Shared admin image uploader (textbook blocks + question assets).
 * variant="textbook" → attribution + license fields
 * variant="question" → credit field
 */
export default function AdminImageGallery({
  API_BASE,
  images,
  setImages,
  uploadError,
  setUploadError,
  onBusyChange = () => {},
  variant = 'textbook',
  emptyHint = 'No images yet. Use "Add from device" to choose one or more images (they upload automatically).',
}) {
  const [uploadingBulk, setUploadingBulk] = useState(false)
  const [replacingIdx, setReplacingIdx] = useState(null)

  useEffect(() => {
    onBusyChange(Boolean(uploadingBulk || replacingIdx !== null))
  }, [uploadingBulk, replacingIdx, onBusyChange])

  const emit = (next) => setImages(next)

  const updateImage = (index, patch) => {
    emit(images.map((img, i) => (i === index ? { ...img, ...patch } : img)))
  }

  const removeImage = (index) => {
    emit(images.filter((_, i) => i !== index))
  }

  const moveImage = (index, direction) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= images.length) return
    const next = [...images]
    const [item] = next.splice(index, 1)
    next.splice(nextIndex, 0, item)
    emit(next)
  }

  const uploadOne = async (file) => {
    const dataBase64 = await fileToBase64(file)
    const res = await authenticatedFetch(`${API_BASE}/admin/textbook/images/upload`, {
      method: 'POST',
      body: JSON.stringify({
        filename: file.name,
        mime_type: imageMimeForUpload(file),
        data_base64: dataBase64,
      }),
    })
    if (!res.ok) throw new Error(await readJsonError(res))
    const json = await res.json()
    return {
      url: json.url,
      alt: file.name.replace(/\.[^.]+$/, ''),
      caption: '',
      attribution: '',
      license: '',
      credit: '',
    }
  }

  const appendFromFiles = async (fileList) => {
    const list = Array.from(fileList || []).filter(Boolean)
    if (!list.length) return
    setUploadingBulk(true)
    setUploadError('')
    try {
      const next = [...images]
      for (const file of list) {
        const uploaded = await uploadOne(file)
        next.push(uploaded)
      }
      emit(next)
    } catch (e) {
      setUploadError(e.message || 'Could not upload image.')
    } finally {
      setUploadingBulk(false)
    }
  }

  const replaceAt = async (index, file) => {
    if (!file) return
    setReplacingIdx(index)
    setUploadError('')
    try {
      const uploaded = await uploadOne(file)
      updateImage(index, {
        ...uploaded,
        caption: images[index]?.caption || '',
        attribution: images[index]?.attribution || '',
        license: images[index]?.license || '',
        credit: images[index]?.credit || '',
      })
    } catch (e) {
      setUploadError(e.message || 'Could not upload image.')
    } finally {
      setReplacingIdx(null)
    }
  }

  const kindLabel = images.length <= 1 ? 'Single image' : `${images.length} images (carousel)`

  return (
    <div className="admin-img-gallery">
      <div className="admin-img-gallery__head">
        <div>
          <strong>Images</strong>
          <span>{kindLabel}</span>
        </div>
        <label className="admin-img-gallery__upload-btn">
          {uploadingBulk ? 'Uploading…' : 'Add from device'}
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              appendFromFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
      </div>

      {images.length === 0 && (
        <div className="admin-img-gallery__empty">{emptyHint}</div>
      )}

      {images.map((img, index) => (
        <div key={`${img.url || 'row'}-${index}`} className="admin-img-gallery__item">
          <div className="admin-img-gallery__preview">
            {img.url ? <img src={img.url} alt={img.alt || ''} /> : <span>Needs image</span>}
          </div>
          <div className="admin-img-gallery__fields">
            <label>
              <span>Alt text</span>
              <input value={img.alt} onChange={(e) => updateImage(index, { alt: e.target.value })} />
            </label>
            <label>
              <span>Caption</span>
              <input value={img.caption} onChange={(e) => updateImage(index, { caption: e.target.value })} />
            </label>
            {variant === 'textbook' ? (
              <div className="admin-img-gallery__grid">
                <label>
                  <span>Attribution</span>
                  <input value={img.attribution} onChange={(e) => updateImage(index, { attribution: e.target.value })} />
                </label>
                <label>
                  <span>License</span>
                  <input value={img.license} onChange={(e) => updateImage(index, { license: e.target.value })} />
                </label>
              </div>
            ) : (
              <label>
                <span>Credit</span>
                <input value={img.credit} onChange={(e) => updateImage(index, { credit: e.target.value })} />
              </label>
            )}
            <details className="admin-img-gallery__manual">
              <summary>Manual image URL</summary>
              <label>
                <span>URL</span>
                <input value={img.url} onChange={(e) => updateImage(index, { url: e.target.value })} />
              </label>
            </details>
          </div>
          <div className="admin-img-gallery__actions">
            <label className="admin-img-gallery__upload-btn admin-img-gallery__upload-btn--small">
              {replacingIdx === index ? 'Uploading…' : 'Replace file'}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  replaceAt(index, e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </label>
            <button type="button" className="admin-img-gallery__btn admin-img-gallery__btn--ghost" onClick={() => moveImage(index, -1)} disabled={index === 0}>Up</button>
            <button type="button" className="admin-img-gallery__btn admin-img-gallery__btn--ghost" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1}>Down</button>
            <button type="button" className="admin-img-gallery__btn admin-img-gallery__btn--danger" onClick={() => removeImage(index)}>Remove</button>
          </div>
        </div>
      ))}

      {uploadError && <div className="admin-img-gallery__error">{uploadError}</div>}
    </div>
  )
}
