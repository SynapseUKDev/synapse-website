import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { LuPlus, LuPencil, LuTrash2, LuEye, LuEyeOff, LuChevronLeft, LuStethoscope, LuCircleCheck } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const TYPE_LABELS = {
  history_taking: '💬 History Taking',
  examination: '🩺 Examination',
  communication: '🗣️ Communication',
  procedural: '💉 Procedural',
  emergency: '🚨 Emergency',
  data_interpretation: '📊 Data Interpretation',
  prescribing: '💊 Prescribing',
  documentation: '📋 Documentation',
  paeds_obs_gynae: '👶 Paeds / Obs & Gynae',
}

const ALL_TYPES = Object.keys(TYPE_LABELS)

const DIFFICULTIES = ['easy', 'medium', 'hard']

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function OsceAdminPanel() {
  const navigate = useNavigate()
  const { user } = useOutletContext()
  const isAdmin = !!user?.is_admin || !!user?.capabilities?.is_admin

  const [stations, setStations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [form, setForm] = useState({
    title: '',
    slug: '',
    station_type: 'history_taking',
    difficulty: 'medium',
    time_minutes: 8,
    status: 'draft',
    summary: '',
    actual_diagnosis: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const loadStations = useCallback(async () => {
    try {
      setLoading(true)
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations`)
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || 'Failed to load stations'); return }
      const d = await res.json()
      setStations(d.stations || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { loadStations() }, [loadStations])

  async function handleCreate(e) {
    e.preventDefault()
    if (!form.title.trim()) { setCreateError('Title is required'); return }
    if (!form.slug.trim()) { setCreateError('Slug is required'); return }
    setCreating(true); setCreateError('')
    try {
      const body = {
        title: form.title.trim(),
        slug: form.slug.trim(),
        station_type: form.station_type,
        difficulty: form.difficulty,
        time_minutes: Number(form.time_minutes),
        status: form.status,
        summary: form.summary.trim() || null,
        actual_diagnosis: form.actual_diagnosis.trim() || null,
      }
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations`, {
        method: 'POST', body: JSON.stringify(body),
      })
      if (!res.ok) { const e = await res.json().catch(() => ({})); setCreateError(e.error || 'Failed to create'); return }
      const d = await res.json()
      setShowCreate(false)
      setForm({ title: '', slug: '', station_type: 'history_taking', difficulty: 'medium', time_minutes: 8, status: 'draft', summary: '', actual_diagnosis: '' })
      navigate(`/dashboard/admin/osce/station/${d.station.id}`)
    } catch { setCreateError('Network error') }
    finally { setCreating(false) }
  }

  async function handleDelete(station, e) {
    e.stopPropagation()
    if (!window.confirm(`Delete "${station.title}"? This cannot be undone.`)) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations/${station.id}`, { method: 'DELETE' })
      if (!res.ok) { alert('Failed to delete station'); return }
      await loadStations()
    } catch { alert('Network error') }
  }

  async function handleToggleStatus(station, e) {
    e.stopPropagation()
    const newStatus = station.status === 'published' ? 'draft' : 'published'
    try {
      const res = await authenticatedFetch(`${API_BASE}/admin/osce/stations/${station.id}`, {
        method: 'PATCH', body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { alert('Failed to update status'); return }
      await loadStations()
    } catch { alert('Network error') }
  }

  const filtered = stations.filter(s => {
    if (typeFilter && s.station_type !== typeFilter) return false
    if (statusFilter && s.status !== statusFilter) return false
    return true
  })

  if (!isAdmin) {
    return (
      <div className="osce-admin-panel">
        <div className="osce-admin-panel__empty">
          <LuStethoscope size={48} />
          <p>Admin access required.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="osce-admin-panel">
      <div className="osce-admin-panel__header">
        <div>
          <button className="osce-station__back" onClick={() => navigate('/dashboard/osce')}>
            <LuChevronLeft size={16} /> Back to OSCE Stations
          </button>
          <h1 className="osce-admin-panel__title">Manage OSCE Stations</h1>
          <p className="osce-admin-panel__subtitle">Create, edit, and publish OSCE stations for all station types.</p>
        </div>
        <button className="osce-admin-btn osce-admin-btn--primary" onClick={() => setShowCreate(true)}>
          <LuPlus size={18} /> New Station
        </button>
      </div>

      {error && <div className="osce-admin-alert">{error}</div>}

      {/* Filters */}
      <div className="osce-admin-filters">
        <select
          className="osce-admin-select"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
        </select>
        <select
          className="osce-admin-select"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <span className="osce-admin-count">{filtered.length} station{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Station table */}
      {loading ? (
        <LoadingScreen message="Loading stations..." inline />
      ) : filtered.length === 0 ? (
        <div className="osce-admin-empty">
          <LuStethoscope size={40} />
          <p>No stations found. {typeFilter || statusFilter ? 'Try adjusting your filters.' : 'Create one to get started!'}</p>
        </div>
      ) : (
        <div className="osce-admin-table-wrap">
          <table className="osce-admin-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Difficulty</th>
                <th>Time</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(station => (
                <tr key={station.id} onClick={() => navigate(`/dashboard/admin/osce/station/${station.id}`)} className="osce-admin-table__row">
                  <td>
                    <div className="osce-admin-table__title">{station.title}</div>
                    <div className="osce-admin-table__slug">/{station.slug}</div>
                  </td>
                  <td><span className="osce-admin-type-tag">{TYPE_LABELS[station.station_type] || station.station_type}</span></td>
                  <td>{station.difficulty || '—'}</td>
                  <td>{station.time_minutes} min</td>
                  <td>
                    <span className={`osce-admin-status osce-admin-status--${station.status}`}>
                      {station.status}
                    </span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="osce-admin-table__actions">
                      <button
                        className="osce-admin-icon-btn"
                        title={station.status === 'published' ? 'Unpublish' : 'Publish'}
                        onClick={e => handleToggleStatus(station, e)}
                      >
                        {station.status === 'published' ? <LuEyeOff size={16} /> : <LuEye size={16} />}
                      </button>
                      <button
                        className="osce-admin-icon-btn"
                        title="Edit station"
                        onClick={() => navigate(`/dashboard/admin/osce/station/${station.id}`)}
                      >
                        <LuPencil size={16} />
                      </button>
                      <button
                        className="osce-admin-icon-btn osce-admin-icon-btn--danger"
                        title="Delete station"
                        onClick={e => handleDelete(station, e)}
                      >
                        <LuTrash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Station Modal */}
      {showCreate && (
        <div className="osce-admin-modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="osce-admin-modal" onClick={e => e.stopPropagation()}>
            <div className="osce-admin-modal__header">
              <h2>Create New Station</h2>
              <button className="osce-admin-modal__close" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate} className="osce-admin-form">
              <div className="osce-admin-form__row">
                <label className="osce-admin-form__label">
                  Title *
                  <input
                    className="osce-admin-form__input"
                    value={form.title}
                    onChange={e => {
                      const title = e.target.value
                      setForm(f => ({ ...f, title, slug: slugify(title) }))
                    }}
                    placeholder="e.g. Chest Pain History"
                    required
                  />
                </label>
                <label className="osce-admin-form__label">
                  Slug *
                  <input
                    className="osce-admin-form__input osce-admin-form__input--mono"
                    value={form.slug}
                    onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                    placeholder="chest-pain-history"
                    required
                  />
                </label>
              </div>

              <div className="osce-admin-form__row">
                <label className="osce-admin-form__label">
                  Station Type *
                  <select className="osce-admin-form__input" value={form.station_type} onChange={e => setForm(f => ({ ...f, station_type: e.target.value }))}>
                    {ALL_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </label>
                <label className="osce-admin-form__label">
                  Difficulty
                  <select className="osce-admin-form__input" value={form.difficulty} onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
                    {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
              </div>

              <div className="osce-admin-form__row">
                <label className="osce-admin-form__label">
                  Time (minutes)
                  <input type="number" className="osce-admin-form__input" value={form.time_minutes} min={1} max={60} onChange={e => setForm(f => ({ ...f, time_minutes: e.target.value }))} />
                </label>
                <label className="osce-admin-form__label">
                  Initial Status
                  <select className="osce-admin-form__input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                  </select>
                </label>
              </div>

              <label className="osce-admin-form__label">
                Summary
                <textarea className="osce-admin-form__textarea" rows={2} value={form.summary} onChange={e => setForm(f => ({ ...f, summary: e.target.value }))} placeholder="Brief description for the station card..." />
              </label>

              <label className="osce-admin-form__label">
                Actual Diagnosis (hidden from candidates)
                <input className="osce-admin-form__input" value={form.actual_diagnosis} onChange={e => setForm(f => ({ ...f, actual_diagnosis: e.target.value }))} placeholder="e.g. NSTEMI" />
              </label>

              {createError && <div className="osce-admin-alert">{createError}</div>}

              <div className="osce-admin-form__actions">
                <button type="button" className="osce-admin-btn osce-admin-btn--ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="osce-admin-btn osce-admin-btn--primary" disabled={creating}>
                  {creating ? 'Creating...' : <><LuCircleCheck size={16} /> Create & Edit</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
