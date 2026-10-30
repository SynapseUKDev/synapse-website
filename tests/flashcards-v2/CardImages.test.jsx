import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import CardImagesControl from '../../src/dashboard/admin/flashcards-v2/CardImagesControl'
import ImageForm from '../../src/dashboard/admin/flashcards-v2/ImageForm'
import { validateImageForm } from '../../src/dashboard/admin/flashcards-v2/imageRules'
import { mockFetch } from './fetchMock'
import { CARDS_PATH, adminCard, image } from './adminFixtures'

const MEDIA_PATH = `${CARDS_PATH}/c1/media`
const pngFile = (name = 'ecg.png', size) => {
  const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], name, { type: 'image/png' })
  if (size) Object.defineProperty(file, 'size', { value: size })
  return file
}

const mediaCard = (extra = {}) =>
  adminCard('c1', 'gout:xray', {
    cardType: 'media',
    contentVersion: 4,
    qaStatus: 'media_pending',
    isMediaRequired: true,
    mediaRequirement: 'AP foot X-ray showing erosions',
    ...extra,
  })

function fill(form, { file = pngFile(), alt = 'AP radiograph of the right foot', attribution, license, sourceUrl } = {}) {
  fireEvent.change(within(form).getByLabelText(/image file/), { target: { files: file ? [file] : [] } })
  fireEvent.change(within(form).getByLabelText('Alt text'), { target: { value: alt } })
  if (attribution !== undefined) fireEvent.change(within(form).getByLabelText(/Attribution/), { target: { value: attribution } })
  if (license !== undefined) fireEvent.change(within(form).getByLabelText(/Licence/), { target: { value: license } })
  if (sourceUrl !== undefined) fireEvent.change(within(form).getByLabelText(/Source URL/), { target: { value: sourceUrl } })
}

afterEach(() => vi.restoreAllMocks())

describe('ImageForm', () => {
  test('alt help text; nothing is submitted until file, alt and source URL are valid', () => {
    const onSubmit = vi.fn()
    render(<ImageForm side="front" onSubmit={onSubmit} />)
    const form = screen.getByRole('form', { name: 'Front image form' })
    expect(within(form).getByLabelText('Alt text')).toHaveAccessibleDescription('Describe the image without naming the diagnosis')

    fireEvent.click(within(form).getByRole('button', { name: 'Upload front image' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Choose an image file.')
    expect(within(form).getByRole('alert')).toHaveTextContent('Alt text is required.')

    fill(form, { alt: '   ', sourceUrl: 'ftp://x.org/a.png' })
    fireEvent.click(within(form).getByRole('button', { name: 'Upload front image' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('Alt text is required.')
    expect(within(form).getByRole('alert')).toHaveTextContent('Source URL must start with http:// or https://.')
    expect(onSubmit).not.toHaveBeenCalled()

    fill(form, { alt: ' An ECG ', attribution: ' Wikimedia ', license: 'CC BY 4.0', sourceUrl: 'https://x.org/a.png' })
    fireEvent.click(within(form).getByRole('button', { name: 'Upload front image' }))
    expect(onSubmit).toHaveBeenCalledWith({
      file: expect.any(File),
      alt: 'An ECG',
      attribution: 'Wikimedia',
      license: 'CC BY 4.0',
      sourceUrl: 'https://x.org/a.png',
    })
  })

  test('a file over the size limit is refused before upload, in the textbook upload wording', () => {
    const onSubmit = vi.fn()
    render(<ImageForm side="back" onSubmit={onSubmit} />)
    const form = screen.getByRole('form', { name: 'Back image form' })
    fill(form, { file: pngFile('huge.png', 9 * 1024 * 1024) })
    fireEvent.click(within(form).getByRole('button', { name: 'Upload back image' }))
    expect(within(form).getByRole('alert')).toHaveTextContent('huge.png is larger than 8 MB. Resize or compress it and try again.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  test('validateImageForm length and type rules', () => {
    const file = pngFile()
    expect(validateImageForm({ file, alt: 'ok' })).toEqual([])
    expect(validateImageForm({ file, alt: 'a'.repeat(301) })).toEqual(['Alt text must be at most 300 characters.'])
    expect(validateImageForm({ file, alt: 'ok', attribution: 'a'.repeat(301), license: 'l'.repeat(101) })).toEqual([
      'Attribution must be at most 300 characters.',
      'Licence must be at most 100 characters.',
    ])
    expect(validateImageForm({ file: new File(['x'], 'a.gif', { type: 'image/gif' }), alt: 'ok' })).toEqual(['a.gif is not a PNG, JPEG or WebP image.'])
  })
})

describe('CardImagesControl', () => {
  test('uploading a back image sends side and credit fields, then shows it with its attribution', async () => {
    const m = mockFetch(() => [
      201,
      {
        cardId: 'c1',
        side: 'back',
        asset: { id: 'm2', url: 'https://cdn.example/b.png', alt: 'Labelled X-ray', width: 1, height: 1, attribution: 'Radiopaedia', license: 'CC BY-NC-SA', sourceUrl: 'https://radiopaedia.org/x' },
        contentVersion: 5,
        qaStatus: 'media_pending',
      },
    ])
    const onChange = vi.fn()
    const card = mediaCard()
    const { rerender } = render(<CardImagesControl card={card} onChange={onChange} />)
    const back = screen.getByRole('region', { name: 'Back image gout:xray' })
    fireEvent.click(within(back).getByRole('button', { name: 'Add back image' }))
    fill(within(back).getByRole('form'), { alt: 'Labelled X-ray', attribution: 'Radiopaedia', license: 'CC BY-NC-SA', sourceUrl: 'https://radiopaedia.org/x' })
    fireEvent.click(within(back).getByRole('button', { name: 'Upload back image' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))

    const form = m.calls[0].init.body
    expect(m.calls[0].method).toBe('POST')
    expect(m.calls[0].url.pathname).toBe(MEDIA_PATH)
    expect(form.get('side')).toBe('back')
    expect(form.get('expectedVersion')).toBe('4')
    expect(form.get('alt')).toBe('Labelled X-ray')
    expect(form.get('attribution')).toBe('Radiopaedia')
    expect(form.get('license')).toBe('CC BY-NC-SA')
    expect(form.get('sourceUrl')).toBe('https://radiopaedia.org/x')

    const next = onChange.mock.calls[0][0]
    expect(next.contentVersion).toBe(5)
    expect(next.media).toEqual({
      front: null,
      back: { id: 'm2', url: 'https://cdn.example/b.png', alt: 'Labelled X-ray', attribution: 'Radiopaedia', license: 'CC BY-NC-SA', sourceUrl: 'https://radiopaedia.org/x' },
    })
    rerender(<CardImagesControl card={next} onChange={onChange} />)
    const slot = screen.getByRole('region', { name: 'Back image gout:xray' })
    expect(within(slot).getByRole('img')).toHaveAttribute('alt', 'Labelled X-ray')
    expect(slot).toHaveTextContent('Radiopaedia · CC BY-NC-SA · Source')
    expect(within(slot).getByRole('link', { name: 'Source' })).toHaveAttribute('href', 'https://radiopaedia.org/x')
  })

  test('removing the front image of a required-image card warns, then DELETEs that side', async () => {
    const m = mockFetch(() => [200, { cardId: 'c1', contentVersion: 6, qaStatus: 'media_pending' }])
    const onChange = vi.fn()
    render(<CardImagesControl card={mediaCard({ qaStatus: 'validated', media: { front: image(), back: null } })} onChange={onChange} />)
    const front = screen.getByRole('region', { name: 'Front image gout:xray' })
    fireEvent.click(within(front).getByRole('button', { name: 'Remove front image' }))
    expect(within(front).getByRole('group', { name: 'Confirm front image removal' })).toHaveTextContent(/goes back to Needs attention/)
    fireEvent.click(within(front).getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(m.calls[0].method).toBe('DELETE')
    expect(m.calls[0].url.pathname).toBe(MEDIA_PATH)
    expect(m.calls[0].url.searchParams.get('side')).toBe('front')
    expect(m.calls[0].body).toEqual({ expectedVersion: 4 })
    expect(onChange.mock.calls[0][0]).toMatchObject({ media: null, contentVersion: 6, qaStatus: 'media_pending' })
  })

  test('removing the front image of a live media card makes the card not live', async () => {
    mockFetch(() => [200, { cardId: 'c1', contentVersion: 6, qaStatus: 'media_pending' }])
    const onChange = vi.fn()
    const card = mediaCard({ qaStatus: 'validated', isLive: true, isPublished: true, media: { front: image(), back: null } })
    render(<CardImagesControl card={card} onChange={onChange} />)
    const front = screen.getByRole('region', { name: 'Front image gout:xray' })
    fireEvent.click(within(front).getByRole('button', { name: 'Remove front image' }))
    fireEvent.click(within(front).getByRole('button', { name: 'Confirm remove' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledTimes(1))
    expect(onChange.mock.calls[0][0]).toMatchObject({ qaStatus: 'media_pending', isLive: false, isPublished: false })
  })

  test('a 409 STALE_VERSION goes to onStale; other errors show with their code', async () => {
    mockFetch(() => [409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 9 } }])
    const onStale = vi.fn()
    render(<CardImagesControl card={mediaCard()} onStale={onStale} />)
    const front = screen.getByRole('region', { name: 'Front image gout:xray' })
    fireEvent.click(within(front).getByRole('button', { name: 'Add front image' }))
    fill(within(front).getByRole('form'))
    fireEvent.click(within(front).getByRole('button', { name: 'Upload front image' }))
    await waitFor(() => expect(onStale).toHaveBeenCalledTimes(1))
    expect(onStale.mock.calls[0][0]).toMatchObject({ kind: 'stale', details: { currentVersion: 9 } })

    mockFetch(() => [400, { error: 'The file is not a valid image', code: 'IMAGE_INVALID' }])
    fireEvent.click(within(front).getByRole('button', { name: 'Upload front image' }))
    expect(await within(front).findByRole('alert')).toHaveTextContent('The file is not a valid image (IMAGE_INVALID)')
  })
})
