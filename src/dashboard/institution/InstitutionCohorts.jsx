import React, { useState } from 'react'
import { LuLayers, LuPencil, LuTrash2, LuChevronUp, LuChevronDown, LuPlus } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'
import LoadingScreen from '../../components/loading/LoadingScreen'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

async function readError(res, fallback) {
  const body = await res.json().catch(() => ({}))
  return typeof body?.error === 'string' ? body.error : fallback
}

/**
 * Year groups owned by the institution. Students are assigned to one of these
 * when invited or edited and cannot change it themselves, so this list is the
 * only place the names are defined.
 */
export default function InstitutionCohorts({ cohorts, unassigned, loading, onChanged }) {
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')

  /** fn returns false to abort, or true / a message to report success. */
  const run = async (fn, successMessage) => {
    setError('')
    setNotice('')
    try {
      const result = await fn()
      if (result) {
        setNotice(typeof result === 'string' ? result : successMessage)
        onChanged?.()
      }
      return !!result
    } catch {
      setError('Something went wrong. Check your connection and try again.')
      return false
    }
  }

  const create = async (e) => {
    e?.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    await run(async () => {
      const res = await authenticatedFetch(`${API_BASE}/institution/cohorts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) {
        setError(await readError(res, 'Failed to add this year group'))
        return false
      }
      setNewName('')
      return true
    }, `"${name}" added.`)
    setBusy(false)
  }

  const patch = (cohort, updates) =>
    authenticatedFetch(`${API_BASE}/institution/cohorts/${cohort.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })

  const saveRename = async (cohort) => {
    const name = editName.trim()
    if (!name || name === cohort.name) {
      setEditingId(null)
      return
    }
    setBusyId(cohort.id)
    await run(async () => {
      const res = await patch(cohort, { name })
      if (!res.ok) {
        setError(await readError(res, 'Failed to rename this year group'))
        return false
      }
      setEditingId(null)
      return true
    }, `Renamed to "${name}". Every student in it moves with the name.`)
    setBusyId(null)
  }

  /** Swaps sort_order with the neighbour, which is what actually reorders the list. */
  const move = async (index, direction) => {
    const cohort = cohorts[index]
    const neighbour = cohorts[index + direction]
    if (!cohort || !neighbour) return
    setBusyId(cohort.id)
    await run(async () => {
      const first = await patch(cohort, { sort_order: neighbour.sort_order })
      if (!first.ok) {
        setError(await readError(first, 'Failed to reorder'))
        return false
      }
      const second = await patch(neighbour, { sort_order: cohort.sort_order })
      if (!second.ok) {
        setError(await readError(second, 'Failed to reorder'))
        return false
      }
      return true
    }, 'Order updated.')
    setBusyId(null)
  }

  const remove = async (cohort) => {
    const warning =
      cohort.students > 0
        ? `Delete "${cohort.name}"? ${cohort.students} student${cohort.students === 1 ? '' : 's'} will be left without a year group. They keep their access and all of their history, and you can reassign them afterwards.`
        : `Delete "${cohort.name}"?`
    if (!window.confirm(warning)) return

    setBusyId(cohort.id)
    await run(async () => {
      const res = await authenticatedFetch(`${API_BASE}/institution/cohorts/${cohort.id}`, { method: 'DELETE' })
      if (!res.ok) {
        setError(await readError(res, 'Failed to delete this year group'))
        return false
      }
      const body = await res.json().catch(() => ({}))
      const freed = body?.students_unassigned ?? 0
      return freed > 0
        ? `"${cohort.name}" deleted. ${freed} student${freed === 1 ? '' : 's'} now have no year group.`
        : `"${cohort.name}" deleted.`
    }, `"${cohort.name}" deleted.`)
    setBusyId(null)
  }

  return (
    <div className="qb-card inst-section">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div
            className="qb-card__icon"
            style={{
              background: '#fef3c7',
              border: '1.5px solid #f59e0b',
              color: '#b45309',
              borderRadius: '12px',
            }}
          >
            <LuLayers size={20} />
          </div>
          <div>
            <div className="qb-card__title">Year groups</div>
            <div className="qb-card__meta" style={{ marginTop: 4 }}>
              You define these, and assign students to them.
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="inst-alert inst-alert--error" role="alert">
          <div>{error}</div>
        </div>
      )}
      {notice && (
        <div className="inst-alert inst-alert--success" role="status">
          <div>{notice}</div>
        </div>
      )}

      <form className="inst-cohort-add" onSubmit={create}>
        <input
          type="text"
          className="db-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Year 1"
          maxLength={50}
          aria-label="New year group name"
        />
        <button type="submit" className="qb-btn qb-btn--sm" disabled={busy || !newName.trim()}>
          <LuPlus size={15} aria-hidden /> {busy ? 'Adding...' : 'Add'}
        </button>
      </form>

      {loading ? (
        <LoadingScreen message="Loading year groups..." inline />
      ) : cohorts.length === 0 ? (
        <p className="inst-placeholder">
          No year groups yet. Add one above, then you can assign students to it when you invite them.
        </p>
      ) : (
        <div className="inst-table-wrap">
          <table className="inst-table">
            <thead>
              <tr>
                <th>Year group</th>
                <th>Students</th>
                <th>Answered</th>
                <th>Accuracy</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {cohorts.map((cohort, index) => {
                const isBusy = busyId === cohort.id
                const isEditing = editingId === cohort.id
                return (
                  <tr key={cohort.id}>
                    <td>
                      {isEditing ? (
                        <div className="inst-cohort-edit">
                          <input
                            type="text"
                            className="db-input"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            maxLength={50}
                            aria-label={`Rename ${cohort.name}`}
                          />
                          <button
                            type="button"
                            className="qb-btn qb-btn--sm"
                            onClick={() => saveRename(cohort)}
                            disabled={isBusy}
                          >
                            {isBusy ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="inst-btn inst-btn--lg"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <span className="inst-table__email">{cohort.name}</span>
                      )}
                    </td>
                    <td className="inst-table__num">{cohort.students ?? 0}</td>
                    <td className="inst-table__num">{cohort.total_answered ?? 0}</td>
                    <td className="inst-table__num">
                      {cohort.accuracy_pct === null || cohort.accuracy_pct === undefined
                        ? '—'
                        : `${cohort.accuracy_pct}%`}
                    </td>
                    <td>
                      <div className="inst-table__actions">
                        <button
                          type="button"
                          className="inst-btn"
                          onClick={() => move(index, -1)}
                          disabled={isBusy || index === 0}
                          title="Move up"
                        >
                          <LuChevronUp size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inst-btn"
                          onClick={() => move(index, 1)}
                          disabled={isBusy || index === cohorts.length - 1}
                          title="Move down"
                        >
                          <LuChevronDown size={14} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="inst-btn"
                          onClick={() => {
                            if (isEditing) {
                              setEditingId(null)
                            } else {
                              setEditingId(cohort.id)
                              setEditName(cohort.name)
                            }
                          }}
                          disabled={isBusy}
                          title="Rename"
                        >
                          <LuPencil size={14} aria-hidden /> Rename
                        </button>
                        <button
                          type="button"
                          className="inst-btn inst-btn--danger"
                          onClick={() => remove(cohort)}
                          disabled={isBusy}
                          title="Delete"
                        >
                          <LuTrash2 size={14} aria-hidden /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {unassigned > 0 && (
        <p className="inst-form__hint" style={{ marginTop: 12 }}>
          {unassigned} student{unassigned === 1 ? ' has' : 's have'} no year group, so they are left out of year
          comparisons. Assign them from the roster below.
        </p>
      )}
    </div>
  )
}
