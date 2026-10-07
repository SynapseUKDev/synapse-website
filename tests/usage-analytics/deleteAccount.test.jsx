import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Settings from '../../src/dashboard/Settings.jsx'
import { resetAnalytics } from '../../src/usage/client.js'

vi.mock('../../src/usage/client.js', () => ({
  resetAnalytics: vi.fn(),
  setOptOut: vi.fn(),
}))

const user = { id: 'user-1', email: 'x@y.z', username: 'x', analytics_opt_out: false }

function renderSettings() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/settings']}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user }} />}>
          <Route path="settings" element={<Settings />} />
        </Route>
        <Route path="/" element={<div>home</div>} />
      </Routes>
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.fetch = vi.fn(async (url, init = {}) => ({
    ok: true,
    json: async () => (init.method === 'DELETE' ? { ok: true } : { user, access: null, institution: null }),
  }))
})
afterEach(() => {
  delete globalThis.fetch
})

describe('account deletion and usage analytics', () => {
  test('stops analytics before the DELETE request, and the confirm modal is never captured', async () => {
    const { container } = renderSettings()
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Account' }))

    expect(container.querySelector('.delete-confirm-overlay')).toHaveClass('ph-no-capture')

    fireEvent.change(screen.getByPlaceholderText('delete my account'), { target: { value: 'delete my account' } })
    fireEvent.click(container.querySelector('.delete-confirm-hidden-checkbox'))
    fireEvent.submit(container.querySelector('.delete-confirm-form'))

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringMatching(/\/me$/), expect.objectContaining({ method: 'DELETE' })))
    const deleteCall = globalThis.fetch.mock.calls.findIndex(([, init]) => init?.method === 'DELETE')
    expect(resetAnalytics).toHaveBeenCalled()
    expect(resetAnalytics.mock.invocationCallOrder[0]).toBeLessThan(globalThis.fetch.mock.invocationCallOrder[deleteCall])
  })
})
