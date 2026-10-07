import React from 'react'
import { act, render } from '@testing-library/react'
import { MemoryRouter, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { useUsageTracking } from '../../src/usage/useUsage.js'
import { capturePageleave, capturePageview, initAnalytics } from '../../src/usage/client.js'

vi.mock('../../src/usage/client.js', () => ({
  initAnalytics: vi.fn(),
  capturePageview: vi.fn(),
  capturePageleave: vi.fn(),
}))

const MIN = 60_000
const user = { id: 'user-1', analytics: { enabled: true, properties: {} } }
let go

function Harness({ u = user }) {
  useUsageTracking({ user: u })
  go = useNavigate()
  return null
}

function setVisibility(state) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
})
afterEach(() => vi.useRealTimers())

const mount = (u) =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Harness u={u} />
    </MemoryRouter>
  )

describe('useUsageTracking', () => {
  test('initialises analytics for the loaded user, and not before', () => {
    mount(null)
    expect(initAnalytics).not.toHaveBeenCalled()
    mount(user)
    expect(initAnalytics).toHaveBeenCalledWith({ user })
  })

  test('captures one $pageview per route change', () => {
    mount()
    expect(capturePageview).toHaveBeenCalledTimes(1)
    act(() => go('/dashboard/question-bank'))
    act(() => go('/dashboard/question-bank?tab=2'))
    expect(capturePageview).toHaveBeenCalledTimes(2)
  })

  test('hidden tab → $pageleave; visible again after > 5 min → new $pageview', () => {
    mount()
    capturePageview.mockClear()
    act(() => setVisibility('hidden'))
    expect(capturePageleave).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(6 * MIN))
    act(() => setVisibility('visible'))
    expect(capturePageview).toHaveBeenCalledTimes(1)
  })

  test('visible again within 5 min → no new $pageview', () => {
    mount()
    capturePageview.mockClear()
    act(() => setVisibility('hidden'))
    act(() => vi.advanceTimersByTime(2 * MIN))
    act(() => setVisibility('visible'))
    expect(capturePageview).not.toHaveBeenCalled()
  })

  test('visible but no input for 5 min → one $pageleave; next input → new $pageview', () => {
    mount()
    capturePageview.mockClear()
    act(() => vi.advanceTimersByTime(6 * MIN))
    expect(capturePageleave).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(30 * MIN))
    expect(capturePageleave).toHaveBeenCalledTimes(1)
    act(() => document.dispatchEvent(new Event('pointerdown')))
    expect(capturePageview).toHaveBeenCalledTimes(1)
  })

  test('regular input keeps the page active', () => {
    mount()
    for (let i = 0; i < 10; i++) {
      act(() => vi.advanceTimersByTime(MIN))
      act(() => document.dispatchEvent(new Event('keydown')))
    }
    expect(capturePageleave).not.toHaveBeenCalled()
  })

  test('removes its listeners on unmount', () => {
    const { unmount } = mount()
    unmount()
    act(() => setVisibility('hidden'))
    act(() => vi.advanceTimersByTime(10 * MIN))
    expect(capturePageleave).not.toHaveBeenCalled()
  })
})
