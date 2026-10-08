import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ReviewPanel from '../../src/dashboard/admin/flashcards-v2/ReviewPanel'
import StudyCard from '../../src/dashboard/flashcards-v2/StudyCard'
import { removeCardMedia, uploadCardMedia } from '../../src/dashboard/admin/flashcards-v2/flashcardsV2AdminApi'
import { card, mockFetch } from './fetchMock'
import { ADMIN, REVIEW_PATH, TOPIC, adminCard, reviewPayload } from './adminFixtures'

const CARD_ID = 'c1'
const MEDIA_PATH = `${ADMIN}/cards/${CARD_ID}/media`
const ALT_HINT = 'Describe what the image shows without naming the diagnosis being tested'

const pngFile = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'ecg.png', { type: 'image/png' })

const mediaCard = (extra = {}) =>
  adminCard(CARD_ID, 'gout:xray', {
    cardType: 'media',
    contentVersion: 4,
    qaStatus: 'media_pending',
    isMediaRequired: true,
    mediaRequirement: 'AP foot X-ray showing erosions',
    ...extra,
  })

const ATTACHED = { id: 'm1', url: 'https://cdn.example/flashcards/c1/a.png', alt: 'AP radiograph of the right foot' }

function api(initialReview, routes = {}) {
  const state = { review: initialReview }
  const m = mockFetch((url, init, call) => {
    const h = routes[`${call.method} ${url.pathname}`]
    if (h) return h(url, call, state)
    if (url.pathname === REVIEW_PATH) return [200, state.review]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
  return { ...m, state }
}

const renderPanel = () => render(<ReviewPanel topicId={TOPIC} topicName="Gout" />)
const mediaRegion = async () => screen.findByRole('region', { name: 'Card image gout:xray' })

function fillUpload(region, { file = pngFile(), alt = 'AP radiograph of the right foot' } = {}) {
  fireEvent.change(within(region).getByLabelText(/Image file/), { target: { files: file ? [file] : [] } })
  fireEvent.change(within(region).getByLabelText(/Alt text/), { target: { value: alt } })
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('media API client', () => {
  test('uploadCardMedia posts FormData with file, alt and expectedVersion', async () => {
    const m = mockFetch(() => [201, { cardId: CARD_ID, asset: { ...ATTACHED, width: 1, height: 1 }, contentVersion: 5, qaStatus: 'validated' }])
    const file = pngFile()
    const out = await uploadCardMedia(CARD_ID, { file, alt: 'An ECG', expectedVersion: 4 })
    expect(out.contentVersion).toBe(5)
    const [call] = m.calls
    expect(call.method).toBe('POST')
    expect(call.url.pathname).toBe(MEDIA_PATH)
    expect(call.init.body).toBeInstanceOf(FormData)
    expect(call.init.body.get('file')).toBe(file)
    expect(call.init.body.get('alt')).toBe('An ECG')
    expect(call.init.body.get('expectedVersion')).toBe('4')
    // The browser must set the multipart boundary itself.
    const headers = new Headers(call.init.headers)
    expect(headers.get('Content-Type')).toBeNull()
  })

  test('removeCardMedia sends DELETE {expectedVersion}', async () => {
    const m = mockFetch(() => [200, { cardId: CARD_ID, contentVersion: 6, qaStatus: 'media_pending' }])
    await removeCardMedia(CARD_ID, 5)
    expect(m.calls[0].method).toBe('DELETE')
    expect(m.calls[0].url.pathname).toBe(MEDIA_PATH)
    expect(m.calls[0].body).toEqual({ expectedVersion: 5 })
  })

  test('409 STALE_VERSION is kind stale with details; 413 is kind too_large', async () => {
    mockFetch(() => [409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 9 } }])
    await expect(uploadCardMedia(CARD_ID, { file: pngFile(), alt: 'x', expectedVersion: 4 })).rejects.toMatchObject({
      status: 409,
      kind: 'stale',
      code: 'STALE_VERSION',
      details: { currentVersion: 9 },
    })
    mockFetch(() => [413, { error: 'Images must be 8 MB or smaller.', code: 'IMAGE_TOO_LARGE' }])
    await expect(uploadCardMedia(CARD_ID, { file: pngFile(), alt: 'x', expectedVersion: 4 })).rejects.toMatchObject({
      status: 413,
      kind: 'too_large',
      code: 'IMAGE_TOO_LARGE',
    })
  })
})

describe('admin card image control', () => {
  test('shows the requirement, the alt hint, and needs a file and alt text before uploading', async () => {
    api(reviewPayload({ cards: [mediaCard()] }))
    renderPanel()
    const region = await mediaRegion()
    expect(within(region).getByText('AP foot X-ray showing erosions')).toBeInTheDocument()
    expect(within(region).getByText(ALT_HINT)).toBeInTheDocument()
    expect(within(region).getByText(/No image attached/)).toBeInTheDocument()
    const button = within(region).getByRole('button', { name: 'Upload image' })
    expect(button).toBeDisabled()
    fillUpload(region, { alt: '   ' })
    expect(button).toBeDisabled()
    fillUpload(region)
    expect(button).toBeEnabled()
  })

  test('upload sends FormData with expectedVersion, then refreshes the card', async () => {
    const m = api(reviewPayload({ cards: [mediaCard()] }), {
      [`POST ${MEDIA_PATH}`]: (_u, _c, state) => {
        state.review = reviewPayload({ cards: [mediaCard({ contentVersion: 5, qaStatus: 'validated', media: ATTACHED })] })
        return [201, { cardId: CARD_ID, asset: { ...ATTACHED, width: 10, height: 10 }, contentVersion: 5, qaStatus: 'validated' }]
      },
    })
    renderPanel()
    const region = await mediaRegion()
    fillUpload(region)
    fireEvent.click(within(region).getByRole('button', { name: 'Upload image' }))

    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    const [post] = m.calls.filter((c) => c.method === 'POST')
    expect(post.init.body.get('expectedVersion')).toBe('4')
    expect(post.init.body.get('alt')).toBe('AP radiograph of the right foot')
    expect(post.init.body.get('file')).toBeInstanceOf(File)

    const after = await mediaRegion()
    const img = await within(after).findByRole('img', { name: ATTACHED.alt })
    expect(img).toHaveAttribute('src', ATTACHED.url)
    expect(within(after).getByRole('button', { name: 'Replace image' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Review notices' })).toHaveTextContent(/Image attached to gout:xray/)
  })

  test('409 explains the conflict and offers a reload', async () => {
    const m = api(reviewPayload({ cards: [mediaCard()] }), {
      [`POST ${MEDIA_PATH}`]: (_u, _c, state) => {
        state.review = reviewPayload({ cards: [mediaCard({ contentVersion: 6 })] })
        return [409, { error: 'The card was changed by someone else; reload it', code: 'STALE_VERSION', details: { currentVersion: 6 } }]
      },
    })
    renderPanel()
    const region = await mediaRegion()
    fillUpload(region)
    fireEvent.click(within(region).getByRole('button', { name: 'Upload image' }))
    const alert = await within(region).findByRole('alert')
    expect(alert).toHaveTextContent(/changed since you loaded it \(now version 6\)/)
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload review' }))
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    // The reloaded card carries the new version: the stale message is gone.
    await waitFor(() => expect(within(region).queryByRole('alert')).toBeNull())
  })

  test('413 and 400 show their messages', async () => {
    let answer = [413, { error: 'Images must be 8 MB or smaller.', code: 'IMAGE_TOO_LARGE' }]
    api(reviewPayload({ cards: [mediaCard()] }), { [`POST ${MEDIA_PATH}`]: () => answer })
    renderPanel()
    const region = await mediaRegion()
    fillUpload(region)
    fireEvent.click(within(region).getByRole('button', { name: 'Upload image' }))
    expect(await within(region).findByRole('alert')).toHaveTextContent('Images must be 8 MB or smaller.')

    answer = [400, { error: 'The file says it is JPEG but its contents are PNG. Re-save it and try again.', code: 'IMAGE_TYPE_MISMATCH', details: { path: 'file' } }]
    fireEvent.click(within(region).getByRole('button', { name: 'Upload image' }))
    await waitFor(() => expect(within(region).getByRole('alert')).toHaveTextContent(/its contents are PNG/))
  })

  test('remove sends expectedVersion and refreshes', async () => {
    const m = api(reviewPayload({ cards: [mediaCard({ qaStatus: 'validated', media: ATTACHED })] }), {
      [`DELETE ${MEDIA_PATH}`]: (_u, _c, state) => {
        state.review = reviewPayload({ cards: [mediaCard({ contentVersion: 5 })] })
        return [200, { cardId: CARD_ID, contentVersion: 5, qaStatus: 'media_pending' }]
      },
    })
    renderPanel()
    const region = await mediaRegion()
    expect(within(region).getByRole('img', { name: ATTACHED.alt })).toBeInTheDocument()
    expect(within(region).getByText(`Alt text: ${ATTACHED.alt}`)).toBeInTheDocument()
    fireEvent.click(within(region).getByRole('button', { name: 'Remove image' }))
    // Asks first; nothing is sent until confirmed.
    expect(within(region).getByText('Removing the image unpublishes this card and withdraws the topic approval')).toBeInTheDocument()
    expect(m.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
    fireEvent.click(within(region).getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    const [del] = m.calls.filter((c) => c.method === 'DELETE')
    expect(del.body).toEqual({ expectedVersion: 4 })
    expect(await within(await mediaRegion()).findByText(/No image attached/)).toBeInTheDocument()
  })

  test('remove can be cancelled without calling the API', async () => {
    const m = api(reviewPayload({ cards: [mediaCard({ qaStatus: 'validated', media: ATTACHED })] }))
    renderPanel()
    const region = await mediaRegion()
    fireEvent.click(within(region).getByRole('button', { name: 'Remove image' }))
    fireEvent.click(within(region).getByRole('button', { name: 'Keep image' }))
    expect(within(region).queryByText(/withdraws the topic approval/)).toBeNull()
    expect(m.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0)
  })

  test('content changed while an image is attached: asks to confirm and offers re-attach (a replace upload)', async () => {
    api(reviewPayload({ cards: [mediaCard({ qaStatus: 'media_pending', media: ATTACHED })] }))
    renderPanel()
    const region = await mediaRegion()
    expect(within(region).getByText('Content changed — confirm the image still matches')).toBeInTheDocument()
    fireEvent.click(within(region).getByRole('button', { name: 'Re-attach current image' }))
    expect(within(region).getByLabelText(/Alt text/)).toHaveValue(ATTACHED.alt)
    expect(within(region).getByLabelText(/Image file/)).toHaveFocus()
  })

  test('no image control for cards that do not take an image', async () => {
    api(reviewPayload({ cards: [adminCard('c2', 'gout:a')] }))
    renderPanel()
    await screen.findByRole('region', { name: 'Card gout:a' })
    expect(screen.queryByRole('region', { name: /Card image/ })).toBeNull()
  })
})

describe('StudyCard media', () => {
  test('renders media lazily with its alt on the front; no image when media is null', () => {
    const { container, rerender } = render(<StudyCard card={card('a', { media: null })} revealed={false} />)
    expect(container.querySelector('img')).toBeNull()
    rerender(<StudyCard card={card('a', { media: ATTACHED })} revealed={false} />)
    const img = screen.getByRole('img', { name: ATTACHED.alt })
    expect(img).toHaveAttribute('src', ATTACHED.url)
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img.closest('.fc2-card__front')).not.toBeNull()
  })
})
