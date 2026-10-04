import { useEffect } from 'react'

/*
 * Minimal unsaved-changes guard. The app uses <BrowserRouter>, which has no
 * route blocker, so a screen with unsaved work registers a message here and
 * in-app navigation (sidebar, mobile nav, links) asks before leaving.
 * The browser Back button is not intercepted.
 */

let activeMessage = null

/** Returns true when navigation may proceed (nothing unsaved, or the user confirmed). */
export function confirmNavigation() {
  return !activeMessage || window.confirm(activeMessage)
}

function isPlainLeftClick(event) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

export function useUnsavedChangesGuard(when, message = 'You have unsaved changes. Leave this page and discard them?') {
  useEffect(() => {
    if (!when) return undefined
    activeMessage = message

    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    // Capture phase runs before React Router's <Link> handler, so cancelling here stops the navigation.
    const onClick = (event) => {
      if (event.defaultPrevented || !isPlainLeftClick(event)) return
      const anchor = event.target.closest?.('a[href]')
      if (!anchor || (anchor.target && anchor.target !== '_self')) return
      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      if (url.pathname === window.location.pathname && url.search === window.location.search) return
      if (!window.confirm(message)) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      if (activeMessage === message) activeMessage = null
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [when, message])
}
