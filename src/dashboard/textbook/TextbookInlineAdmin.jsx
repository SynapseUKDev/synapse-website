import React, { useEffect, useRef, useState } from 'react'
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

  async function performSave() {
    const current = formRef.current
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

  return (
    <div className="tb-admin-block-wrap">
      <div
        className="tb-admin-editable tb-admin-editable--block"
        title="Click to edit block"
        onClick={() => setOpen((o) => !o)}
      >
        {children}
      </div>
      {open && (
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
          <div className="tb-admin-block-form__actions">
            <span className="tb-admin-hint">
              {saving ? 'Saving…' : 'Changes save automatically when you click outside the form'}
            </span>
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
