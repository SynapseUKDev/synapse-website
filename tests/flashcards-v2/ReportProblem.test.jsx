import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import StudySession from '../../src/dashboard/flashcards-v2/StudySession'
import { REPORT_CATEGORIES } from '../../src/dashboard/flashcards-v2/reportCategories'
import { card, mockFetch } from './fetchMock'

const REPORTS = '/flashcards/v2/cards/a/reports'
const CONFIRMATION = /Thanks — your report was sent/

function renderSession(cards = [card('a', { contentVersion: 3 }), card('b')], props = {}) {
  return render(<StudySession cards={cards} onExit={() => {}} {...props} />)
}

async function openReport() {
  fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
  await screen.findByText('answer a')
  fireEvent.click(screen.getByRole('button', { name: 'Report a problem' }))
  return screen.findByRole('dialog', { name: 'Report a problem with this card' })
}

afterEach(() => vi.restoreAllMocks())

describe('Report a problem (learner)', () => {
  test('is offered only on the revealed card, as a keyboard-reachable button', async () => {
    mockFetch(() => [201, { reportId: 'r1', status: 'open' }])
    renderSession()
    expect(screen.queryByRole('button', { name: 'Report a problem' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
    const button = await screen.findByRole('button', { name: 'Report a problem' })
    expect(button.tagName).toBe('BUTTON')
    button.focus()
    expect(button).toHaveFocus()
  })

  test('not offered on an unpublished draft in admin preview', async () => {
    mockFetch(() => [201, { reportId: 'r1', status: 'open' }])
    renderSession([card('a', { isPublished: false, qaStatus: 'draft' })], { preview: true, showAdminBadge: true })
    fireEvent.click(screen.getByRole('button', { name: /Show answer/ }))
    await screen.findByText('answer a')
    expect(screen.queryByRole('button', { name: 'Report a problem' })).toBeNull()
  })

  test('the modal lists the seven categories in plain English', async () => {
    mockFetch(() => [201, { reportId: 'r1', status: 'open' }])
    renderSession()
    const dialog = await openReport()
    const select = within(dialog).getByLabelText('What is wrong?')
    const values = [...select.querySelectorAll('option')].map((o) => o.value).filter(Boolean)
    expect(values).toEqual([
      'clinical_error',
      'outdated_guidance',
      'ambiguity',
      'formatting',
      'duplicate',
      'image',
      'other',
    ])
    expect(REPORT_CATEGORIES.map((c) => c.label)).toEqual([
      'Clinically incorrect',
      'Outdated guidance',
      'Unclear or ambiguous',
      'Formatting problem',
      'Duplicate card',
      'Problem with the image',
      'Something else',
    ])
    // Submit stays disabled until a category is chosen.
    expect(within(dialog).getByRole('button', { name: 'Send report' })).toBeDisabled()
  })

  test('submit sends category, details and the shown contentVersion, then confirms', async () => {
    const m = mockFetch(() => [201, { reportId: 'r1', status: 'reassessing' }])
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'clinical_error' } })
    fireEvent.change(within(dialog).getByLabelText(/Details/), { target: { value: '  Calcium comes first  ' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(m.callsTo(REPORTS)).toHaveLength(1))
    const sent = m.callsTo(REPORTS)[0]
    expect(sent.method).toBe('POST')
    expect(sent.body).toEqual({ category: 'clinical_error', details: 'Calcium comes first', contentVersion: 3 })
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    // The learner stays on the revealed card and can still rate it.
    expect(screen.getByText('answer a')).toBeInTheDocument()
  })

  test('empty details are not sent', async () => {
    const m = mockFetch(() => [201, { reportId: 'r1', status: 'open' }])
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'formatting' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(m.callsTo(REPORTS)).toHaveLength(1))
    expect(m.callsTo(REPORTS)[0].body).toEqual({ category: 'formatting', contentVersion: 3 })
  })

  test('a duplicate (200) shows the same confirmation', async () => {
    mockFetch(() => [200, { reportId: 'r1', status: 'open' }])
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'ambiguity' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
  })

  test('409 STALE_VERSION: explains, and the refreshed card (new version, unrevealed) is shown', async () => {
    const m = mockFetch((url) => {
      if (url.pathname === REPORTS) return [409, { error: 'stale', code: 'STALE_VERSION', details: { currentVersion: 4 } }]
      if (url.pathname === '/flashcards/v2/cards') {
        return [200, { cards: [card('a', { contentVersion: 4, question: 'Updated question a?', answerMarkdown: '- new answer a' })], nextCursor: null }]
      }
      return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
    })
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'clinical_error' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    expect(await screen.findByText('This card was just updated — thanks, the new version is now shown.')).toBeInTheDocument()
    expect(await screen.findByText('Updated question a?')).toBeInTheDocument()
    expect(screen.queryByText('- new answer a')).toBeNull()
    expect(screen.queryByText('new answer a')).toBeNull() // the new version starts unrevealed
    expect(m.callsTo('/flashcards/v2/cards')[0].url.searchParams.get('topic_id')).toBe('t1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  test('fix 5: 409 with a failed refetch shows an error with Retry, and the "now shown" notice only after it succeeds', async () => {
    let cardsCalls = 0
    const m = mockFetch((url) => {
      if (url.pathname === REPORTS) return [409, { error: 'stale', code: 'STALE_VERSION', details: { currentVersion: 4 } }]
      if (url.pathname === '/flashcards/v2/cards') {
        cardsCalls += 1
        if (cardsCalls === 1) return [500, { error: 'boom', code: 'INTERNAL' }]
        return [200, { cards: [card('a', { contentVersion: 4, question: 'Updated question a?' })], nextCursor: null }]
      }
      return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'clinical_error' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('the new version could not be loaded')
    expect(screen.queryByText(/the new version is now shown/)).toBeNull()
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry' }))
    expect(await screen.findByText('This card was just updated — thanks, the new version is now shown.')).toBeInTheDocument()
    expect(await screen.findByText('Updated question a?')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(m.callsTo('/flashcards/v2/cards')).toHaveLength(2)
  })

  test('404: the card is no longer available and leaves the session', async () => {
    mockFetch(() => [404, { error: 'Card not found', code: 'NOT_FOUND' }])
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'other' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    expect(await screen.findByText(/no longer available/)).toBeInTheDocument()
    expect(await screen.findByText('Question b?')).toBeInTheDocument()
  })

  test('other errors stay in the modal with the message, and can be retried', async () => {
    let n = 0
    const m = mockFetch(() => (++n === 1 ? [429, { error: 'Too many reports', code: 'RATE_LIMITED' }] : [201, { reportId: 'r1', status: 'open' }]))
    renderSession()
    const dialog = await openReport()
    fireEvent.change(within(dialog).getByLabelText('What is wrong?'), { target: { value: 'other' } })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Too many reports')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send report' }))
    expect(await screen.findByText(CONFIRMATION)).toBeInTheDocument()
    expect(m.callsTo(REPORTS)).toHaveLength(2)
  })

  test('study shortcuts are off while the modal is open; Escape closes it and returns focus', async () => {
    const m = mockFetch(() => [201, { reportId: 'r1', status: 'open' }])
    renderSession()
    const dialog = await openReport()
    fireEvent.keyDown(document.body, { key: '2' })
    fireEvent.keyDown(within(dialog).getByLabelText('What is wrong?'), { key: '3' })
    expect(m.callsTo('/flashcards/v2/srs/record')).toHaveLength(0)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: 'Report a problem' })).toHaveFocus()
    fireEvent.keyDown(document.body, { key: '2' })
    await waitFor(() => expect(m.callsTo('/flashcards/v2/srs/record')).toHaveLength(1))
  })
})
