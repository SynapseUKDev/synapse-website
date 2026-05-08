import React, { useState, useEffect, useRef } from 'react'
import { LuPlus, LuTrash2, LuPencil, LuChevronDown, LuX, LuSave, LuEye, LuEyeOff } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import OsceBlockRenderer from './OsceBlockRenderer'

const STATION_TYPES = [
  'history_taking', 'examination', 'communication', 'procedural', 'emergency',
  'data_interpretation', 'prescribing', 'documentation', 'paeds_obs_gynae'
]
const DIFFICULTIES = ['easy', 'medium', 'hard']
const CONTENT_STATUSES = ['draft', 'published', 'archived']
const SESSION_ROLES = ['candidate', 'examiner', 'patient', 'observer']
const BLOCK_TYPES = ['markdown', 'checklist', 'key_value', 'callout', 'image', 'table', 'list']

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
          <button className="osce-btn osce-btn--sm" onClick={() => { if(val.trim()) onConfirm(val) }}>Confirm</button>
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
        <button type="button" className="tb-admin-page-bar__toggle" onClick={() => setOpen(!open)}>
          {open ? '− Station Metadata' : '+ Station Metadata'}
        </button>
        <span className="tb-admin-page-bar__hint">Status: {form.status}</span>
      </div>
      {open && (
        <div className="tb-admin-page-bar__fields" style={{ padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Title</span><input className="osce-group__input" style={{ marginBottom: 0 }} value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Slug</span><input className="osce-group__input" style={{ marginBottom: 0 }} value={form.slug || ''} onChange={e => setForm({ ...form, slug: e.target.value })} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 14, fontWeight: 700 }}><span>Type</span>
              <select className="osce-group__input" style={{ marginBottom: 0 }} value={form.station_type || ''} onChange={e => setForm({ ...form, station_type: e.target.value })}>
                {STATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
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
export function OsceInlineSection({ section, API_BASE, onSaved, children, onAddBlock }) {
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
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--syn-muted)' }}>Admin: Section Controls</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 28, fontSize: 13 }} onClick={() => setOpen(!open)}>{open ? 'Close Settings' : 'Section Settings'}</button>
          <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 28, fontSize: 13 }} onClick={() => onAddBlock(section.id)}><LuPlus size={14}/> Add Block</button>
        </div>
      </div>

      {open && (
        <div style={{ background: 'var(--surface-card)', border: '1px solid var(--syn-border)', borderBottom: 'none', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Title<input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label>
            <label style={{ width: 80, fontSize: 13, fontWeight: 700 }}>Position<input type="number" className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={form.position} onChange={e => setForm({ ...form, position: Number(e.target.value) })} /></label>
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
            <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 12px', height: 32, fontSize: 13, color: '#dc2626', borderColor: 'var(--syn-border)' }} onClick={handleDelete}><LuTrash2 size={14}/> Delete Section</button>
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
export function OsceInlineBlock({ block, API_BASE, onSaved }) {
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
          <textarea 
            className="osce-group__input" style={{ minHeight: 120, resize: 'vertical' }} 
            value={content.text || ''} onChange={e => handleContentChange({ text: e.target.value })} 
            placeholder="Markdown text..." 
          />
        )
      case 'checklist':
        const items = content.items || []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} value={item.label || item} onChange={e => {
                  const newItems = [...items]
                  newItems[idx] = { ...item, label: e.target.value }
                  handleContentChange({ items: newItems })
                }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><input type="checkbox" checked={item.required || false} onChange={e => {
                  const newItems = [...items]
                  newItems[idx] = { ...item, required: e.target.checked }
                  handleContentChange({ items: newItems })
                }}/> Required</label>
                <button type="button" className="osce-btn osce-btn--secondary" style={{ height: 36, padding: '0 12px', color: '#dc2626' }} onClick={() => {
                  const newItems = items.filter((_, i) => i !== idx)
                  handleContentChange({ items: newItems })
                }}><LuTrash2 size={14}/></button>
              </div>
            ))}
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ items: [...items, { label: 'New item', required: false }] })}><LuPlus size={14}/> Add Item</button>
          </div>
        )
      case 'key_value':
        const pairs = content.pairs || []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pairs.map((pair, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="osce-group__input" style={{ marginBottom: 0, width: 150, height: 36, padding: '0 12px' }} placeholder="Key" value={pair.key || ''} onChange={e => {
                  const newPairs = [...pairs]
                  newPairs[idx] = { ...pair, key: e.target.value }
                  handleContentChange({ pairs: newPairs })
                }} />
                <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} placeholder="Value" value={pair.value || ''} onChange={e => {
                  const newPairs = [...pairs]
                  newPairs[idx] = { ...pair, value: e.target.value }
                  handleContentChange({ pairs: newPairs })
                }} />
                <button type="button" className="osce-btn osce-btn--secondary" style={{ height: 36, padding: '0 12px', color: '#dc2626' }} onClick={() => {
                  const newPairs = pairs.filter((_, i) => i !== idx)
                  handleContentChange({ pairs: newPairs })
                }}><LuTrash2 size={14}/></button>
              </div>
            ))}
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ pairs: [...pairs, { key: '', value: '' }] })}><LuPlus size={14}/> Add Pair</button>
          </div>
        )
      case 'callout':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 16 }}>
              <label style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Title<input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={content.title || ''} onChange={e => handleContentChange({ ...content, title: e.target.value })} /></label>
              <label style={{ width: 150, fontSize: 13, fontWeight: 700 }}>Variant
                <select className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px' }} value={content.variant || 'info'} onChange={e => handleContentChange({ ...content, variant: e.target.value })}>
                  <option value="info">Info</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="danger">Danger</option>
                </select>
              </label>
            </div>
            <label style={{ fontSize: 13, fontWeight: 700 }}>Text<textarea className="osce-group__input" style={{ minHeight: 80, resize: 'vertical', marginBottom: 0 }} value={content.text || ''} onChange={e => handleContentChange({ ...content, text: e.target.value })} /></label>
          </div>
        )
      case 'list':
        const listItems = content.items || []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}><input type="checkbox" checked={content.ordered || false} onChange={e => handleContentChange({ ...content, ordered: e.target.checked })}/> Ordered List</label>
            {listItems.map((item, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="osce-group__input" style={{ marginBottom: 0, flex: 1, height: 36, padding: '0 12px' }} value={item || ''} onChange={e => {
                  const newItems = [...listItems]
                  newItems[idx] = e.target.value
                  handleContentChange({ ...content, items: newItems })
                }} />
                <button type="button" className="osce-btn osce-btn--secondary" style={{ height: 36, padding: '0 12px', color: '#dc2626' }} onClick={() => {
                  const newItems = listItems.filter((_, i) => i !== idx)
                  handleContentChange({ ...content, items: newItems })
                }}><LuTrash2 size={14}/></button>
              </div>
            ))}
            <button type="button" className="osce-btn osce-btn--secondary osce-btn--sm" onClick={() => handleContentChange({ ...content, items: [...listItems, ''] })}><LuPlus size={14}/> Add List Item</button>
          </div>
        )
      case 'table':
      case 'image':
      default:
        // Fallback for complex ones or unimplemented visual forms
        return (
          <div>
            <div style={{ fontSize: 12, color: 'var(--syn-muted)', marginBottom: 4 }}>Raw JSON Editor (Advanced)</div>
            <textarea 
              className="osce-group__input" style={{ minHeight: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} 
              value={JSON.stringify(content, null, 2)} 
              onChange={e => {
                try { setContent(JSON.parse(e.target.value)) } catch(err) {}
              }} 
            />
          </div>
        )
    }
  }

  if (!editing) {
    return (
      <div style={{ position: 'relative', margin: '8px 20px', padding: 8, borderRadius: 8, border: '1px dashed transparent', transition: 'all 0.2s' }} className="tb-admin-hover-outline">
        <button className="tb-admin-edit-hover-btn" style={{ position: 'absolute', top: -12, right: -12, background: 'var(--syn-navy-700)', color: 'white', border: 'none', borderRadius: 99, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', zIndex: 10, opacity: 0, transition: 'opacity 0.2s' }} onClick={() => setEditing(true)}>
          <LuPencil size={14}/>
        </button>
        <div style={{ pointerEvents: 'none' }}>
          <OsceBlockRenderer block={block} />
        </div>
      </div>
    )
  }

  return (
    <div style={{ margin: '8px 20px', padding: 16, background: 'var(--surface-app)', border: '1px solid var(--syn-border)', borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <select className="osce-group__input" style={{ marginBottom: 0, height: 32, padding: '0 8px', fontSize: 13 }} value={blockType} onChange={e => setBlockType(e.target.value)}>
            {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" className="osce-group__input" style={{ marginBottom: 0, height: 32, padding: '0 8px', width: 60, fontSize: 13 }} value={position} onChange={e => setPosition(Number(e.target.value))} />
        </div>
        <button className="osce-btn osce-btn--secondary" style={{ padding: '4px 8px', height: 32, color: '#dc2626', borderColor: 'var(--syn-border)' }} onClick={handleDelete}><LuTrash2 size={14}/></button>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        {renderForm()}
      </div>

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
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
  const [editingDomain, setEditingDomain] = useState(null)
  const [editingItem, setEditingItem] = useState(null)
  const [promptData, setPromptData] = useState(null)

  async function handleAddDomain() {
    setPromptData({
      title: 'Add New Domain', placeholder: 'e.g. Communication Skills',
      onConfirm: async (title) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/stations/${stationId}/domains`, {
            method: 'POST', body: JSON.stringify({ title, max_marks: 10, position: domains.length + 1 })
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
    setPromptData({
      title: 'Add Mark Scheme Item', placeholder: 'e.g. Washes hands',
      onConfirm: async (desc) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/domains/${domainId}/items`, {
            method: 'POST', body: JSON.stringify({ description: desc, marks: 1, is_critical: false, position: 99 })
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

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-marks" style={{ margin: '0 0 16px 0', border: '2px dashed var(--syn-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
          <h3 className="osce-marks__title" style={{ margin: 0 }}>Mark Scheme (Edit Mode)</h3>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={handleAddDomain}><LuPlus size={14}/> Add Domain</button>
        </div>
        
        {domains.sort((a,b) => a.position - b.position).map(domain => {
          const domainItems = items.filter(i => i.domain_id === domain.id).sort((a,b) => a.position - b.position)
          return (
            <div key={domain.id} className="osce-marks__domain" style={{ marginBottom: 24 }}>
              <div className="osce-marks__domain-header" style={{ background: 'var(--surface-tint-cyan)', padding: '8px 12px', borderRadius: 8 }}>
                <div className="osce-marks__domain-title">{domain.title}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="osce-btn osce-btn--secondary" style={{ padding: '2px 8px', height: 24, fontSize: 12, width: 'auto' }} onClick={() => handleAddItem(domain.id)}>+ Item</button>
                  <button className="osce-btn osce-btn--secondary" style={{ padding: '2px 8px', height: 24, color: '#dc2626', width: 'auto' }} onClick={() => handleDeleteDomain(domain.id)}><LuTrash2 size={12}/></button>
                </div>
              </div>
              <div style={{ paddingLeft: 12, marginTop: 8 }}>
                {domainItems.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--syn-border)' }}>
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
                        <button className="osce-admin-icon-btn" onClick={() => setEditingItem(item.id)}><LuPencil size={14}/></button>
                        <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDeleteItem(item.id)}><LuTrash2 size={14}/></button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
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

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-block--callout" data-variant="danger" style={{ margin: '0 0 16px 0', borderStyle: 'dashed' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #fca5a5', paddingBottom: 8, marginBottom: 8 }}>
          <div className="osce-callout__title" style={{ margin: 0 }}>Automatic Fail Criteria</div>
          <button className="osce-btn osce-btn--secondary" style={{ padding: '2px 8px', height: 24, fontSize: 12, borderColor: '#fca5a5', color: '#dc2626', width: 'auto' }} onClick={handleAdd}>+ Add</button>
        </div>
        <ul style={{ paddingLeft: '1.2rem', margin: 0 }}>
          {fails.map((c) => (
            <li key={c.id} style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              {editing === c.id ? (
                <div style={{ display: 'flex', gap: 12, marginTop: 4, marginBottom: 8, width: '100%', alignItems: 'center' }}>
                  <input className="osce-group__input" style={{ marginBottom: 0, height: 36, padding: '0 12px', flex: 1, fontSize: 14 }} defaultValue={c.description} id={`fail-${c.id}`} />
                  <button className="osce-btn osce-btn--sm" style={{ height: 36, padding: '0 16px' }} onClick={() => {
                    handleSave(c.id, { description: document.getElementById(`fail-${c.id}`).value })
                  }}>Save</button>
                  <button className="osce-btn osce-btn--secondary osce-btn--sm" style={{ height: 36, padding: '0 16px' }} onClick={() => setEditing(null)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 14, marginTop: 4 }}>{c.description}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="osce-admin-icon-btn" onClick={() => setEditing(c.id)}><LuPencil size={16}/></button>
                    <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDelete(c.id)}><LuX size={16}/></button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
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

  async function handleAdd() {
    setPromptData({
      title: 'Add Viva Question', placeholder: 'Question text...',
      onConfirm: async (question) => {
        setPromptData(null)
        try {
          await authenticatedFetch(`${API_BASE}/admin/osce/stations/${stationId}/viva-questions`, {
            method: 'POST', body: JSON.stringify({ question_text: question, position: vivas.length + 1 })
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

  return (
    <>
      <OsceAdminPrompt isOpen={!!promptData} title={promptData?.title} placeholder={promptData?.placeholder} onConfirm={promptData?.onConfirm} onCancel={() => setPromptData(null)} />
      <div className="osce-marks" style={{ padding: 24, margin: '0 0 16px 0', border: '2px dashed var(--syn-cyan)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--syn-border)' }}>
          <h3 className="osce-marks__title" style={{ margin: 0 }}>Viva Questions (Edit Mode)</h3>
          <button className="osce-btn osce-btn--secondary osce-btn--sm" onClick={handleAdd}><LuPlus size={14}/> Add Viva</button>
        </div>
        {vivas.sort((a,b) => a.position - b.position).map((q, i) => (
          <div key={q.id} style={{ display: 'flex', flexDirection: 'column', padding: '16px 0', borderBottom: i === vivas.length - 1 ? 'none' : '1px solid var(--syn-border)' }}>
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
                  <button className="osce-admin-icon-btn" onClick={() => setEditing(q.id)}><LuPencil size={16}/></button>
                  <button className="osce-admin-icon-btn osce-admin-icon-btn--danger" style={{ color: '#dc2626' }} onClick={() => handleDelete(q.id)}><LuTrash2 size={16}/></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
