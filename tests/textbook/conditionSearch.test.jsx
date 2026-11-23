import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
const fetchMock = vi.fn()
vi.mock('../../src/auth/token', () => ({ authenticatedFetch: (...a) => fetchMock(...a) }))
vi.mock('../../src/components/loading/LoadingScreen.jsx', () => ({ default: ({ message }) => <p>{message}</p> }))

import ConditionSearch from '../../src/dashboard/textbook/ConditionSearch.jsx'
import ConditionAZ from '../../src/dashboard/textbook/ConditionAZ.jsx'
import { letterOf, matchConditions, resetConditionsCache } from '../../src/dashboard/textbook/textbookConditions.js'

const C = (name, slug, specialty = 'Cardiology', parent = null) => ({
  name, slug, specialty_name: specialty, specialty_slug: specialty.toLowerCase(), parent_name: parent,
})
const CONDITIONS = [
  C('Acute coronary syndrome', 'acs'),
  C('Asthma', 'asthma', 'Respiratory'),
  C('Atrial fibrillation', 'af', 'Cardiology', 'Arrhythmias'),
  C('Heart failure', 'heart-failure'),
  C('Sjögren syndrome', 'sjogren', 'Rheumatology'),
  C('Status asthmaticus', 'status-asthmaticus', 'Respiratory'),
  C('22q11 deletion', '22q11', 'Genetics'),
]

beforeEach(() => {
  navigate.mockReset()
  fetchMock.mockReset()
  resetConditionsCache()
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ conditions: CONDITIONS }) })
})

describe('matchConditions', () => {
  const names = (q) => matchConditions(CONDITIONS, q).map((c) => c.slug)

  test('name prefix first, then word prefix, then contains', () => {
    expect(names('asth')).toEqual(['asthma', 'status-asthmaticus'])
    expect(names('fib')).toEqual(['af'])
    expect(names('zzz')).toEqual([])
    expect(names('thma')).toEqual(['asthma', 'status-asthmaticus'])
  })

  test('multi-word queries match word starts in any order, ignoring case and accents', () => {
    expect(names('fib atrial')).toEqual(['af'])
    expect(names('SJOGREN')).toEqual(['sjogren'])
  })

  test('parent topic matches come last', () => {
    expect(names('arrhythm')).toEqual(['af'])
  })

  test('limit and empty query', () => {
    expect(matchConditions(CONDITIONS, 'a', 2)).toHaveLength(2)
    expect(names('   ')).toEqual([])
  })

  test('letterOf groups non-letters under #', () => {
    expect(letterOf('Sjögren')).toBe('S')
    expect(letterOf('22q11 deletion')).toBe('#')
  })
})

describe('ConditionSearch', () => {
  const type = async (value) => {
    render(<ConditionSearch API_BASE="http://api.test" specialtyId="spec-1" />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const input = screen.getByRole('combobox')
    fireEvent.focus(input)
    fireEvent.change(input, { target: { value } })
    return input
  }

  test('lists matching conditions then a full-text option', async () => {
    await type('asth')
    const list = await screen.findByRole('listbox')
    const options = within(list).getAllByRole('option')
    expect(options.map((o) => o.textContent.trim())).toEqual([
      'AsthmaRespiratory',
      'Status asthmaticusRespiratory',
      'Search all textbook content for “asth”',
    ])
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
  })

  test('Enter opens the highlighted condition', async () => {
    const input = await type('heart')
    await screen.findByRole('listbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/dashboard/textbook/topic/heart-failure')
    expect(input).toHaveValue('')
  })

  test('arrow keys reach the full-text option, scoped to the specialty', async () => {
    const input = await type('heart')
    await screen.findByRole('listbox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/dashboard/textbook/search?q=heart&specialty_id=spec-1')
  })

  test('no condition match still offers full-text search', async () => {
    const input = await type('chest pain')
    expect(await screen.findByText('No condition names match.')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(navigate).toHaveBeenCalledWith('/dashboard/textbook/search?q=chest+pain&specialty_id=spec-1')
  })

  test('clicking an option navigates; Escape clears', async () => {
    const input = await type('fib')
    fireEvent.click(await screen.findByRole('option', { name: /Atrial fibrillation/ }))
    expect(navigate).toHaveBeenCalledWith('/dashboard/textbook/topic/af')
    fireEvent.change(input, { target: { value: 'asth' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input).toHaveValue('')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('ConditionAZ', () => {
  test('groups conditions by letter and disables empty letters', async () => {
    render(<ConditionAZ API_BASE="http://api.test" />)
    expect(await screen.findByText('7 conditions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jump to A' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Jump to B' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Jump to other' })).toBeEnabled()
    expect(screen.getAllByRole('heading').map((h) => h.textContent)).toEqual(['A', 'H', 'S', '#'])
    fireEvent.click(screen.getByRole('button', { name: /Heart failure/ }))
    expect(navigate).toHaveBeenCalledWith('/dashboard/textbook/topic/heart-failure')
  })

  test('shows an error if the list cannot load', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) })
    render(<ConditionAZ API_BASE="http://api.test" />)
    expect(await screen.findByText(/Failed to load conditions/)).toBeInTheDocument()
  })
})
