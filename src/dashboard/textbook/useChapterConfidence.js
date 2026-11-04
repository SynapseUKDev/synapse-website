import { useCallback, useEffect, useRef, useState } from 'react'
import { authenticatedFetch } from '../../auth/token'
import { CONFIDENCE_LEVELS } from './textbookProgressLabels.js'

export const CONFIDENCE_SAVE_ERROR = "Couldn't save confidence. Try again."

const normalize = (level) => (CONFIDENCE_LEVELS.includes(level) ? level : 'low')

/**
 * Confidence for the item being read (topic or subtopic).
 *
 * Saves are serialised: while one request is in flight only the newest pending level is kept,
 * and it is sent when the current request finishes. This keeps the stored value equal to the
 * learner's last click even when they click quickly (concurrent PUTs could land out of order).
 * Only the final request of a chain may revert the value or show an error.
 */
export function useChapterConfidence({ API_BASE, target }) {
  const [value, setValue] = useState('low')
  const [error, setError] = useState(null)

  const targetRef = useRef(target)
  const generation = useRef(0)
  const inFlight = useRef(false)
  const pending = useRef(null)
  const lastSaved = useRef('low')
  const touched = useRef(false)

  const targetKey = target ? `${target.type}:${target.id}` : ''
  useEffect(() => {
    targetRef.current = target
    generation.current += 1
    inFlight.current = false
    pending.current = null
    lastSaved.current = 'low'
    touched.current = false
    setValue('low')
    setError(null)
    // target identity is captured by targetKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])

  const send = useCallback(async (level) => {
    const tgt = targetRef.current
    const gen = generation.current
    inFlight.current = true
    let saved = false
    try {
      const endpoint = tgt.type === 'subtopic'
        ? `${API_BASE}/textbook/subtopic/${tgt.id}/progress`
        : `${API_BASE}/textbook/topic/${tgt.id}/progress`
      const res = await authenticatedFetch(endpoint, {
        method: 'PUT',
        body: JSON.stringify({ confidence: level }),
      })
      saved = !!res?.ok
    } catch (e) {
      console.error('Error updating confidence:', e)
    }
    if (gen !== generation.current) return // the page moved on; ignore this response
    inFlight.current = false
    if (saved) lastSaved.current = level

    const next = pending.current
    pending.current = null
    if (next !== null && (next !== level || !saved)) {
      send(next)
      return
    }
    if (!saved) {
      setValue(lastSaved.current)
      setError(CONFIDENCE_SAVE_ERROR)
    }
  }, [API_BASE])

  const change = useCallback((level) => {
    if (!targetRef.current || !CONFIDENCE_LEVELS.includes(level)) return
    touched.current = true
    setValue(level)
    setError(null)
    if (inFlight.current) {
      pending.current = level
      return
    }
    send(level)
  }, [send])

  const setInitial = useCallback((level) => {
    if (touched.current) return // the learner already chose; a late load must not overwrite it
    const normalized = normalize(level)
    lastSaved.current = normalized
    setValue(normalized)
  }, [])

  return { value, setInitial, change, error }
}
