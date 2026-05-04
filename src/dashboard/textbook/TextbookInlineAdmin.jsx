import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { LuX } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'

const SECTION_TYPES = [
  'overview',
  'pathophysiology',
  'epidemiology_risk_factors',
  'clinical_features',
  'investigations',
  'management',
  'complications',
  'prognosis',
  'references',
  'custom',
]

const BLOCK_TYPES = ['markdown', 'image', 'quote', 'table', 'code', 'math']

async function readJsonError(res) {
  const json = await res.json().catch(() => ({}))
  return json?.error ? JSON.stringify(json.error) : 'Request failed'
}

function useAutosizeTextarea(value) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])
  return ref
}

function useSaveFlash() {
  const [flashing, setFlashing] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  function trigger(ms = 1400) {
    setFlashing(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setFlashing(false), ms)
  }
  return [flashing, trigger]
}

function normalizeImageItems(data) {
  if (Array.isArray(data?.images)) {
    return data.images.map((img) => ({
      url: img?.url || '',
      alt: img?.alt || '',
      caption: img?.caption || '',
      attribution: img?.attribution || '',
      license: img?.license || '',
    }))
  }
  if (data?.url) {
    return [{
      url: data.url || '',
      alt: data.alt || '',
      caption: data.caption || '',
      attribution: data.attribution || '',
      license: data.license || '',
    }]
  }
  return []
}

function imageItemsFromBlock(block) {
  if (!block) return []
  return normalizeImageItems(block.data || {})
}

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

function ImageGalleryFields({ API_BASE, images, setImages, uploadError, setUploadError, onBusyChange = () => {} }) {
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
      })
    } catch (e) {
      setUploadError(e.message || 'Could not upload image.')
    } finally {
      setReplacingIdx(null)
    }
  }

  const kindLabel = images.length <= 1 ? 'Single image' : `${images.length} images (carousel)`

  return (
    <div className="tb-admin-image-editor">
      <div className="tb-admin-image-editor__head">
        <div>
          <strong>Images in this block</strong>
          <span>{kindLabel}</span>
        </div>
        <label className="tb-admin-upload-btn">
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
        <div className="tb-admin-image-empty">
          No images yet. Use &quot;Add from device&quot; to choose one or more images (they upload automatically).
        </div>
      )}

      {images.map((img, index) => (
        <div key={`${img.url || 'row'}-${index}`} className="tb-admin-image-item">
          <div className="tb-admin-image-item__preview">
            {img.url ? <img src={img.url} alt={img.alt || ''} /> : <span>Needs image</span>}
          </div>
          <div className="tb-admin-image-item__fields">
            <label>
              <span>Alt text</span>
              <input value={img.alt} onChange={(e) => updateImage(index, { alt: e.target.value })} />
            </label>
            <label>
              <span>Caption</span>
              <input value={img.caption} onChange={(e) => updateImage(index, { caption: e.target.value })} />
            </label>
            <div className="tb-admin-image-item__grid">
              <label>
                <span>Attribution</span>
                <input value={img.attribution} onChange={(e) => updateImage(index, { attribution: e.target.value })} />
              </label>
              <label>
                <span>License</span>
                <input value={img.license} onChange={(e) => updateImage(index, { license: e.target.value })} />
              </label>
            </div>
            <details className="tb-admin-image-item__manual">
              <summary>Manual image URL</summary>
              <label>
                <span>URL</span>
                <input value={img.url} onChange={(e) => updateImage(index, { url: e.target.value })} />
              </label>
            </details>
          </div>
          <div className="tb-admin-image-item__actions">
            <label className="tb-admin-upload-btn tb-admin-upload-btn--small">
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
            <button type="button" className="tb-admin-btn tb-admin-btn--ghost" onClick={() => moveImage(index, -1)} disabled={index === 0}>Up</button>
            <button type="button" className="tb-admin-btn tb-admin-btn--ghost" onClick={() => moveImage(index, 1)} disabled={index === images.length - 1}>Down</button>
            <button type="button" className="tb-admin-btn tb-admin-btn--danger" onClick={() => removeImage(index)}>Remove</button>
          </div>
        </div>
      ))}

      {uploadError && <div className="tb-admin-error tb-admin-error--block">{uploadError}</div>}
    </div>
  )
}

function TextbookAdminImageModal({
  mode,
  sectionId,
  block,
  API_BASE,
  onClose,
  onSaved,
}) {
  const isEdit = mode === 'edit'
  const [images, setImages] = useState(() => (isEdit ? imageItemsFromBlock(block) : []))
  const [position, setPosition] = useState(() => (isEdit ? String(block?.position ?? 1) : ''))
  const [uploadError, setUploadError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving && !uploadBusy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving, uploadBusy])

  const busy = saving || uploadBusy

  const validImages = images.filter((i) => String(i.url || '').trim())

  async function handleSubmit() {
    if (validImages.length === 0) {
      setSaveError('Add at least one image.')
      return
    }
    setSaving(true)
    setSaveError('')
    try {
      if (isEdit) {
        const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${block.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            block_type: 'image',
            content: null,
            data: { images: validImages },
            position: Number(position) || 1,
          }),
        })
        if (!res.ok) throw new Error(await readJsonError(res))
      } else {
        const res = await authenticatedFetch(`${API_BASE}/admin/textbook/sections/${sectionId}/blocks`, {
          method: 'POST',
          body: JSON.stringify({
            block_type: 'image',
            data: { images: validImages },
          }),
        })
        if (!res.ok) throw new Error(await readJsonError(res))
      }
      if (onSaved) await onSaved()
      onClose()
    } catch (e) {
      setSaveError(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteBlock() {
    if (!isEdit || !block) return
    if (!window.confirm('Delete this entire image block? This cannot be undone.')) return
    setSaving(true)
    setSaveError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${block.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readJsonError(res))
      if (onSaved) await onSaved()
      onClose()
    } catch (e) {
      setSaveError(e.message || 'Could not delete block.')
    } finally {
      setSaving(false)
    }
  }

  const title = isEdit ? 'Edit images' : 'Add images'
  const hint = 'Images upload to Supabase. Two or more images in this block show as a carousel with navigation.'

  const modal = (
    <div
      className="tb-admin-img-modal-overlay"
      role="presentation"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose() }}
    >
      <div
        className="tb-admin-img-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tb-admin-img-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="tb-admin-img-modal__header">
          <div>
            <h2 id="tb-admin-img-modal-title">{title}</h2>
            <p className="tb-admin-img-modal__hint">{hint}</p>
          </div>
          <button type="button" className="tb-admin-img-modal__close" onClick={() => !busy && onClose()} aria-label="Close">
            <LuX size={20} />
          </button>
        </div>
        <div className="tb-admin-img-modal__body">
          <ImageGalleryFields
            API_BASE={API_BASE}
            images={images}
            setImages={setImages}
            uploadError={uploadError}
            setUploadError={setUploadError}
            onBusyChange={setUploadBusy}
          />
          {isEdit && (
            <label className="tb-admin-img-modal__position">
              <span>Block position</span>
              <input type="number" min="1" value={position} onChange={(e) => setPosition(e.target.value)} disabled={busy} />
            </label>
          )}
        </div>
        <div className="tb-admin-img-modal__footer">
          <div className="tb-admin-img-modal__footer-left">
            {isEdit && (
              <button type="button" className="tb-admin-btn tb-admin-btn--danger" disabled={busy} onClick={handleDeleteBlock}>
                Delete block
              </button>
            )}
          </div>
          <div className="tb-admin-img-modal__footer-right">
            <button type="button" className="tb-admin-btn tb-admin-btn--ghost" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="tb-admin-btn" disabled={busy} onClick={handleSubmit}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add to section'}
            </button>
          </div>
        </div>
        {saveError && <div className="tb-admin-img-modal__save-error">{saveError}</div>}
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

export function InlinePageBar({ page, API_BASE, onSaved }) {
  const [form, setForm] = useState({
    title: page.title || '',
    slug: page.slug || '',
    status: page.status || 'draft',
    summary: page.summary || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [savedFlash, flashSaved] = useSaveFlash()

  useEffect(() => {
    setForm({
      title: page.title || '',
      slug: page.slug || '',
      status: page.status || 'draft',
      summary: page.summary || '',
    })
  }, [page.id, page.updated_at, page.title, page.slug, page.status, page.summary])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/pages/${page.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: form.title,
          slug: form.slug,
          status: form.status,
          summary: form.summary || null,
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      if (onSaved) await onSaved()
      flashSaved()
    } catch (e) {
      setError(e.message || 'Could not save page.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tb-admin-page-bar">
      <div className="tb-admin-page-bar__row">
        <button
          type="button"
          className="tb-admin-page-bar__toggle"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? '− Page metadata' : '+ Page metadata'}
        </button>
        <span className="tb-admin-page-bar__hint">Status: {form.status}</span>
      </div>
      {open && (
        <div className="tb-admin-page-bar__fields">
          <label>
            <span>Title</span>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label>
            <span>Slug</span>
            <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          </label>
          <label>
            <span>Status</span>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </label>
          <label className="tb-admin-page-bar__summary">
            <span>Summary</span>
            <textarea
              rows={3}
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <div className="tb-admin-page-bar__actions">
            <button type="button" className="tb-admin-btn" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save page'}
            </button>
            {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
            {error && <span className="tb-admin-error">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

export function InlineSectionToolbar({ section, API_BASE, onSaved }) {
  const [form, setForm] = useState({
    position: section.position ?? 1,
    section_type: section.section_type || 'custom',
    anchor_slug: section.anchor_slug || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flashSaved] = useSaveFlash()
  const [imageModalOpen, setImageModalOpen] = useState(false)

  useEffect(() => {
    setForm({
      position: section.position ?? 1,
      section_type: section.section_type || 'custom',
      anchor_slug: section.anchor_slug || '',
    })
  }, [section.id, section.updated_at, section.position, section.section_type, section.anchor_slug])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/sections/${section.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          position: Number(form.position) || 1,
          section_type: form.section_type,
          anchor_slug: form.anchor_slug,
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      if (onSaved) await onSaved()
      flashSaved()
    } catch (e) {
      setError(e.message || 'Could not save section.')
    } finally {
      setSaving(false)
    }
  }

  const closeImageModal = () => setImageModalOpen(false)

  return (
    <div className="tb-admin-toolbar">
      <label className="tb-admin-toolbar__field">
        <span>Position</span>
        <input
          type="number"
          min="1"
          value={form.position}
          onChange={(e) => setForm({ ...form, position: e.target.value })}
        />
      </label>
      <label className="tb-admin-toolbar__field tb-admin-toolbar__field--type">
        <span>Type</span>
        <select
          value={form.section_type}
          onChange={(e) => setForm({ ...form, section_type: e.target.value })}
        >
          {SECTION_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>
      <label className="tb-admin-toolbar__field tb-admin-toolbar__field--slug">
        <span>Anchor slug</span>
        <input
          value={form.anchor_slug}
          onChange={(e) => setForm({ ...form, anchor_slug: e.target.value })}
        />
      </label>
      <button type="button" className="tb-admin-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="tb-admin-btn tb-admin-btn--ghost" onClick={() => setImageModalOpen(true)}>
        + Image
      </button>
      {imageModalOpen && (
        <TextbookAdminImageModal
          key={`add-img-${section.id}`}
          mode="create"
          sectionId={section.id}
          API_BASE={API_BASE}
          onClose={closeImageModal}
          onSaved={async () => {
            if (onSaved) await onSaved()
            flashSaved()
          }}
        />
      )}
      {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
      {error && <span className="tb-admin-error">{error}</span>}
    </div>
  )
}

export function InlineEditableTitle({ section, API_BASE, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(section.title || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flashSaved] = useSaveFlash()

  useEffect(() => { setValue(section.title || '') }, [section.id, section.updated_at, section.title])

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/sections/${section.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: value }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      if (onSaved) await onSaved()
      flashSaved(900)
      setTimeout(() => setEditing(false), 600)
    } catch (e) {
      setError(e.message || 'Could not save title.')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <h2
        className="tb-section__title tb-admin-editable"
        title="Click to edit title"
        onClick={() => setEditing(true)}
      >
        {section.title}
      </h2>
    )
  }

  return (
    <div className="tb-admin-title-edit">
      <input
        autoFocus
        className="tb-admin-title-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave()
          if (e.key === 'Escape') { setEditing(false); setValue(section.title || '') }
        }}
      />
      <button type="button" className="tb-admin-btn" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button
        type="button"
        className="tb-admin-btn tb-admin-btn--ghost"
        onClick={() => { setEditing(false); setValue(section.title || '') }}
      >
        Cancel
      </button>
      {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
      {error && <span className="tb-admin-error">{error}</span>}
    </div>
  )
}

export function InlineMarkdownBlock({ block, API_BASE, onSaved, children }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(block.content || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flashSaved] = useSaveFlash()
  const taRef = useAutosizeTextarea(editing ? value : '')
  // Pending blur-triggered save can be cancelled by a Cancel click before it fires.
  const pendingSaveRef = useRef(null)
  const valueRef = useRef(value)
  useEffect(() => { valueRef.current = value }, [value])

  useEffect(() => { setValue(block.content || '') }, [block.id, block.updated_at, block.content])

  async function performSave({ closeAfter } = { closeAfter: true }) {
    const current = valueRef.current
    if (current === (block.content || '')) {
      if (closeAfter) setEditing(false)
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ block_type: 'markdown', content: current }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      // Wait for the parent to confirm the canonical refetch finished before
      // declaring success so the UI never previews stale post-save state.
      if (onSaved) await onSaved()
      flashSaved(1100)
      if (closeAfter) {
        setTimeout(() => setEditing(false), 600)
      }
    } catch (e) {
      setError(e.message || 'Could not save block.')
    } finally {
      setSaving(false)
    }
  }

  function clearPendingSave() {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = null
    }
  }

  function handleCancel() {
    clearPendingSave()
    setEditing(false)
    setValue(block.content || '')
  }

  function handleTextareaBlur() {
    // Slight defer so an in-flight Cancel click can preempt the auto-save.
    clearPendingSave()
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null
      performSave({ closeAfter: true })
    }, 80)
  }

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  if (!editing) {
    return (
      <div
        className="tb-admin-editable tb-admin-editable--block"
        title="Click to edit markdown"
        onClick={(e) => {
          if (e.target.closest('.hl-mark__delete') || e.target.closest('mark.tb-user-mark')) return
          setEditing(true)
        }}
      >
        {children}
      </div>
    )
  }

  return (
    <div className="tb-admin-markdown-edit">
      <textarea
        ref={taRef}
        className="tb-admin-textarea"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleTextareaBlur}
        onKeyDown={handleKeyDown}
        autoFocus
      />
      <div className="tb-admin-markdown-edit__actions">
        <span className="tb-admin-hint">
          {saving ? 'Saving…' : 'Click outside to save · Esc to discard'}
        </span>
        <button
          type="button"
          className="tb-admin-btn tb-admin-btn--ghost"
          onMouseDown={(e) => { e.preventDefault(); clearPendingSave() }}
          onClick={handleCancel}
        >
          Cancel
        </button>
        {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
        {error && <span className="tb-admin-error">{error}</span>}
      </div>
    </div>
  )
}

export function InlineNonMarkdownBlock({ block, API_BASE, onSaved, children }) {
  const isImageBlock = block.block_type === 'image'
  const [open, setOpen] = useState(false)
  const initialFormFromBlock = (b) => ({
    block_type: b.block_type || 'markdown',
    position: b.position ?? 1,
    content: b.content || '',
    data: b.data ? JSON.stringify(b.data, null, 2) : '{}',
  })
  const [form, setForm] = useState(() => initialFormFromBlock(block))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [savedFlash, flashSaved] = useSaveFlash()
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const formRef = useRef(form)
  useEffect(() => { formRef.current = form }, [form])
  // Snapshot of last-saved form so we don't fire redundant PATCH calls
  const lastSavedRef = useRef(initialFormFromBlock(block))
  const pendingSaveRef = useRef(null)

  useEffect(() => {
    const next = initialFormFromBlock(block)
    setForm(next)
    lastSavedRef.current = next
  }, [block.id, block.updated_at, block.block_type, block.position, block.content, block.data])

  function clearPendingSave() {
    if (pendingSaveRef.current) {
      clearTimeout(pendingSaveRef.current)
      pendingSaveRef.current = null
    }
  }

  async function performSave(nextForm = null) {
    const current = nextForm || formRef.current
    const last = lastSavedRef.current
    const same =
      current.block_type === last.block_type &&
      String(current.position) === String(last.position) &&
      current.content === last.content &&
      current.data === last.data
    if (same) return
    setSaving(true)
    setError('')
    try {
      let parsedData = {}
      if (current.data.trim()) {
        parsedData = JSON.parse(current.data)
      }
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          block_type: current.block_type,
          position: Number(current.position) || 1,
          content: current.content || null,
          data: parsedData,
        }),
      })
      if (!res.ok) throw new Error(await readJsonError(res))
      lastSavedRef.current = current
      if (onSaved) await onSaved()
      flashSaved(1200)
    } catch (e) {
      setError(e.message || 'Could not save block.')
    } finally {
      setSaving(false)
    }
  }

  function handleFormBlur(e) {
    // Only act if focus is leaving the form entirely (not jumping to another field)
    if (e.currentTarget.contains(e.relatedTarget)) return
    clearPendingSave()
    pendingSaveRef.current = setTimeout(() => {
      pendingSaveRef.current = null
      performSave()
    }, 80)
  }

  function handleClose() {
    clearPendingSave()
    // Final flush in case there are unsaved changes
    performSave()
    setOpen(false)
  }

  async function handleDeleteBlock() {
    if (!window.confirm('Delete this block? This cannot be undone.')) return
    clearPendingSave()
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/textbook/blocks/${block.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await readJsonError(res))
      if (onSaved) await onSaved()
    } catch (e) {
      setError(e.message || 'Could not delete block.')
    } finally {
      setSaving(false)
    }
  }

  const closeImageModal = () => setImageModalOpen(false)

  return (
    <div className="tb-admin-block-wrap">
      {isImageBlock && (
        <div className="tb-admin-image-block__toolbar">
          <button type="button" className="tb-admin-btn tb-admin-btn--ghost" onClick={() => setImageModalOpen(true)}>
            Edit images
          </button>
          {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
        </div>
      )}
      <div
        className="tb-admin-editable tb-admin-editable--block"
        title={isImageBlock ? undefined : 'Click to edit block'}
        onClick={() => { if (!isImageBlock) setOpen((o) => !o) }}
      >
        {children}
      </div>
      {isImageBlock && imageModalOpen && (
        <TextbookAdminImageModal
          key={`edit-img-${block.id}`}
          mode="edit"
          block={block}
          API_BASE={API_BASE}
          onClose={closeImageModal}
          onSaved={async () => {
            if (onSaved) await onSaved()
            flashSaved(1200)
          }}
        />
      )}
      {!isImageBlock && open && (
        <div className="tb-admin-block-form" tabIndex={-1} onBlur={handleFormBlur}>
          <div className="tb-admin-block-form__row">
            <label>
              <span>Type</span>
              <select
                value={form.block_type}
                onChange={(e) => setForm({ ...form, block_type: e.target.value })}
              >
                {BLOCK_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Position</span>
              <input
                type="number"
                min="1"
                value={form.position}
                onChange={(e) => setForm({ ...form, position: e.target.value })}
              />
            </label>
          </div>
          <>
            <label>
              <span>Content</span>
              <textarea
                rows={6}
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
              />
            </label>
            <label>
              <span>Data JSON</span>
              <textarea
                rows={6}
                value={form.data}
                onChange={(e) => setForm({ ...form, data: e.target.value })}
              />
            </label>
          </>
          <div className="tb-admin-block-form__actions">
            <span className="tb-admin-hint">
              {saving ? 'Saving…' : 'Changes save automatically when you click outside the form'}
            </span>
            <button
              type="button"
              className="tb-admin-btn tb-admin-btn--danger"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleDeleteBlock}
              disabled={saving}
            >
              Delete block
            </button>
            <button
              type="button"
              className="tb-admin-btn tb-admin-btn--ghost"
              onClick={handleClose}
            >
              Close
            </button>
            {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
            {error && <span className="tb-admin-error">{error}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
