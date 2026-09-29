import React, { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import QuestionAssetCarousel from '../../src/dashboard/practice/QuestionAssetCarousel'
import QuestionPreview from '../../src/dashboard/admin/questions/QuestionPreview'
import QuestionImageGallery from '../../src/dashboard/admin/questions/QuestionImageGallery'
import { authenticatedFetch } from '../../src/auth/token'
import {
  AdminQuestionApiError,
  removeQuestionImage,
  updateQuestionImages,
  uploadQuestionImage,
} from '../../src/dashboard/admin/questions/questionAdminApi'
import { moveImage, toEditableImages, toImageUpdates } from '../../src/dashboard/admin/questions/questionImageModel'

vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, uploadQuestionImage: vi.fn(), updateQuestionImages: vi.fn(), removeQuestionImage: vi.fn() }
})

const asset = (id, position, extra = {}) => ({
  id,
  asset_type: 'image',
  asset_url: `https://cdn.example/${id}.png`,
  alt: `Alt ${id}`,
  caption: null,
  credit: null,
  position,
  ...extra,
})
const learner = (id) => ({ id, type: 'image', url: `https://cdn.example/${id}.png`, alt: `Alt ${id}`, caption: `Caption ${id}` })
const png = (name) => new File(['x'], name, { type: 'image/png' })

beforeEach(() => {
  globalThis.URL.createObjectURL = vi.fn((file) => `blob:${file.name}`)
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('QuestionAssetCarousel', () => {
  test('a single image has no carousel controls', () => {
    render(<QuestionAssetCarousel assets={[learner('a')]} />)
    expect(screen.getByRole('img', { name: 'Alt a' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next image' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Choose image' })).toBeNull()
  })

  test('several images keep their order and are keyboard-operable', () => {
    render(<QuestionAssetCarousel assets={[learner('a'), learner('b'), learner('c')]} />)
    expect(screen.getByRole('img', { name: 'Alt a' })).toBeInTheDocument()
    expect(screen.getByText('Image 1 of 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    expect(screen.getByRole('img', { name: 'Alt b' })).toBeInTheDocument()
    expect(screen.getByText('Caption b')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show image 3 of 3' }))
    expect(screen.getByRole('img', { name: 'Alt c' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next image' }))
    expect(screen.getByRole('img', { name: 'Alt a' })).toBeInTheDocument()
  })

  test('renders nothing without images', () => {
    const { container } = render(<QuestionAssetCarousel assets={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('QuestionPreview images', () => {
  test('shows images between the stem and the options, as learners see them', () => {
    const { container } = render(
      <QuestionPreview question={{ stem: 'Stem', options: ['A', 'B'], correct_answer: 0 }} images={[learner('a'), learner('b')]} />,
    )
    const content = container.querySelector('.question-content')
    const order = [...content.children].map((el) => el.className.split(' ')[0])
    expect(order.indexOf('question-stem-wrapper')).toBeLessThan(order.indexOf('q-carousel'))
    expect(screen.getByRole('button', { name: 'Next image' })).toBeInTheDocument()
  })
})

describe('authenticatedFetch with FormData', () => {
  test('lets the browser set the multipart content type', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    await authenticatedFetch('https://api.example/x', { method: 'POST', body: new FormData() })
    expect(fetchSpy.mock.calls[0][1].headers).not.toHaveProperty('Content-Type')
    await authenticatedFetch('https://api.example/x', { method: 'POST', body: '{}' })
    expect(fetchSpy.mock.calls[1][1].headers['Content-Type']).toBe('application/json')
  })
})

describe('image model', () => {
  test('reordering produces contiguous positions and trimmed metadata', () => {
    const images = toEditableImages([asset('b', 2), asset('a', 1, { alt: '  ' })])
    expect(toImageUpdates(moveImage(images, 'b', -1))).toEqual([
      { id: 'b', position: 1, alt: 'Alt b', caption: null, credit: null },
      { id: 'a', position: 2, alt: null, caption: null, credit: null },
    ])
  })
})

function SavedGallery({ images: initial, version: initialVersion = 3 }) {
  const [state, setState] = useState({ images: initial, version: initialVersion })
  return (
    <>
      <QuestionImageGallery
        questionId="q1"
        version={state.version}
        savedImages={state.images}
        onSaved={({ images, version }) => setState({ images, version })}
      />
      <output data-testid="version">{state.version}</output>
    </>
  )
}

describe('QuestionImageGallery (saved question)', () => {
  test('keeps successful uploads when a later file fails, using each new version', async () => {
    vi.mocked(uploadQuestionImage)
      .mockResolvedValueOnce({ asset: asset('n1', 1), question_version: 4 })
      .mockRejectedValueOnce(new AdminQuestionApiError({ status: 400, kind: 'validation', message: 'The file contains extra data after the image.' }))
      .mockResolvedValueOnce({ asset: asset('n3', 2), question_version: 5 })
    render(<SavedGallery images={[]} />)

    fireEvent.change(screen.getAllByLabelText('Add images', { selector: 'input' })[0], {
      target: { files: [png('one.png'), png('two.png'), png('three.png')] },
    })

    await waitFor(() => expect(screen.getByTestId('version')).toHaveTextContent('5'))
    expect(vi.mocked(uploadQuestionImage).mock.calls.map(([, args]) => args.expectedVersion)).toEqual([3, 4, 4])
    await waitFor(() => {
      expect(screen.getByText(/two.png/).closest('li')).toHaveTextContent('failed – The file contains extra data')
      expect(document.querySelectorAll('.aqg-item__thumb')).toHaveLength(2)
    })
  })

  test('rejects unsupported files before uploading', async () => {
    render(<SavedGallery images={[]} />)
    fireEvent.change(screen.getAllByLabelText('Add images', { selector: 'input' })[0], {
      target: { files: [new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' })] },
    })
    expect(await screen.findByText(/Only PNG, JPEG and WebP/)).toBeInTheDocument()
    expect(uploadQuestionImage).not.toHaveBeenCalled()
  })

  test('saves reordering and metadata in one versioned request, and flags missing alt text', async () => {
    vi.mocked(updateQuestionImages).mockImplementation(async (_id, _v, updates) => ({
      images: updates.map((u) => asset(u.id, u.position, { alt: u.alt })),
      question_version: 4,
    }))
    render(<SavedGallery images={[asset('a', 1), asset('b', 2, { alt: null })]} />)
    expect(screen.getByText('1 image needs alt text before this question can be activated.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Move image 2 up' }))
    fireEvent.change(screen.getAllByLabelText(/Alt text/)[0], { target: { value: 'Chest X-ray' } })
    expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Save image details and order' }))

    await waitFor(() => expect(screen.getByTestId('version')).toHaveTextContent('4'))
    expect(updateQuestionImages).toHaveBeenCalledWith('q1', 3, [
      { id: 'b', position: 1, alt: 'Chest X-ray', caption: null, credit: null },
      { id: 'a', position: 2, alt: 'Alt a', caption: null, credit: null },
    ])
    expect(screen.queryByText(/needs alt text/)).toBeNull()
  })

  test('removes an image after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(removeQuestionImage).mockResolvedValue({ images: [asset('b', 1)], question_version: 4 })
    render(<SavedGallery images={[asset('a', 1), asset('b', 2)]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Remove image 1' }))
    await waitFor(() => expect(screen.getByTestId('version')).toHaveTextContent('4'))
    expect(removeQuestionImage).toHaveBeenCalledWith('q1', 'a', 3)
    await waitFor(() => expect(document.querySelectorAll('.aqg-item')).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeInTheDocument()
  })

  test('stages images for a live question until each has alt text, then uploads them', async () => {
    vi.mocked(uploadQuestionImage).mockResolvedValue({ asset: asset('n1', 2), question_version: 4 })
    function LiveGallery() {
      const [state, setState] = useState({ images: [asset('a', 1)], version: 3 })
      return (
        <QuestionImageGallery questionId="q1" version={state.version} savedImages={state.images} isActive onSaved={setState} />
      )
    }
    render(<LiveGallery />)
    fireEvent.change(screen.getAllByLabelText('Add images', { selector: 'input' })[0], { target: { files: [png('live.png')] } })
    const upload = screen.getByRole('button', { name: 'Upload 1 image' })
    expect(upload).toBeDisabled()
    expect(uploadQuestionImage).not.toHaveBeenCalled()

    const altInputs = screen.getAllByLabelText(/Alt text/)
    fireEvent.change(altInputs[altInputs.length - 1], { target: { value: 'Live ECG' } })
    fireEvent.click(screen.getByRole('button', { name: 'Upload 1 image' }))
    await waitFor(() => expect(uploadQuestionImage).toHaveBeenCalledWith('q1', expect.objectContaining({ alt: 'Live ECG', expectedVersion: 3 })))
    await waitFor(() => expect(screen.queryByRole('button', { name: /Upload 1 image/ })).toBeNull())
  })

  test('is read-only while saving', () => {
    render(<QuestionImageGallery questionId="q1" version={3} savedImages={[asset('a', 1)]} readOnly />)
    expect(screen.getByRole('button', { name: /Add images/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Remove image 1' })).toBeDisabled()
    expect(screen.getByLabelText(/Alt text/)).toBeDisabled()
  })
})

describe('QuestionImageGallery (new question)', () => {
  test('keeps chosen files locally with previews until the first save', () => {
    function NewGallery() {
      const [pending, setPending] = useState([])
      return <QuestionImageGallery questionId={null} pending={pending} onPendingChange={setPending} />
    }
    render(<NewGallery />)
    fireEvent.change(screen.getAllByLabelText('Add images', { selector: 'input' })[0], { target: { files: [png('ecg.png')] } })
    const item = screen.getByText('New image 1').closest('li')
    expect(item.querySelector('.aqg-item__thumb')).toHaveAttribute('src', 'blob:ecg.png')
    expect(screen.getByText(/Uploads when the question is first saved/)).toBeInTheDocument()
    expect(uploadQuestionImage).not.toHaveBeenCalled()
  })
})
