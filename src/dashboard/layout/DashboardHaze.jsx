import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './DashboardBackground.css'

// The resolved theme already lives on <html data-theme>, written by theme.js
// before first paint. Mirror it rather than keeping a second preference store.
function readMode() {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

// Light mode ships golden yellow. Dev builds accept ?haze=blue to paint the
// light-blue alternative instead, so the two can be compared on real pages;
// production always uses the stylesheet default. Dark mode is unaffected.
function readTint(search) {
  if (!import.meta.env.DEV) return undefined
  return new URLSearchParams(search).get('haze') === 'blue' ? 'blue' : undefined
}

/**
 * Decorative corner haze for the authenticated shell.
 *
 * One haze from the top-right corner and a weaker one from the bottom left.
 * Renders a zero-height sticky anchor so the gradient layer inside it is sized
 * from the viewport and the content column, never from document length: long
 * articles get the same haze as a short dashboard.
 */
export default function DashboardHaze() {
  const [mode, setMode] = useState(readMode)
  const { search } = useLocation()

  useEffect(() => {
    // The theme can be re-applied between first render and mount (and on every
    // toggle), so resync once here and then watch the attribute.
    setMode(readMode())
    const observer = new MutationObserver(() => setMode(readMode()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })
    return () => observer.disconnect()
  }, [])

  return (
    <div className="dash-haze" aria-hidden="true">
      <div className="dash-haze__layer" data-mode={mode} data-tint={readTint(search)} />
    </div>
  )
}
