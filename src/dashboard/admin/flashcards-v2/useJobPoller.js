import { useCallback, useEffect, useRef, useState } from 'react'
import { getJob } from './flashcardsV2AdminApi'

/** GET /admin/jobs/:id every 3 s (each poll also re-kicks a queued or lease-expired job server-side). */
export const POLL_INTERVAL_MS = 3000
/** Give up watching after 10 minutes; the job itself may still finish. */
export const POLL_TIMEOUT_MS = 10 * 60 * 1000

// Errors after which another poll cannot succeed; anything else (network blip, 500) is retried.
const FATAL_KINDS = new Set(['not_found', 'forbidden', 'unauthorized', 'validation'])

/**
 * Follows one background job until it ends.
 *   phase: idle | polling | succeeded | failed | timed_out | error
 * `follow(jobId)` (re)starts polling: the first poll is one interval after the call, then one per
 * interval, each scheduled only after the previous answer arrived (never overlapping). On
 * `succeeded` the latest `onSucceeded(job)` is called once. Unmounting stops everything.
 */
export function useJobPoller({ onSucceeded } = {}) {
  const [target, setTarget] = useState(null) // {id, n}: n restarts polling for a re-followed id
  const [job, setJob] = useState(null)
  const [phase, setPhase] = useState('idle')
  const [pollError, setPollError] = useState(null)
  const onSucceededRef = useRef(onSucceeded)
  useEffect(() => {
    onSucceededRef.current = onSucceeded
  })

  const follow = useCallback((id) => {
    setJob(null)
    setPollError(null)
    setPhase('polling')
    setTarget((t) => ({ id, n: (t?.n ?? 0) + 1 }))
  }, [])

  useEffect(() => {
    if (!target) return undefined
    let cancelled = false
    let timer
    const startedAt = Date.now()

    async function tick() {
      if (cancelled) return
      if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
        setPhase('timed_out')
        return
      }
      try {
        const next = await getJob(target.id)
        if (cancelled) return
        setJob(next)
        setPollError(null)
        if (next?.status === 'succeeded') {
          setPhase('succeeded')
          onSucceededRef.current?.(next)
          return
        }
        if (next?.status === 'failed') {
          setPhase('failed')
          return
        }
      } catch (error) {
        if (cancelled) return
        setPollError(error)
        if (FATAL_KINDS.has(error?.kind)) {
          setPhase('error')
          return
        }
      }
      timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [target])

  return { jobId: target?.id ?? null, job, phase, pollError, follow, polling: phase === 'polling' }
}
