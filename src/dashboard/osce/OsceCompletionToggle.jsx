import React, { useEffect, useState } from 'react'
import { LuCircleCheck, LuCircle } from 'react-icons/lu'
import { authenticatedFetch } from '../../auth/token'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

/**
 * The learner's own "Mark as complete" switch for one OSCE station (spec 005, US2).
 * Loads its state from /osce/progress, updates optimistically, and reverts with a
 * message if the save fails. Separate from scored attempts.
 */
export default function OsceCompletionToggle({ stationId }) {
  const [completed, setCompleted] = useState(false)
  const [ready, setReady] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!stationId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE}/osce/progress`)
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled) setCompleted((d.completions || []).some((c) => c.station_id === stationId))
      } catch (e) {
        console.error('Failed to load station completion:', e)
      } finally {
        if (!cancelled) setReady(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [stationId])

  async function toggle() {
    if (saving) return
    const previous = completed
    const next = !previous
    setCompleted(next)
    setSaving(true)
    setError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/osce/stations/${stationId}/completion`, {
        method: 'PUT',
        body: JSON.stringify({ completed: next }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (e) {
      console.error('Failed to save station completion:', e?.message)
      setCompleted(previous)
      setError("Couldn't save — try again")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="osce-complete">
      <button
        type="button"
        role="switch"
        aria-checked={completed}
        className="osce-complete-toggle"
        onClick={toggle}
        disabled={!ready || saving}
      >
        {completed ? <LuCircleCheck size={16} aria-hidden /> : <LuCircle size={16} aria-hidden />}
        {completed ? 'Completed' : 'Mark as complete'}
      </button>
      {error && (
        <span className="osce-complete__error" role="status">
          {error}
        </span>
      )}
    </div>
  )
}
