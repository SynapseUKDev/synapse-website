import { beforeSend, sanitizeEventProps } from './beforeSend.js'
import { CATALOG_VERSION } from './catalog.js'

// The only module that talks to PostHog (spec 002). posthog-js is loaded with a dynamic
// import once /me confirms a signed-in user with analytics enabled, so signed-out pages
// never download it. Every export is fire-and-forget: it never throws into UI code.
//
// Key actions fired before PostHog loads (e.g. account.signed_in on the auth callback)
// wait in a small in-memory queue; auth flows reach the dashboard with navigate(), not a
// full reload, so the queue survives. It is discarded if the user turns out to be opted out.

const MAX_PENDING = 20

let posthog = null // the initialised client, once loaded
let loading = null // in-flight init, so concurrent calls share it
let user = null // the /me user analytics was last initialised for
let decided = false // whether we know if the current user is tracked
let active = false // capturing for the current user
let pending = []

function send(event, props) {
  if (props) posthog.capture(event, props)
  else posthog.capture(event)
}

function enqueue(event, props) {
  if (active && posthog) send(event, props)
  else if (!decided && pending.length < MAX_PENDING) pending.push([event, props])
}

async function load(key) {
  const { default: ph } = await import('posthog-js')
  ph.init(key, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    person_profiles: 'identified_only',
    persistence: 'localStorage',
    autocapture: true,
    capture_pageview: false,
    capture_pageleave: true,
    enable_heatmaps: true,
    capture_dead_clicks: false, // its add-on file name is on ad-block lists; rage clicks cover most of the same friction
    rageclick: true,
    disable_session_recording: true,
    disable_surveys: true,
    before_send: beforeSend,
  })
  return ph
}

// posthog.reset() clears the stored opt-out, so it must always run *before*
// opt_out_capturing(); in the other order PostHog keeps autocapturing under a new
// anonymous id. Used on opt-out and on sign-out, so nothing is captured until the
// next signed-in init opts back in.
function forgetAndStop() {
  posthog.reset()
  posthog.opt_out_capturing()
}

function identify() {
  const properties = user.analytics.properties || {}
  if (posthog.has_opted_out_capturing()) posthog.opt_in_capturing({ captureEventName: false })
  posthog.identify(user.id, properties)
  posthog.register({ ...properties, catalog_version: CATALOG_VERSION })
}

/** Start (or confirm) analytics for the signed-in user from GET /me. */
export async function initAnalytics({ user: next } = {}) {
  try {
    user = next || null
    decided = true
    const key = import.meta.env.VITE_POSTHOG_KEY
    if (!key || !user?.id || !user.analytics?.enabled) {
      active = false
      pending = []
      if (posthog && !posthog.has_opted_out_capturing()) forgetAndStop()
      return
    }
    if (!posthog) {
      loading = loading || load(key)
      posthog = await loading
    }
    identify()
    active = true
    const queued = pending
    pending = []
    for (const [event, props] of queued) send(event, props)
  } catch {
    active = false
    pending = []
    loading = null
  }
}

/** Record a key action from the event catalogue (contracts/event-catalog.md). */
export function track(name, props) {
  try {
    const clean = sanitizeEventProps(name, props)
    if (clean) enqueue(name, clean)
  } catch {
    // analytics must never break the app
  }
}

export function capturePageview() {
  try {
    enqueue('$pageview')
  } catch {
    // ignore
  }
}

export function capturePageleave() {
  try {
    if (active && posthog) send('$pageleave')
  } catch {
    // ignore
  }
}

/** Apply the Settings → Privacy switch immediately (the server stores the choice). */
export async function setOptOut(optOut) {
  try {
    if (optOut) {
      active = false
      pending = []
      if (posthog) forgetAndStop()
      if (user?.analytics) user = { ...user, analytics: { ...user.analytics, enabled: false } }
      return
    }
    if (user?.analytics) await initAnalytics({ user: { ...user, analytics: { ...user.analytics, enabled: true } } })
  } catch {
    // ignore
  }
}

/** Sign-out: forget the user so the next person on this browser starts fresh. */
export function resetAnalytics() {
  try {
    active = false
    decided = false
    pending = []
    user = null
    if (posthog) forgetAndStop()
  } catch {
    // ignore
  }
}
