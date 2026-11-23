import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const fetchMock = vi.fn()
vi.mock('../../src/auth/token', () => ({ authenticatedFetch: (...args) => fetchMock(...args) }))

import ReportOsceIssueButton from '../../src/dashboard/osce/ReportOsceIssueButton.jsx'

const SECTIONS = [
  { value: 'general', label: 'Whole station / general' },
  { value: 'section:abc', label: 'Patient Script' },
  { value: 'mark_scheme', label: 'Mark Scheme' },
]

const renderButton = () =>
  render(<ReportOsceIssueButton stationId="st-1" sectionOptions={SECTIONS} API_BASE="http://api.test" />)

beforeEach(() => fetchMock.mockReset())

describe('ReportOsceIssueButton', () => {
  test('lists the given sections and requires section, type and details', () => {
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }))
    const section = screen.getByLabelText(/Which section/)
    expect([...section.options].map((o) => o.textContent)).toEqual([
      'Select section', 'Whole station / general', 'Patient Script', 'Mark Scheme',
    ])
    const submit = screen.getByRole('button', { name: 'Submit Report' })
    expect(submit).toBeDisabled()
    fireEvent.change(section, { target: { value: 'section:abc' } })
    fireEvent.change(screen.getByLabelText(/Type of issue/), { target: { value: 'typo' } })
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/Describe the issue/), { target: { value: '  Spelling  ' } })
    expect(submit).toBeEnabled()
  })

  test('posts the report and closes with a thank-you', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ id: 'i-1' }) })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }))
    fireEvent.change(screen.getByLabelText(/Which section/), { target: { value: 'mark_scheme' } })
    fireEvent.change(screen.getByLabelText(/Type of issue/), { target: { value: 'factual_error' } })
    fireEvent.change(screen.getByLabelText(/Describe the issue/), { target: { value: ' Wrong marks ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }))

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Thanks'))
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('http://api.test/osce/stations/st-1/report')
    expect(opts.method).toBe('POST')
    expect(JSON.parse(opts.body)).toEqual({ section_key: 'mark_scheme', category: 'factual_error', details: 'Wrong marks' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('shows the server error and keeps the form open', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: 'Section not found on this station' }) })
    renderButton()
    fireEvent.click(screen.getByRole('button', { name: 'Report an issue' }))
    fireEvent.change(screen.getByLabelText(/Which section/), { target: { value: 'general' } })
    fireEvent.change(screen.getByLabelText(/Type of issue/), { target: { value: 'other' } })
    fireEvent.change(screen.getByLabelText(/Describe the issue/), { target: { value: 'x' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Section not found on this station')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
