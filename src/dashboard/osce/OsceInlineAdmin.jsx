import React, { useState, useEffect, useRef } from 'react'
import { LuPlus, LuMinus, LuTrash2, LuPencil, LuChevronDown, LuX, LuSave, LuEye, LuEyeOff } from 'react-icons/lu'
import MDEditor from '@uiw/react-md-editor'
import { authenticatedFetch } from '../../auth/token'
import OsceBlockRenderer from './OsceBlockRenderer'
import { SortableList, DragHandle } from './OsceSortable'

const STATION_TYPES = [
  'history_taking', 'examination', 'communication', 'procedural', 'emergency',
  'data_interpretation', 'prescribing', 'documentation', 'paeds_obs_gynae'
]
const DIFFICULTIES = ['easy', 'medium', 'hard']
const CONTENT_STATUSES = ['draft', 'published', 'archived']
const SESSION_ROLES = ['candidate', 'examiner', 'patient', 'observer']
const BLOCK_TYPES = ['markdown', 'checklist', 'key_value', 'callout', 'image', 'table', 'list']
const formatBlockType = (type) => (type || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

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

// ==========================================
// REUSABLE MODAL PROMPT
// ==========================================
export function OsceAdminPrompt({ isOpen, title, placeholder, initialValue = '', onConfirm, onCancel }) {
  const [val, setVal] = useState(initialValue)

  useEffect(() => {
    if (isOpen) setVal(initialValue)
  }, [isOpen, initialValue])

  if (!isOpen) return null

  return (
    <div className="osce-admin-modal-overlay">
      <div className="osce-admin-modal" style={{ maxWidth: 400, padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', color: 'var(--syn-navy-700)' }}>{title}</h3>
        <input
          autoFocus
          className="osce-group__input"
          style={{ marginBottom: 20 }}
          placeholder={placeholder}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && val.trim()) onConfirm(val) }}
        />
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={onCancel}>Cancel</button>
          <button className="osce-btn osce-btn--sm" onClick={() => { if (val.trim()) onConfirm(val) }}>Confirm</button>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// INLINE PAGE BAR (Metadata)
// ==========================================
export function OsceInlinePageBar({ station, API_BASE, onSaved }) {
  const [form, setForm] = useState({ ...station })
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const [savedFlash, flashSaved] = useSaveFlash()

  useEffect(() => { setForm({ ...station }) }, [station])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations/${station.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('Failed to save')
      flashSaved()
      if (onSaved) await onSaved()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="tb-admin-page-bar" style={{ marginBottom: 24 }}>
      <div className="tb-admin-page-bar__row">
        <button type="button" className="tb-admin-page-bar__toggle" style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 16, fontWeight: 800, color: 'var(--syn-navy-800)' }} onClick={() => setOpen(!open)}>
          {open ? <LuMinus size={18} /> : <LuPlus size={18} />} Station Metadata
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ 
            padding: '4px 12px', 
            borderRadius: 20, 
            fontSize: 11, 
            fontWeight: 800, 
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            background: form.status === 'published' ? 'rgba(34, 197, 94, 0.1)' : form.status === 'draft' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(107, 114, 128, 0.1)',
            color: form.status === 'published' ? '#22c55e' : form.status === 'draft' ? '#f59e0b' : '#6b7280',
            border: `1px solid ${form.status === 'published' ? 'rgba(34, 197, 94, 0.3)' : form.status === 'draft' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`
          }}>
            {form.status}
          </span>
        </div>
      </div>
      {open && (
        <div className="tb-admin-page-bar__fields" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Title</span><input className="osce-group__input" style={{ marginBottom: 0 }} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Slug</span><input className="osce-group__input" style={{ marginBottom: 0 }} value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Type</span>
              <select className="osce-group__input" style={{ marginBottom: 0 }} value={form.station_type || ''} onChange={e => setForm({ ...form, station_type: e.target.value })}>
                {STATION_TYPES.map(t => <option key={t} value={t}>{t.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Status</span>
              <select className="osce-group__input" style={{ marginBottom: 0 }} value={form.status || ''} onChange={e => setForm({ ...form, status: e.target.value })}>
                {CONTENT_STATUSES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Difficulty</span>
              <select className="osce-group__input" style={{ marginBottom: 0 }} value={form.difficulty || ''} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
                <option value="">None</option>
                {DIFFICULTIES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Time (minutes)</span><input type="number" className="osce-group__input" style={{ marginBottom: 0 }} value={form.time_minutes || ''} onChange={e => setForm({ ...form, time_minutes: Number(e.target.value) })} /></label>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700, marginBottom: 16 }}><span>Summary</span><textarea rows={2} className="osce-group__input" style={{ marginBottom: 0 }} value={form.summary || ''} onChange={e => setForm({ ...form, summary: e.target.value })} /></label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700, marginBottom: 16 }}><span>Actual Diagnosis</span><input className="osce-group__input" style={{ marginBottom: 0 }} value={form.actual_diagnosis || ''} onChange={e => setForm({ ...form, actual_diagnosis: e.target.value })} /></label>
          <div className="tb-admin-page-bar__actions">
            <button type="button" className="osce-btn osce-btn--sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Metadata'}</button>
            {savedFlash && <span className="tb-admin-success">Saved ✓</span>}
          </div>
        </div>
      )}
    </div>
  )
}

// ==========================================
// INLINE SECTION TOOLBAR
// ==========================================
export function OsceInlineSection({ section, API_BASE, onSaved, children, onAddBlock, isAddingBlock, dragHandleProps }) {
  const [form, setForm] = useState({ title: section.title, position: section.position, visible_to: section.visible_to || [], initially_hidden: section.initially_hidden })
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => { setForm({ title: section.title, position: section.position, visible_to: section.visible_to || [], initially_hidden: section.initially_hidden }) }, [section])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/sections/${section.id}`, {
        method: 'PATCH',
        body: JSON.stringify(form)
      })
      if (!res.ok) throw new Error('Failed to save section')
      if (onSaved) await onSaved()
      setOpen(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this entire section?')) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/sections/${section.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      if (onSaved) await onSaved()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div style={{ position: 'relative', marginBottom: 16 }}>
      {/* Admin Toolbar overlaying the section */}
      <div style={{ background: 'var(--surface-app)', border: '1px solid var(--syn-border)', borderBottom: 'none', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: '8px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, fontWeight: 700, color: 'var(--syn-muted)' }}>
          <DragHandle props={dragHandleProps} />
          Admin: Section Controls
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 28, fontSize: 13 }} onClick={() => setOpen(!open)}>{open ? 'Close Settings' : 'Section Settings'}</button>
          <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 28, fontSize: 13 }} onClick={() => onAddBlock(section.id)} disabled={isAddingBlock}>
            <LuPlus size={14} /> {isAddingBlock ? 'Adding...' : 'Add Block'}
          </button>
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--syn-border)', borderBottom: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Title<input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Visible to:</div>
            {SESSION_ROLES.map(role => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={form.visible_to.includes(role)}
                  onChange={(e) => {
                    const newRoles = e.target.checked ? [...form.visible_to, role] : form.visible_to.filter(r => r !== role)
                    setForm({ ...form, visible_to: newRoles })
                  }}
                /> <span style={{ textTransform: 'capitalize' }}>{role}</span>
              </label>
            ))}
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, marginLeft: 'auto' }}>
              <input type="checkbox" checked={form.initially_hidden} onChange={e => setForm({ ...form, initially_hidden: e.target.checked })} /> Initially Hidden
            </label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 32, fontSize: 13, color: '#dc2626', borderColor: 'var(--syn-border)' }} onClick={handleDelete}><LuTrash2 size={14} /> Delete Section</button>
            <button className="osce-btn osce-btn--sm" style={{ height: 32 }} onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
          </div>
        </div>
      )}

      {/* Actual Section Visual */}
      <div style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }} className="osce-section">
        {children}
      </div>
    </div>
  )
}

// ==========================================
// INLINE BLOCK EDITOR
// ==========================================
export function OsceInlineBlock({ block, API_BASE, onSaved, dragHandleProps }) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Local state for the intuitive forms
  const [blockType, setBlockType] = useState(block.block_type)
  const [position, setPosition] = useState(block.position)
  const [content, setContent] = useState(block.content || {})

  useEffect(() => {
    setBlockType(block.block_type)
    setPosition(block.position)
    setContent(block.content || {})
  }, [block])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/blocks/${block.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ block_type: blockType, position, content })
      })
      if (!res.ok) throw new Error('Failed to save block')
      if (onSaved) await onSaved()
      setEditing(false)
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm('Delete this block?')) return
    try {
      // If it's an image block with a path, delete from storage
      if (block.block_type === 'image' && block.content?.path) {
        await authenticatedFetch(`${API_BASE}/admin/osce/images?path=${encodeURIComponent(block.content.path)}`, { method: 'DELETE' })
      }
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/blocks/${block.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      if (onSaved) await onSaved()
    } catch (e) {
      alert(e.message)
    }
  }

  // --- Helpers for intuitive forms ---
  const handleContentChange = (newContent) => setContent(newContent)

  const renderForm = () => {
    switch (blockType) {
      case 'markdown':
        return (
          <div data-color-mode="dark">
            <MDEditor
              value={content.text || ''}
              onChange={val => handleContentChange({ text: val || '' })}
              preview="edit"
              height={200}
              textareaProps={{
                placeholder: 'Type content here...'
              }}
            />
          </div>
        )
      case 'checklist':
        const checklistItems = (content.items || []).map((it, i) => ({ 
          id: `it-${i}`, 
          label: typeof it === 'string' ? it : it.label, 
          required: typeof it === 'string' ? false : !!it.required 
        }))
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SortableList
              items={checklistItems}
              onReorder={newIt => handleContentChange({ ...content, items: newIt })}
              renderItem={(item, itemDragProps) => (
                <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <DragHandle props={itemDragProps} />
                  <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} placeholder="New checklist item..." value={item.label} onChange={e => {
                    const newItems = [...checklistItems]
                    const idx = newItems.findIndex(i => i.id === item.id)
                    newItems[idx] = { ...item, label: e.target.value }
                    handleContentChange({ ...content, items: newItems })
                  }} />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}><input style={{ width: 16, height: 16 }} type="checkbox" checked={item.required} onChange={e => {
                    const newItems = [...checklistItems]
                    const idx = newItems.findIndex(i => i.id === item.id)
                    newItems[idx] = { ...item, required: e.target.checked }
                    handleContentChange({ ...content, items: newItems })
                  }} /> Required</label>
                  <button type="button" className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => {
                    const newItems = checklistItems.filter(i => i.id !== item.id)
                    handleContentChange({ ...content, items: newItems })
                  }}><LuTrash2 size={16} /></button>
                </div>
              )}
            />
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ ...content, items: [...checklistItems, { id: `new-${Date.now()}`, label: '', required: false }] })}><LuPlus size={14} /> Add Item</button>
          </div>
        )
      case 'key_value':
        const pairs = (content.pairs || []).map((p, i) => ({ id: `p-${i}`, key: p.key || '', value: p.value || '' }))
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <SortableList
              items={pairs}
              onReorder={newP => handleContentChange({ ...content, pairs: newP })}
              renderItem={(pair, pDragProps) => (
                <div key={pair.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <DragHandle props={pDragProps} />
                  <input className="osce-group__input" style={{ marginBottom: 0, width: 200, height: 36, padding: '0 12px' }} placeholder="Key" value={pair.key} onChange={e => {
                    const newPairs = [...pairs]
                    const idx = newPairs.findIndex(p => p.id === pair.id)
                    newPairs[idx] = { ...pair, key: e.target.value }
                    handleContentChange({ ...content, pairs: newPairs })
                  }} />
                  <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} placeholder="Value" value={pair.value} onChange={e => {
                    const newPairs = [...pairs]
                    const idx = newPairs.findIndex(p => p.id === pair.id)
                    newPairs[idx] = { ...pair, value: e.target.value }
                    handleContentChange({ ...content, pairs: newPairs })
                  }} />
                  <button type="button" className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => {
                    const newPairs = pairs.filter(p => p.id !== pair.id)
                    handleContentChange({ ...content, pairs: newPairs })
                  }}><LuTrash2 size={16} /></button>
                </div>
              )}
            />
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ ...content, pairs: [...pairs, { id: `new-${Date.now()}`, key: '', value: '' }] })}><LuPlus size={14} /> Add Pair</button>
          </div>
        )
      case 'list':
        const listItems = (content.items || []).map((it, i) => ({ id: `li-${i}`, val: typeof it === 'string' ? it : it.label }))
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700 }}><input style={{ width: 16, height: 16 }} type="checkbox" checked={content.ordered || false} onChange={e => handleContentChange({ ...content, ordered: e.target.checked })} /> Ordered List</label>
            <SortableList
              items={listItems}
              onReorder={newIt => handleContentChange({ ...content, items: newIt.map(i => i.val) })}
              renderItem={(item, liDragProps) => (
                <div key={item.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <DragHandle props={liDragProps} />
                  <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} placeholder="New list item..." value={item.val} onChange={e => {
                    const newItems = [...listItems]
                    const idx = newItems.findIndex(i => i.id === item.id)
                    newItems[idx] = { ...item, val: e.target.value }
                    handleContentChange({ ...content, items: newItems.map(i => i.val) })
                  }} />
                  <button type="button" className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => {
                    const newItems = listItems.filter(i => i.id !== item.id)
                    handleContentChange({ ...content, items: newItems.map(i => i.val) })
                  }}><LuTrash2 size={16} /></button>
                </div>
              )}
            />
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ ...content, items: [...(content.items || []), ''] })}><LuPlus size={14} /> Add List Item</button>
          </div>
        )
      case 'table':
        const headers = content.headers || ['Col 1', 'Col 2']
        const rows = content.rows || [['', ''], ['', '']]
        return (
          <div className="osce-admin-table-editor" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ overflowX: 'auto', borderRadius: 8, border: '1px solid var(--syn-border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--surface-card)' }}>
                <thead>
                  <tr style={{ background: 'var(--surface-tint-navy)', borderBottom: '1px solid var(--syn-border)' }}>
                    {headers.map((h, i) => (
                      <th key={i} style={{ padding: 8, minWidth: 120, borderRight: '1px solid var(--syn-border)' }}>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <input
                            className="osce-group__input"
                            style={{ marginBottom: 0, height: 28, padding: '0 8px', fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px solid transparent' }}
                            value={h}
                            placeholder="Header..."
                            onChange={e => {
                              const newHeaders = [...headers]
                              newHeaders[i] = e.target.value
                              handleContentChange({ ...content, headers: newHeaders, rows })
                            }}
                          />
                          <button type="button" className="osce-admin-icon-btn" style={{ color: '#dc2626', opacity: 0.6 }} onClick={() => {
                            if (headers.length <= 1) return
                            const newHeaders = headers.filter((_, idx) => idx !== i)
                            const newRows = rows.map(r => r.filter((_, idx) => idx !== i))
                            handleContentChange({ ...content, headers: newHeaders, rows: newRows })
                          }}><LuX size={12} /></button>
                        </div>
                      </th>
                    ))}
                    <th style={{ width: 40, padding: 8 }}>
                      <button type="button" className="osce-admin-icon-btn" style={{ color: 'var(--syn-primary)' }} onClick={() => {
                        const newHeaders = [...headers, `New Col`]
                        const newRows = rows.map(r => [...r, ''])
                        handleContentChange({ ...content, headers: newHeaders, rows: newRows })
                      }}><LuPlus size={16} /></button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, ri) => (
                    <tr key={ri} style={{ borderBottom: ri === rows.length - 1 ? 'none' : '1px solid var(--syn-border)' }}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ padding: 0, borderRight: '1px solid var(--syn-border)' }}>
                          <textarea
                            className="osce-group__input"
                            style={{
                              marginBottom: 0,
                              minHeight: 32,
                              padding: '8px 12px',
                              fontSize: 13,
                              background: 'transparent',
                              border: 'none',
                              resize: 'none',
                              width: '100%',
                              display: 'block'
                            }}
                            value={cell || ''}
                            placeholder="..."
                            rows={1}
                            onChange={e => {
                              const newRows = [...rows]
                              const newRow = [...row]
                              newRow[ci] = e.target.value
                              newRows[ri] = newRow
                              handleContentChange({ ...content, headers, rows: newRows })
                            }}
                          />
                        </td>
                      ))}
                      <td style={{ padding: 8, textAlign: 'center' }}>
                        <button type="button" className="osce-admin-icon-btn" style={{ color: '#dc2626', opacity: 0.6 }} onClick={() => {
                          if (rows.length <= 1) return
                          const newRows = rows.filter((_, idx) => idx !== ri)
                          handleContentChange({ ...content, headers, rows: newRows })
                        }}><LuTrash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => {
              const newRows = [...rows, Array(headers.length).fill('')]
              handleContentChange({ ...content, headers, rows: newRows })
            }}><LuPlus size={14} /> Add Row</button>
          </div>
        )
      case 'callout':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Title<input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={content.title || ''} placeholder="Add a title (optional)..." onChange={e => handleContentChange({ ...content, title: e.target.value })} /></label>
              <label style={{ width: 150, fontSize: 13, fontWeight: 700 }}>Variant
                <select className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={content.variant || 'info'} onChange={e => handleContentChange({ ...content, variant: e.target.value })}>
                  <option value="info">Info</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="danger">Danger</option>
                </select>
              </label>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Text<textarea className="osce-group__input" style={{ minHeight: 80, resize: 'vertical', marginBottom: 0 }} placeholder="Type callout content here..." value={content.text || ''} onChange={e => handleContentChange({ ...content, text: e.target.value })} /></label>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--syn-muted)', marginBottom: 4 }}>Preview</div>
              <OsceBlockRenderer block={{ block_type: 'callout', content }} />
            </div>
          </div>
        )
      case 'image':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Image Settings
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12, padding: 20, border: '2px dashed var(--syn-border)', borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: 'var(--surface-tint-navy)' }}>
                {content.url ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, width: '100%' }}>
                    <img src={content.url} alt="Preview" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'contain' }} />
                    <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" style={{ color: '#dc2626', borderColor: 'rgba(220, 38, 38, 0.2)' }} onClick={async () => {
                      if (content.path) {
                        await authenticatedFetch(`${API_BASE}/admin/osce/images?path=${encodeURIComponent(content.path)}`, { method: 'DELETE' })
                      }
                      handleContentChange({ ...content, url: null, path: null })
                    }}>Remove Image</button>
                  </div>
                ) : (
                  <div style={{ color: 'var(--syn-muted)', fontSize: 13 }}>No image selected</div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  id={`image-upload-${block.id}`}
                  onChange={async (e) => {
                    const file = e.target.files[0]
                    if (!file) return
                    try {
                      const reader = new FileReader()
                      reader.onload = async () => {
                        const base64 = reader.result.split(',')[1]
                        const res = await authenticatedFetch(`${API_BASE}/admin/osce/images/upload`, {
                          method: 'POST',
                          body: JSON.stringify({
                            filename: file.name,
                            mime_type: file.type,
                            data_base64: base64
                          })
                        })
                        if (!res.ok) throw new Error('Upload failed')
                        const data = await res.json()
                        handleContentChange({ ...content, url: data.url, path: data.path })
                      }
                      reader.readAsDataURL(file)
                    } catch (err) {
                      alert(err.message)
                    }
                  }}
                />
                <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => document.getElementById(`image-upload-${block.id}`).click()}>
                  {content.url ? 'Change Image' : 'Select Image'}
                </button>
              </div>
            </label>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Caption (Optional)
                <input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={content.caption || ''} placeholder="Image caption..." onChange={e => handleContentChange({ ...content, caption: e.target.value })} />
              </label>
              <label style={{ width: 160, fontSize: 13, fontWeight: 700, flexShrink: 0 }}>Width (%)
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36 }}>
                  <input type="range" min="10" max="100" step="5" value={content.width || 100} onChange={e => handleContentChange({ ...content, width: Number(e.target.value) })} style={{ flex: 1, width: '100%' }} />
                  <span style={{ fontSize: 12, width: 32, flexShrink: 0 }}>{content.width || 100}%</span>
                </div>
              </label>
            </div>
          </div>
        )
      default:
        return (
          <div>
            <div style={{ fontSize: 12, color: 'var(--syn-muted)', marginBottom: 4 }}>Raw JSON Editor (Advanced)</div>
            <textarea
              className="osce-group__input" style={{ minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
              value={JSON.stringify(content, null, 2)}
              onChange={e => {
                try { setContent(JSON.parse(e.target.value)) } catch (err) { }
              }}
            />
          </div>
        )
    }
  }

  if (!editing) {
    return (
      <div
        style={{ position: 'relative', margin: '8px 20px', padding: 8, borderRadius: 8, border: '1px dashed transparent', transition: 'all 0.2s', cursor: 'pointer' }}
        className="tb-admin-hover-outline"
        onClick={() => setEditing(true)}
      >
        <div style={{ position: 'absolute', top: 10, left: -24, zIndex: 10 }}>
           <DragHandle props={dragHandleProps} />
        </div>
        <div className="tb-admin-edit-hover-btn" style={{ position: 'absolute', top: -14, right: -14, display: 'flex', gap: 6, zIndex: 10, opacity: 0, transition: 'opacity 0.2s' }}>
          <button style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} onClick={(e) => { e.stopPropagation(); setEditing(true) }}>
            <LuPencil size={14} />
          </button>
          <button style={{ background: '#dc2626', color: 'white', border: 'none', borderRadius: 99, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} onClick={(e) => { e.stopPropagation(); handleDelete() }}>
            <LuTrash2 size={14} />
          </button>
        </div>
        <div style={{ pointerEvents: 'none' }}>
          {(!content || (!content.text && !content.items?.length && !content.pairs?.length && !content.url && !content.rows?.length)) ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--syn-muted)', fontSize: 14, fontStyle: 'italic', background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px dashed var(--syn-border)' }}>
              Click to add {formatBlockType(blockType)} content...
            </div>
          ) : (
            <OsceBlockRenderer block={block} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ margin: '8px 20px', padding: 16, background: 'var(--surface-app)', border: '1px solid var(--syn-border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="osce-group__input" style={{ marginBottom: 0, height: 32, padding: '0 8px', fontSize: 13 }} value={blockType} onChange={e => setBlockType(e.target.value)}>
            {BLOCK_TYPES.map(t => <option key={t} value={t}>{formatBlockType(t)}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        {renderForm()}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="osce-btn osce-btn--secondary osce-btn--sm" style={{ color: '#dc2626', marginRight: 'auto', borderColor: 'transparent' }} onClick={handleDelete}><LuTrash2 size={14} /> Delete Block</button>
        <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => { setEditing(false); setContent(block.content); setBlockType(block.block_type) }}>Cancel</button>
        <button className="osce-btn osce-btn--sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Block'}</button>
      </div>
    </div>
  )
}

// ==========================================
// INLINE MARKS
// ==========================================
export function OsceInlineMarks({ stationId, domains, items, API_BASE, onSaved }) {
  const [editingItem, setEditingItem] = useState(null)
  const [promptData, setPromptData] = useState(null)
  const [localDomains, setLocalDomains] = useState(domains)
  const [localItems, setLocalItems] = useState(items)

  useEffect(() => { setLocalDomains(domains) }, [domains])
  useEffect(() => { setLocalItems(items) }, [items])

  async function handleAddDomain() {
    setPromptData({
      title: 'Add New Domain', placeholder: 'e.g. Communication Skills',
      onConfirm: async (title) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/stations/${stationId}/domains`, {
            method: 'POST', body: JSON.stringify({ title, max_marks: 10, position: localDomains.length + 1 })
          })
          if (onSaved) await onSaved()
        } catch (e) { alert(e.message) }
      }
    })
  }

  async function handleDeleteDomain(id) {
    if (!window.confirm('Delete domain and all items?')) return
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/domains/${id}`, { method: 'DELETE' })
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleAddItem(domainId) {
    const domainItems = localItems.filter(i => i.domain_id === domainId)
    setPromptData({
      title: 'Add Mark Scheme Item', placeholder: 'e.g. Washes hands',
      onConfirm: async (desc) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/domains/${domainId}/items`, {
            method: 'POST', body: JSON.stringify({ description: desc, marks: 1, is_critical: false, position: domainItems.length + 1 })
          })
          if (onSaved) await onSaved()
        } catch (e) { alert(e.message) }
      }
    })
  }

  async function handleDeleteItem(id) {
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/items/${id}`, { method: 'DELETE' })
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleSaveItem(id, updates) {
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/items/${id}`, {
        method: 'PATCH', body: JSON.stringify(updates)
      })
      setEditingItem(null)
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleReorderDomains(newDomains) {
    setLocalDomains(newDomains)
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH', body: JSON.stringify({ type: 'domains', ids: newDomains.map(d => d.id) })
      })
    } catch (e) {
      alert(e.message)
      setLocalDomains(domains)
    }
  }

  async function handleReorderItems(domainId, newDomainItems) {
    const otherItems = localItems.filter(i => i.domain_id !== domainId)
    setLocalItems([...otherItems, ...newDomainItems])
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH', body: JSON.stringify({ type: 'items', ids: newDomainItems.map(i => i.id) })
      })
    } catch (e) {
      alert(e.message)
      setLocalItems(items)
    }
  }

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-marks" style={{ margin: '0 0 16px 0', border: '2px dashed var(--syn-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
          <h3 className="osce-marks__title" style={{ margin: 0 }}>Mark Scheme (Edit Mode)</h3>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={handleAddDomain}><LuPlus size={14} /> Add Domain</button>
        </div>

        <SortableList
          items={localDomains}
          onReorder={handleReorderDomains}
          renderItem={(domain, domainDragProps) => {
            const domainItems = localItems.filter(i => i.domain_id === domain.id).sort((a, b) => a.position - b.position)
            return (
              <div key={domain.id} className="osce-marks__domain" style={{ marginBottom: 24 }}>
                <div className="osce-marks__domain-header" style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-tint-cyan)', padding: '8px 12px', borderRadius: 8 }}>
                  <DragHandle props={domainDragProps} />
                  <div className="osce-marks__domain-title" style={{ flex: 1 }}>{domain.title}</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="osce-btn osce-btn--secondary" style={{ padding: '2px 8px', height: 24, fontSize: 12, width: 'auto' }} onClick={() => handleAddItem(domain.id)}>+ Item</button>
                    <button className="osce-btn osce-btn--secondary" style={{ padding: '2px 8px', height: 24, color: '#dc2626', width: 'auto' }} onClick={() => handleDeleteDomain(domain.id)}><LuTrash2 size={12} /></button>
                  </div>
                </div>
                <div style={{ paddingLeft: 12, marginTop: 8 }}>
                  <SortableList
                    items={domainItems}
                    onReorder={(next) => handleReorderItems(domain.id, next)}
                    renderItem={(item, itemDragProps) => (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--syn-border)' }}>
                        <DragHandle props={itemDragProps} />
                        {editingItem === item.id ? (
                          <div style={{ display: 'flex', gap: 12, flex: 1, alignItems: 'center' }}>
                            <input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px', flex: 1, fontSize: 14 }} defaultValue={item.description} id={`desc-${item.id}`} />
                            <input type="number" className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px', width: 70, fontSize: 14 }} defaultValue={item.marks} id={`marks-${item.id}`} />
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>
                              <input type="checkbox" defaultChecked={item.is_critical} id={`crit-${item.id}`} style={{ width: 16, height: 16 }} /> Crit
                            </label>
                            <button className="osce-btn osce-btn--sm" style={{ height: 36, padding: '0 16px' }} onClick={() => {
                              handleSaveItem(item.id, {
                                description: document.getElementById(`desc-${item.id}`).value,
                                marks: Number(document.getElementById(`marks-${item.id}`).value),
                                is_critical: document.getElementById(`crit-${item.id}`).checked
                              })
                            }}>Save</button>
                          </div>
                        ) : (
                          <>
                            <div className={`osce-marks__item ${item.is_critical ? 'osce-marks__item--critical' : ''}`} style={{ flex: 1 }}>
                              {item.description} {item.is_critical && <span style={{ color: '#f87171', fontSize: 11 }}>(Critical)</span>}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--syn-muted)', width: 60, textAlign: 'right', flexShrink: 0 }}>{item.marks} marks</div>
                            <button className="osce-admin-icon-btn" onClick={() => setEditingItem(item.id)}><LuPencil size={14} /></button>
                            <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDeleteItem(item.id)}><LuTrash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    )}
                  />
                </div>
              </div>
            )
          }}
        />
      </div>
    </>
  )
}

// ==========================================
// INLINE FAILS
// ==========================================
export function OsceInlineFails({ stationId, fails, API_BASE, onSaved }) {
  const [promptData, setPromptData] = useState(null)
  const [editing, setEditing] = useState(null)
  const [items, setItems] = useState(fails)

  useEffect(() => { setItems(fails) }, [fails])

  async function handleAdd() {
    setPromptData({
      title: 'Add Fail Criteria', placeholder: 'e.g. Dangerously prescribes penicillin',
      onConfirm: async (desc) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/stations/${stationId}/fail-criteria`, {
            method: 'POST', body: JSON.stringify({ description: desc })
          })
          if (onSaved) await onSaved()
        } catch (e) { alert(e.message) }
      }
    })
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete fail criteria?')) return
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/fail-criteria/${id}`, { method: 'DELETE' })
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleSave(id, updates) {
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/fail-criteria/${id}`, {
        method: 'PATCH', body: JSON.stringify(updates)
      })
      setEditing(null)
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleReorder(newItems) {
    setItems(newItems)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ type: 'fails', ids: newItems.map(f => f.id) })
      })
      if (!res.ok) throw new Error('Reorder failed')
    } catch (e) {
      alert(e.message)
      setItems(fails)
    }
  }

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-marks" style={{ margin: '0 0 16px 0', border: '2px dashed #dc2626' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
          <h3 className="osce-marks__title" style={{ margin: 0 }}>Automatic Fail Criteria</h3>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={handleAdd}><LuPlus size={14} /> Add Criteria</button>
        </div>
        <SortableList
          items={items}
          onReorder={handleReorder}
          className="osce-sortable-list"
          renderItem={(c, dragHandleProps) => (
            <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '0.5rem' }}>
              <DragHandle props={dragHandleProps} />
              <div style={{ flex: 1, color: 'var(--syn-navy-700)' }}>
                {editing === c.id ? (
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px', flex: 1, fontSize: 14 }} defaultValue={c.description} id={`fail-${c.id}`} />
                    <button className="osce-btn osce-btn--sm" style={{ height: 36, padding: '0 16px' }} onClick={() => {
                      handleSave(c.id, { description: document.getElementById(`fail-${c.id}`).value })
                    }}>Save</button>
                    <button className="osce-btn osce-btn--secondary osce-btn--sm" style={{ height: 36, padding: '0 16px' }} onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 14 }}>{c.description}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="osce-admin-icon-btn" onClick={() => setEditing(c.id)}><LuPencil size={16} /></button>
                      <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDelete(c.id)}><LuX size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </>
  )
}

// ==========================================
// INLINE VIVA
// ==========================================
export function OsceInlineViva({ stationId, vivas, API_BASE, onSaved }) {
  const [editing, setEditing] = useState(null)
  const [promptData, setPromptData] = useState(null)
  const [items, setItems] = useState(vivas)

  useEffect(() => { setItems(vivas) }, [vivas])

  async function handleAdd() {
    setPromptData({
      title: 'Add Viva Question', placeholder: 'Question text...',
      onConfirm: async (question) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/stations/${stationId}/viva-questions`, {
            method: 'POST', body: JSON.stringify({ question_text: question, position: items.length + 1 })
          })
          if (onSaved) await onSaved()
        } catch (e) { alert(e.message) }
      }
    })
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete viva question?')) return
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/viva-questions/${id}`, { method: 'DELETE' })
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleSave(id, updates) {
    try {
      await authenticatedFetch(`${API_BASE}/admin/osce/viva-questions/${id}`, {
        method: 'PATCH', body: JSON.stringify(updates)
      })
      setEditing(null)
      if (onSaved) await onSaved()
    } catch (e) { alert(e.message) }
  }

  async function handleReorder(newItems) {
    setItems(newItems)
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/reorder`, {
        method: 'PATCH',
        body: JSON.stringify({ type: 'viva', ids: newItems.map(f => f.id) })
      })
      if (!res.ok) throw new Error('Reorder failed')
    } catch (e) {
      alert(e.message)
      setItems(vivas)
    }
  }

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-marks" style={{ padding: 24, margin: '0 0 16px 0', border: '2px dashed var(--syn-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
          <h3 className="osce-marks__title" style={{ margin: 0 }}>Viva Questions (Edit Mode)</h3>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={handleAdd}><LuPlus size={14} /> Add Viva</button>
        </div>
        <SortableList
          items={items}
          onReorder={handleReorder}
          renderItem={(q, dragHandleProps) => (
            <div key={q.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '16px 0', borderBottom: '1px solid var(--syn-border)' }}>
              <DragHandle props={dragHandleProps} style={{ marginTop: 4 }} />
              <div style={{ flex: 1 }}>
                {editing === q.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input className="osce-group__input" style={{ marginBottom: 0, height: 36 }} defaultValue={q.question_text} id={`vq-${q.id}`} placeholder="Question" />
                    <textarea className="osce-group__input" style={{ minHeight: 60, resize: 'vertical', marginBottom: 0 }} defaultValue={q.answer_text || ''} id={`va-${q.id}`} placeholder="Expected Answer (Markdown)" />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="osce-btn osce-btn--sm" onClick={() => {
                        handleSave(q.id, {
                          question_text: document.getElementById(`vq-${q.id}`).value,
                          answer_text: document.getElementById(`va-${q.id}`).value
                        })
                      }}>Save</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: 'var(--syn-navy-700)', fontSize: '15px', fontWeight: 700 }}>{q.question_text}</div>
                      {q.answer_text && <div style={{ marginTop: 8, fontSize: 14, color: 'var(--syn-muted)' }}>{q.answer_text}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="osce-admin-icon-btn" onClick={() => setEditing(q.id)}><LuPencil size={16} /></button>
                      <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDelete(q.id)}><LuTrash2 size={16} /></button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </div>
    </>
  )
}
