import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

vi.mock('../../src/auth/token', () => ({ authenticatedFetch: vi.fn() }))

import { authenticatedFetch } from '../../src/auth/token'
import { useChapterConfidence } from '../../src/dashboard/textbook/useChapterConfidence.js'

const API = 'http://api.test'
const TOPIC = { type: 'topic', id: 't1' }
const SUBTOPIC = { type: 'subtopic', id: 's1' }

function deferred() {
  let resolve
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}
const okRes = () => ({ ok: true, json: async () => ({ ok: true }) })
const failRes = () => ({ ok: false, status: 500, json: async () => ({}) })
const sentLevels = () => authenticatedFetch.mock.calls.map(([, opts]) => JSON.parse(opts.body).confidence)

beforeEach(() => {
  authenticatedFetch.mockReset()
})

describe('useChapterConfidence', () => {
  test('setInitial sets the stored value; missing or invalid defaults to low', () => {
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))
    act(() => result.current.setInitial('moderate'))
    expect(result.current.value).toBe('moderate')
    act(() => result.current.setInitial(undefined))
    expect(result.current.value).toBe('low')
    act(() => result.current.setInitial('bogus'))
    expect(result.current.value).toBe('low')
  })

  test('saves to the topic endpoint for a topic page', async () => {
    authenticatedFetch.mockResolvedValue(okRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))
    await act(async () => { result.current.change('high') })
    expect(authenticatedFetch).toHaveBeenCalledWith(`${API}/textbook/topic/t1/progress`, {
      method: 'PUT',
      body: JSON.stringify({ confidence: 'high' }),
    })
    expect(result.current.value).toBe('high')
    expect(result.current.error).toBeNull()
  })

  test('saves to the subtopic endpoint for a subtopic page', async () => {
    authenticatedFetch.mockResolvedValue(okRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: SUBTOPIC }))
    await act(async () => { result.current.change('moderate') })
    expect(authenticatedFetch.mock.calls[0][0]).toBe(`${API}/textbook/subtopic/s1/progress`)
  })

  test('a failed save reverts to the previous level and sets the error text', async () => {
    authenticatedFetch.mockResolvedValue(failRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))
    act(() => result.current.setInitial('moderate'))
    await act(async () => { result.current.change('high') })
    await waitFor(() => expect(result.current.value).toBe('moderate'))
    expect(result.current.error).toBe("Couldn't save confidence. Try again.")
  })

  test('rapid clicks are serialised: only the newest pending level is sent after the in-flight one', async () => {
    const first = deferred()
    authenticatedFetch.mockImplementationOnce(() => first.promise).mockResolvedValue(okRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))

    act(() => result.current.change('moderate'))
    act(() => result.current.change('low'))
    act(() => result.current.change('high'))
    expect(result.current.value).toBe('high')
    expect(authenticatedFetch).toHaveBeenCalledTimes(1) // second request waits for the first

    await act(async () => { first.resolve(okRes()) })
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(2))
    expect(sentLevels()).toEqual(['moderate', 'high'])
    expect(result.current.value).toBe('high')
    expect(result.current.error).toBeNull()
  })

  test('an earlier failure in a chain does not revert when the final save succeeds', async () => {
    const first = deferred()
    authenticatedFetch.mockImplementationOnce(() => first.promise).mockResolvedValue(okRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))

    act(() => result.current.change('moderate'))
    act(() => result.current.change('high'))
    await act(async () => { first.resolve(failRes()) })
    await waitFor(() => expect(authenticatedFetch).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.value).toBe('high'))
    expect(result.current.error).toBeNull()
  })

  test('if the final save fails, revert to the last successfully saved level', async () => {
    const first = deferred()
    authenticatedFetch.mockImplementationOnce(() => first.promise).mockResolvedValue(failRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))

    act(() => result.current.change('moderate'))
    act(() => result.current.change('high'))
    await act(async () => { first.resolve(okRes()) }) // moderate saved
    await waitFor(() => expect(result.current.error).toBe("Couldn't save confidence. Try again."))
    expect(result.current.value).toBe('moderate')
  })

  test('ignores invalid levels', async () => {
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))
    await act(async () => { result.current.change('extreme') })
    expect(authenticatedFetch).not.toHaveBeenCalled()
    expect(result.current.value).toBe('low')
  })

  test('does nothing without a target', async () => {
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: null }))
    await act(async () => { result.current.change('high') })
    expect(authenticatedFetch).not.toHaveBeenCalled()
  })

  test('resets when the target changes, and a stale response cannot touch the new page', async () => {
    const first = deferred()
    authenticatedFetch.mockImplementationOnce(() => first.promise)
    const { result, rerender } = renderHook(({ target }) => useChapterConfidence({ API_BASE: API, target }), {
      initialProps: { target: TOPIC },
    })
    act(() => result.current.change('high'))
    rerender({ target: SUBTOPIC })
    expect(result.current.value).toBe('low')
    await act(async () => { first.resolve(failRes()) })
    expect(result.current.value).toBe('low')
    expect(result.current.error).toBeNull()
  })

  test('a late initial load does not overwrite a click made before it arrived', async () => {
    authenticatedFetch.mockResolvedValue(okRes())
    const { result } = renderHook(() => useChapterConfidence({ API_BASE: API, target: TOPIC }))
    await act(async () => { result.current.change('high') })
    act(() => result.current.setInitial('low'))
    expect(result.current.value).toBe('high')
  })
})
