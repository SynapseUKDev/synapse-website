import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import AdminFlashcardsV2 from '../../src/dashboard/admin/flashcards-v2/AdminFlashcardsV2'
import { FINDING_LABELS, findingLabel } from '../../src/dashboard/admin/flashcards-v2/findingLabels'
import { mockFetch } from './fetchMock'
import { CARDS_PATH, COUNTS, COUNTS_PATH, SPECIALTY, TOPIC, TOPICS_PATH, adminCard, image, topicRow } from './adminFixtures'

const OTHER_SPECIALTY = '33333333-4444-4555-8666-777777777777'
const TOPICS = {
  topics: [
    topicRow(TOPIC, 'Gout'),
    topicRow('44444444-5555-4666-8777-888888888888', 'Asthma', { specialtyId: OTHER_SPECIALTY, specialtyName: 'Respiratory' }),
  ],
}

const flagged = adminCard('c1', 'gout:flare', {
  findings: [
    { semanticKey: 'gout:flare', code: 'clinical_textbook_conflict', message: 'Textbook says colchicine first line.', severity: 'error' },
    { semanticKey: 'gout:flare', code: 'some_new_code', message: 'Something else.', severity: 'warning' },
    { semanticKey: 'gout:flare', code: 'review_revise', message: 'Final reviewer verdict.', severity: 'review' },
  ],
})
const imageCard = adminCard('c2', 'gout:xray', {
  qaStatus: 'media_pending',
  cardType: 'media',
  isMediaRequired: true,
  mediaRequirement: 'AP foot X-ray showing erosions',
  contentVersion: 4,
})

/** A stateful queue API: `state.cards` is what GET /cards returns; routes override by "METHOD path". */
function api({ cards = [flagged, imageCard], routes = {}, counts = COUNTS } = {}) {
  const state = { cards: [...cards], counts: { ...counts } }
  const m = mockFetch((url, init, call) => {
    const key = `${call.method} ${url.pathname}`
    if (routes[key]) return routes[key](url, call, state)
    if (key === `GET ${COUNTS_PATH}`) return [200, state.counts]
    if (key === `GET ${CARDS_PATH}`) return [200, { cards: state.cards, nextCursor: null }]
    if (key === `GET ${TOPICS_PATH}`) return [200, TOPICS]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
  return { ...m, state }
}

const listCalls = (m) => m.callsTo(CARDS_PATH).filter((c) => c.url.searchParams.get('state') === 'needs_action')
const itemOf = (key) => screen.getByRole('article', { name: `Card ${key}` })

afterEach(() => vi.restoreAllMocks())

describe('finding labels', () => {
  test('codes map to plain labels; an unknown code is shown as itself', () => {
    expect(findingLabel('clinical_textbook_conflict')).toBe('Conflicts with the textbook')
    expect(findingLabel('clinical_guideline_contradicted')).toBe('Contradicts current UK guidance')
    expect(findingLabel('clinical_guideline_unresolved')).toBe('Guideline check unresolved')
    expect(findingLabel('clinical_guideline_unresolved_conflict')).toBe('Guideline conflict unresolved')
    expect(findingLabel('needs_human_verification')).toBe('Needs a human check')
    expect(findingLabel('subtopic_needs_attention')).toBe('Failed its subtopic review')
    expect(findingLabel('unresolved_parent_review')).toBe('Failed its subtopic review')
    expect(findingLabel('brand_new_code')).toBe('brand_new_code')
    expect(Object.keys(FINDING_LABELS)).toHaveLength(7)
  })
})

describe('needs-attention queue', () => {
  test('tab shows the count; each card shows topic, key, chip, front, back and WHY in plain words', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    expect(await screen.findByRole('tab', { name: 'Needs attention (3)' })).toHaveAttribute('aria-selected', 'true')
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    expect(within(item).getByText('Gout')).toBeInTheDocument()
    expect(within(item).getByText('Flagged')).toBeInTheDocument()
    expect(within(item).getByRole('region', { name: 'Front' })).toHaveTextContent('Question gout:flare?')
    expect(within(item).getByRole('region', { name: 'Back' })).toHaveTextContent('answer gout:flare')
    const why = within(item).getByRole('region', { name: 'Why' })
    expect(why).toHaveTextContent('Conflicts with the textbook Textbook says colchicine first line.')
    expect(why).toHaveTextContent('some_new_code Something else.')
    expect(why).not.toHaveTextContent('Final reviewer verdict.')

    const media = itemOf('gout:xray')
    expect(within(media).getByText('Needs image')).toBeInTheDocument()
    expect(within(media).getByRole('region', { name: 'Why' })).toHaveTextContent('Image needed: AP foot X-ray showing erosions')

    expect(listCalls(m)).toHaveLength(1)
    expect(Object.fromEntries(listCalls(m)[0].url.searchParams)).toEqual({ state: 'needs_action', limit: '50' })
  })

  test('a finding message over 300 characters starts collapsed and expands in full', async () => {
    const long = `${'x'.repeat(310)} END`
    api({ cards: [adminCard('c1', 'gout:long', { findings: [{ semanticKey: 'gout:long', code: 'needs_human_verification', message: long, severity: 'warning' }] })] })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:long' })
    const why = within(item).getByRole('region', { name: 'Why' })
    expect(why).not.toHaveTextContent('END')
    fireEvent.click(within(why).getByRole('button', { name: 'Show more' }))
    expect(why).toHaveTextContent('END')
    expect(within(why).getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true')
  })

  test('filters build the query: kind, specialty (from the admin topic list), debounced topic search', async () => {
    const m = api()
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('article', { name: 'Card gout:flare' })

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: 'needs_image' } })
    await waitFor(() => expect(listCalls(m).at(-1).url.searchParams.get('kind')).toBe('needs_image'))

    const specialty = screen.getByLabelText('Specialty')
    await waitFor(() => expect(within(specialty).getByRole('option', { name: 'Respiratory' })).toBeInTheDocument())
    expect(within(specialty).getAllByRole('option').map((o) => o.textContent)).toEqual(['All specialties', 'Respiratory', 'Rheumatology'])
    fireEvent.change(specialty, { target: { value: SPECIALTY } })
    await waitFor(() => expect(listCalls(m).at(-1).url.searchParams.get('specialtyId')).toBe(SPECIALTY))

    const before = listCalls(m).length
    const search = screen.getByLabelText('Search topics')
    fireEvent.change(search, { target: { value: 'go' } })
    fireEvent.change(search, { target: { value: 'gou' } })
    fireEvent.change(search, { target: { value: 'gout' } })
    expect(listCalls(m)).toHaveLength(before) // nothing sent before the 300 ms pause
    await waitFor(() => expect(listCalls(m)).toHaveLength(before + 1))
    expect(Object.fromEntries(listCalls(m).at(-1).url.searchParams)).toEqual({
      state: 'needs_action',
      kind: 'needs_image',
      specialtyId: SPECIALTY,
      q: 'gout',
      limit: '50',
    })

    fireEvent.change(screen.getByLabelText('Kind'), { target: { value: '' } })
    await waitFor(() => expect(listCalls(m).at(-1).url.searchParams.has('kind')).toBe(false))
  })

  test('"Load more" requests the next page with nextCursor and appends it', async () => {
    const m = api({
      routes: {
        [`GET ${CARDS_PATH}`]: (url) =>
          url.searchParams.get('cursor') === 'CUR1' ? [200, { cards: [adminCard('c3', 'gout:third')], nextCursor: null }] : [200, { cards: [flagged], nextCursor: 'CUR1' }],
      },
    })
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('article', { name: 'Card gout:flare' })
    fireEvent.click(screen.getByRole('button', { name: 'Load more' }))
    expect(await screen.findByRole('article', { name: 'Card gout:third' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Card gout:flare' })).toBeInTheDocument()
    expect(listCalls(m).at(-1).url.searchParams.get('cursor')).toBe('CUR1')
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull()
  })

  test('approve sends expectedVersion, removes the item and refreshes the counts', async () => {
    const m = api({
      routes: {
        [`POST ${CARDS_PATH}/c1/approve`]: (url, call, state) => {
          state.counts = { ...state.counts, needsAction: 2, flagged: 1 }
          return [200, { ...flagged, qaStatus: 'validated', contentVersion: 2 }]
        },
      },
    })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    fireEvent.click(within(item).getByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Card gout:flare' })).toBeNull())
    expect(m.callsTo(`${CARDS_PATH}/c1/approve`)[0].body).toEqual({ expectedVersion: 1 })
    expect(await screen.findByRole('tab', { name: 'Needs attention (2)' })).toBeInTheDocument()
    expect(m.callsTo(COUNTS_PATH)).toHaveLength(2)
    expect(screen.getByText('Approved gout:flare.')).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Card gout:xray' })).toBeInTheDocument()
  })

  test('approve is disabled with a reason while a media card has no front image', async () => {
    api({ cards: [imageCard, adminCard('c4', 'gout:xray2', { ...imageCard, id: 'c4', semanticKey: 'gout:xray2', media: { front: image(), back: null } })] })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:xray' })
    const approve = within(item).getByRole('button', { name: 'Approve' })
    expect(approve).toBeDisabled()
    expect(approve).toHaveAccessibleDescription('Add a front image first')
    const withImage = itemOf('gout:xray2')
    expect(within(withImage).getByRole('button', { name: 'Approve' })).toBeEnabled()
    expect(within(withImage).queryByText('Add a front image first')).toBeNull()
  })

  test('discard asks for confirmation; cancel sends nothing, confirm retires and removes the card', async () => {
    const m = api({ routes: { [`POST ${CARDS_PATH}/c1/discard`]: () => [200, { retired: 1 }] } })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    fireEvent.click(within(item).getByRole('button', { name: 'Discard' }))
    let dialog = screen.getByRole('dialog', { name: 'Discard this card?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(m.callsTo(`${CARDS_PATH}/c1/discard`)).toHaveLength(0)

    fireEvent.click(within(item).getByRole('button', { name: 'Discard' }))
    dialog = screen.getByRole('dialog', { name: 'Discard this card?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Discard card' }))
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Card gout:flare' })).toBeNull())
    expect(m.callsTo(`${CARDS_PATH}/c1/discard`)[0].body).toEqual({ expectedVersion: 1 })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(m.callsTo(COUNTS_PATH)).toHaveLength(2)
  })

  test('a 409 STALE_VERSION refetches that card and says "This card changed — reloaded"', async () => {
    const fresh = { ...flagged, contentVersion: 3, question: 'Edited by someone else?' }
    const m = api({
      routes: {
        [`POST ${CARDS_PATH}/c1/approve`]: () => [409, { error: 'changed', code: 'STALE_VERSION', details: { currentVersion: 3 } }],
        [`GET ${CARDS_PATH}`]: (url, call, state) =>
          url.searchParams.get('state') === 'all' ? [200, { cards: [imageCard, fresh], nextCursor: null }] : [200, { cards: state.cards, nextCursor: null }],
      },
    })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    fireEvent.click(within(item).getByRole('button', { name: 'Approve' }))
    expect(await within(item).findByText('This card changed — reloaded')).toBeInTheDocument()
    expect(within(item).getByRole('region', { name: 'Front' })).toHaveTextContent('Edited by someone else?')
    const refetch = m.callsTo(CARDS_PATH).find((c) => c.url.searchParams.get('state') === 'all')
    expect(Object.fromEntries(refetch.url.searchParams)).toEqual({ state: 'all', topicId: TOPIC, limit: '200' })
  })

  test('editing saves the changed text with expectedVersion and keeps the topic name', async () => {
    const m = api({
      routes: {
        [`PATCH ${CARDS_PATH}/c1`]: (url, call) => {
          const { topicName: _t, specialtyName: _s, ...dto } = flagged
          return [200, { ...dto, question: call.body.question, contentVersion: 2 }]
        },
      },
    })
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    fireEvent.click(within(item).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(item).getByLabelText('Question'), { target: { value: 'Better question?' } })
    fireEvent.click(within(item).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(within(item).getByRole('region', { name: 'Front' })).toHaveTextContent('Better question?'))
    expect(m.callsTo(`${CARDS_PATH}/c1`)[0].body).toEqual({ expectedVersion: 1, question: 'Better question?' })
    expect(within(item).getByText('Gout')).toBeInTheDocument()
  })

  test('Approve is disabled with a reason while an edit draft is open, and returns after cancel', async () => {
    api()
    render(<AdminFlashcardsV2 />)
    const item = await screen.findByRole('article', { name: 'Card gout:flare' })
    const approve = within(item).getByRole('button', { name: 'Approve' })
    expect(approve).toBeEnabled()
    fireEvent.click(within(item).getByRole('button', { name: 'Edit' }))
    expect(within(item).getByRole('button', { name: 'Approve' })).toBeDisabled()
    expect(within(item).getByText('Save or cancel your edit first')).toBeInTheDocument()
    fireEvent.click(within(item).getByRole('button', { name: 'Cancel' }))
    expect(within(item).getByRole('button', { name: 'Approve' })).toBeEnabled()
    expect(within(item).queryByText('Save or cancel your edit first')).toBeNull()
  })

  test('an empty queue says nothing needs attention', async () => {
    api({ cards: [], counts: { ...COUNTS, needsAction: 0 } })
    render(<AdminFlashcardsV2 />)
    expect(await screen.findByText('Nothing needs attention.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Needs attention (0)' })).toBeInTheDocument()
  })

  test('a list error keeps its message and code', async () => {
    api({ routes: { [`GET ${CARDS_PATH}`]: () => [403, { error: 'Forbidden', code: 'FORBIDDEN' }] } })
    render(<AdminFlashcardsV2 />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Forbidden (FORBIDDEN)')
  })
})

describe('the old per-topic screens are gone', () => {
  test('no topic list, publish or review controls', async () => {
    api()
    render(<AdminFlashcardsV2 />)
    await screen.findByRole('article', { name: 'Card gout:flare' })
    expect(screen.queryByRole('list', { name: 'Flashcard topics' })).toBeNull()
    expect(screen.queryByRole('button', { name: /publish/i })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Run summary' })).toBeNull()
    expect(screen.queryByText(/textbook issues/i)).toBeNull()
    expect(screen.getByRole('tab', { name: 'Learner reports' })).toBeInTheDocument()
  })
})
