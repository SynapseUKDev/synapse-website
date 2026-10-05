import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const ph = {
  init: vi.fn(),
  identify: vi.fn(),
  register: vi.fn(),
  capture: vi.fn(),
  reset: vi.fn(),
  opt_out_capturing: vi.fn(),
  opt_in_capturing: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
}
vi.mock('posthog-js', () => ({ default: ph }))

const props = {
  user_type: 'institution_learner',
  institution_id: 'inst-1',
  institution_name: 'Test University',
  cohort_id: null,
  cohort_name: null,
  is_internal: false,
  signup_month: '2026-09',
}
const user = (enabled = true) => ({ id: 'user-1', email: 'x@y.z', analytics: { enabled, properties: props } })

let a
beforeEach(async () => {
  vi.resetModules()
  for (const fn of Object.values(ph)) fn.mockReset?.()
  // Like posthog-js 1.436: an opt-out is remembered until opt_in_capturing, and
  // reset() clears the stored consent (so calling it after opting out undoes the opt-out).
  let optedOut = false
  ph.has_opted_out_capturing.mockImplementation(() => optedOut)
  ph.opt_out_capturing.mockImplementation(() => (optedOut = true))
  ph.opt_in_capturing.mockImplementation(() => (optedOut = false))
  ph.reset.mockImplementation(() => (optedOut = false))
  vi.stubEnv('VITE_POSTHOG_KEY', 'phc_test')
  vi.stubEnv('VITE_POSTHOG_HOST', '/ingest')
  a = await import('../../src/analytics/analytics.js')
})
afterEach(() => vi.unstubAllEnvs())

describe('initAnalytics', () => {
  test('does nothing without a project key', async () => {
    vi.stubEnv('VITE_POSTHOG_KEY', '')
    await a.initAnalytics({ user: user() })
    expect(ph.init).not.toHaveBeenCalled()
  })

  test('does nothing for an opted-out user', async () => {
    await a.initAnalytics({ user: user(false) })
    expect(ph.init).not.toHaveBeenCalled()
  })

  test('initialises once with the privacy configuration, then identifies by id only', async () => {
    await a.initAnalytics({ user: user() })
    await a.initAnalytics({ user: user() })
    expect(ph.init).toHaveBeenCalledTimes(1)
    const [key, config] = ph.init.mock.calls[0]
    expect(key).toBe('phc_test')
    expect(config).toMatchObject({
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      person_profiles: 'identified_only',
      persistence: 'localStorage',
      autocapture: true,
      capture_pageview: false,
      capture_pageleave: true,
      enable_heatmaps: true,
      capture_dead_clicks: true,
      rageclick: true,
      disable_session_recording: true,
      disable_surveys: true,
    })
    expect(typeof config.before_send).toBe('function')
    expect(ph.identify).toHaveBeenCalledWith('user-1', props)
    expect(ph.register).toHaveBeenCalledWith({ ...props, catalog_version: 1 })
    expect(JSON.stringify(ph.identify.mock.calls)).not.toContain('x@y.z')
  })

  test('clears a stale PostHog opt-out left in the browser when the account allows analytics', async () => {
    ph.opt_out_capturing()
    ph.opt_in_capturing.mockClear()
    await a.initAnalytics({ user: user() })
    expect(ph.opt_in_capturing).toHaveBeenCalled()
  })

  test('never throws when PostHog fails to initialise', async () => {
    ph.init.mockImplementation(() => {
      throw new Error('boom')
    })
    await expect(a.initAnalytics({ user: user() })).resolves.toBeUndefined()
    expect(() => a.track('mock.started', { timed: true })).not.toThrow()
    expect(() => a.capturePageview()).not.toThrow()
  })
})

describe('track and the pre-init queue', () => {
  test('queues key actions before init and sends them, sanitised, once initialised', async () => {
    a.track('account.signed_in', { method: 'password', email: 'x@y.z' })
    a.capturePageview()
    expect(ph.capture).not.toHaveBeenCalled()
    await a.initAnalytics({ user: user() })
    expect(ph.capture).toHaveBeenCalledWith('account.signed_in', { method: 'password' })
    expect(ph.capture).toHaveBeenCalledWith('$pageview')
  })

  test('caps the queue at 20 events', async () => {
    for (let i = 0; i < 30; i++) a.track('mock.started', { timed: true })
    await a.initAnalytics({ user: user() })
    expect(ph.capture).toHaveBeenCalledTimes(20)
  })

  test('discards the queue when the user turns out to be opted out', async () => {
    a.track('account.signed_in', { method: 'password' })
    await a.initAnalytics({ user: user(false) })
    await a.setOptOut(false)
    expect(ph.capture).not.toHaveBeenCalledWith('account.signed_in', expect.anything())
  })

  test('ignores events that are not in the catalogue', async () => {
    await a.initAnalytics({ user: user() })
    a.track('qbank.answer_chosen', { answer: 'B' })
    expect(ph.capture).not.toHaveBeenCalled()
  })

  test('never throws when capture throws', async () => {
    await a.initAnalytics({ user: user() })
    ph.capture.mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => a.track('mock.started', { timed: true })).not.toThrow()
  })
})

describe('opt-out and reset', () => {
  test('setOptOut(true) stops capture and resets the identity', async () => {
    await a.initAnalytics({ user: user() })
    await a.setOptOut(true)
    expect(ph.opt_out_capturing).toHaveBeenCalled()
    expect(ph.reset).toHaveBeenCalled()
    a.track('mock.started', { timed: true })
    expect(ph.capture).not.toHaveBeenCalled()
  })

  test('setOptOut(true) leaves PostHog opted out, so autocapture stops too (reset must not undo it)', async () => {
    await a.initAnalytics({ user: user() })
    await a.setOptOut(true)
    expect(ph.has_opted_out_capturing()).toBe(true)
    expect(ph.reset.mock.invocationCallOrder[0]).toBeLessThan(ph.opt_out_capturing.mock.invocationCallOrder[0])
  })

  test('opting back in sends no extra $opt_in event', async () => {
    await a.initAnalytics({ user: user() })
    await a.setOptOut(true)
    await a.setOptOut(false)
    expect(ph.opt_in_capturing).toHaveBeenCalledWith({ captureEventName: false })
  })

  test('setOptOut(false) opts back in and re-identifies', async () => {
    await a.initAnalytics({ user: user() })
    await a.setOptOut(true)
    ph.identify.mockClear()
    await a.setOptOut(false)
    expect(ph.opt_in_capturing).toHaveBeenCalled()
    expect(ph.identify).toHaveBeenCalledWith('user-1', props)
  })

  test('a /me that arrives opted out stops PostHog when it is already running (opted out elsewhere)', async () => {
    await a.initAnalytics({ user: user() })
    await a.initAnalytics({ user: user(false) })
    expect(ph.has_opted_out_capturing()).toBe(true)
  })

  test('setOptOut(false) initialises PostHog for a user who started opted out', async () => {
    await a.initAnalytics({ user: user(false) })
    await a.setOptOut(false)
    expect(ph.init).toHaveBeenCalledTimes(1)
    expect(ph.identify).toHaveBeenCalledWith('user-1', props)
  })

  test('resetAnalytics resets PostHog and stops all capture until the next signed-in init', async () => {
    await a.initAnalytics({ user: user() })
    a.resetAnalytics()
    expect(ph.reset).toHaveBeenCalled()
    expect(ph.has_opted_out_capturing()).toBe(true)
    await a.initAnalytics({ user: user() })
    expect(ph.has_opted_out_capturing()).toBe(false)
    ph.capture.mockClear()
    a.resetAnalytics()
    a.track('mock.started', { timed: true })
    expect(ph.capture).not.toHaveBeenCalled()
  })

  test('resetAnalytics is safe before PostHog is loaded', () => {
    expect(() => a.resetAnalytics()).not.toThrow()
    expect(ph.reset).not.toHaveBeenCalled()
  })
})
