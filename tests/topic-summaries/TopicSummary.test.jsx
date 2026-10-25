import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import TopicSummary from '../../src/dashboard/practice/TopicSummary'

const BODY = [
  'Shockable cardiac arrest is managed with early defibrillation and timed drugs.',
  '',
  '| Step | Action |',
  '| --- | --- |',
  '| 1 | Shock 150 J |',
  '| 2 | Adrenaline 1 mg IV |',
  '',
  '- Resume CPR immediately.',
].join('\n')

function makeSummary(overrides = {}) {
  return {
    summary_id: 's-1',
    version_id: 'v-1',
    version: 3,
    title: 'Ventricular fibrillation management',
    body_markdown: BODY,
    question_category: 'management',
    subject_label: 'Cardiac arrest',
    scope_label: 'General',
    sources: [
      { kind: 'textbook', label: 'Cardiac arrest — Management', href: '/dashboard/textbook/topic/cardiac-arrest#sec-management' },
      { kind: 'reference', label: 'RCUK Adult ALS 2025', url: 'https://www.resus.org.uk/als', version: '2025', accessed_on: '2026-10-20' },
    ],
    reviewed_at: '2026-10-25T10:12:00Z',
    textbook_href: '/dashboard/textbook/topic/cardiac-arrest#sec-management',
    ...overrides,
  }
}

const renderSummary = (summary = makeSummary()) =>
  render(<TopicSummary summary={summary} questionId="q-1" API_BASE="http://api.test" />)

describe('TopicSummary', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'issue-1' }) }))
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders nothing without a summary', () => {
    const { container } = render(<TopicSummary summary={null} questionId="q-1" API_BASE="" />)
    expect(container).toBeEmptyDOMElement()
  })

  test('renders the heading, title and Markdown body with a GFM table', () => {
    renderSummary()
    const region = screen.getByRole('region', { name: 'Topic summary' })
    expect(within(region).getByRole('heading', { name: 'Topic summary' })).toBeInTheDocument()
    expect(within(region).getByText('Ventricular fibrillation management')).toBeInTheDocument()
    expect(within(region).getByRole('table')).toBeInTheDocument()
    expect(within(region).getByRole('cell', { name: 'Adrenaline 1 mg IV' })).toBeInTheDocument()
    expect(within(region).getByRole('region', { name: 'Summary table' })).toHaveAttribute('tabindex', '0')
    expect(within(region).getByText('Resume CPR immediately.')).toBeInTheDocument()
  })

  test('never turns HTML in the body into elements', () => {
    const { container } = renderSummary(
      makeSummary({ body_markdown: 'Intro sentence.\n\n<script>window.hacked = true</script>\n\n<div class="x">boxed</div>\n\n- item' })
    )
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('div.x')).toBeNull()
    expect(window.hacked).toBeUndefined()
  })

  test('the disclosure starts expanded and toggles by click and keyboard', () => {
    renderSummary()
    const toggle = screen.getByRole('button', { name: /hide topic summary/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const body = document.getElementById(toggle.getAttribute('aria-controls'))
    expect(body).toBeVisible()

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(body).not.toBeVisible()

    // Native <button>: Enter and Space activate it as a click.
    toggle.focus()
    expect(toggle).toHaveFocus()
    expect(toggle.tagName).toBe('BUTTON')
    expect(toggle).toHaveAttribute('type', 'button')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  test('"Read textbook" appears only with a textbook link', () => {
    const { unmount } = renderSummary()
    expect(screen.getByRole('link', { name: /read textbook/i })).toHaveAttribute(
      'href',
      '/dashboard/textbook/topic/cardiac-arrest#sec-management'
    )
    unmount()
    renderSummary(makeSummary({ textbook_href: null, sources: [] }))
    expect(screen.queryByRole('link', { name: /read textbook/i })).toBeNull()
  })

  test('lists sources and the review date', () => {
    renderSummary()
    const reference = screen.getByRole('link', { name: 'RCUK Adult ALS 2025' })
    expect(reference).toHaveAttribute('href', 'https://www.resus.org.uk/als')
    expect(reference).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Cardiac arrest — Management')).toBeInTheDocument()
    expect(screen.getByText('Reviewed 25 October 2026')).toBeInTheDocument()
  })

  test('"Report summary" sends a summary report with both IDs and no category picker', async () => {
    renderSummary()
    fireEvent.click(screen.getByRole('button', { name: 'Report summary' }))
    expect(screen.queryByLabelText(/category/i)).toBeNull()
    fireEvent.change(screen.getByLabelText(/describe the issue/i), { target: { value: 'Dose looks wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /submit report/i }))
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled())
    const [url, init] = globalThis.fetch.mock.calls[0]
    expect(url).toBe('http://api.test/qbank/questions/q-1/report')
    expect(JSON.parse(init.body)).toEqual({
      description: 'Dose looks wrong',
      category: 'summary',
      learning_summary_id: 's-1',
      learning_summary_version_id: 'v-1',
    })
  })

  test('a drug overview shows its seven sections, NHS sources and no textbook link', () => {
    const headings = ['Class and mechanism', 'Main uses', 'Important adverse effects', 'Contraindications and cautions',
      'Important interactions', 'Monitoring', 'Prescribing and counselling']
    renderSummary(makeSummary({
      question_category: 'drugs',
      title: 'Bendroflumethiazide',
      subject_label: 'Bendroflumethiazide',
      body_markdown: headings.map((h) => `**${h}:** Overview text.`).join('\n\n'),
      textbook_href: null,
      sources: [{ kind: 'reference', label: 'Bendroflumethiazide - NHS', url: 'https://www.nhs.uk/medicines/bendroflumethiazide/', version: null, accessed_on: '2026-10-25' }],
    }))
    for (const heading of headings) {
      expect(screen.getByText(`${heading}:`).tagName).toBe('STRONG')
    }
    expect(screen.queryByRole('link', { name: /read textbook/i })).toBeNull()
    const source = screen.getByRole('link', { name: 'Bendroflumethiazide - NHS' })
    expect(source).toHaveAttribute('href', 'https://www.nhs.uk/medicines/bendroflumethiazide/')
    expect(source).toHaveAttribute('target', '_blank')
  })

  test('a new version_id key replaces the content', () => {
    const { rerender } = render(
      <TopicSummary key="v-1" summary={makeSummary()} questionId="q-1" API_BASE="" />
    )
    fireEvent.click(screen.getByRole('button', { name: /hide topic summary/i }))
    rerender(
      <TopicSummary
        key="v-2"
        summary={makeSummary({ version_id: 'v-2', title: 'Updated VF management' })}
        questionId="q-1"
        API_BASE=""
      />
    )
    expect(screen.getByText('Updated VF management')).toBeInTheDocument()
    expect(screen.queryByText('Ventricular fibrillation management')).toBeNull()
    expect(screen.getByRole('button', { name: /hide topic summary/i })).toHaveAttribute('aria-expanded', 'true')
  })
})
