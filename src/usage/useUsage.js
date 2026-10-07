import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { capturePageleave, capturePageview, initAnalytics } from './client.js'

const IDLE_MS = 5 * 60_000
const IDLE_CHECK_MS = 15_000
const INPUT_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart']

// Page views on every route change, plus idle handling so a tab left open doesn't
// count as time on page (FR-002, research Decision 7):
//  - tab hidden → $pageleave; visible again after more than 5 min → new $pageview
//  - visible but no input for 5 min → $pageleave; the next input → new $pageview
export function useUsageTracking({ user }) {
  const { pathname } = useLocation()

  useEffect(() => {
    if (user) initAnalytics({ user })
  }, [user])

  useEffect(() => {
    capturePageview()
  }, [pathname])

  useEffect(() => {
    let lastInput = Date.now()
    let idle = false
    let hiddenAt = null

    const goIdle = () => {
      if (idle) return
      idle = true
      capturePageleave()
    }
    const wake = () => {
      if (!idle) return
      idle = false
      capturePageview()
    }

    const onInput = () => {
      lastInput = Date.now()
      if (hiddenAt === null) wake()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now()
        goIdle()
        return
      }
      const away = hiddenAt === null ? 0 : Date.now() - hiddenAt
      hiddenAt = null
      lastInput = Date.now()
      if (away > IDLE_MS) wake()
      else idle = false
    }
    const check = setInterval(() => {
      if (hiddenAt === null && Date.now() - lastInput >= IDLE_MS) goIdle()
    }, IDLE_CHECK_MS)

    for (const type of INPUT_EVENTS) document.addEventListener(type, onInput, { passive: true, capture: true })
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(check)
      for (const type of INPUT_EVENTS) document.removeEventListener(type, onInput, { capture: true })
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])
}
