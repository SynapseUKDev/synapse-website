import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
  useParams: () => ({}),
  useLocation: () => ({ hash: '' }),
  useOutletContext: () => ({}),
}))
vi.mock('../../src/components/loading/LoadingScreen.jsx', () => ({ default: () => null }))

import { ChapterConfidence } from '../../src/dashboard/textbook/TextbookTopic.jsx'
import { isGroupingTopicFor } from '../../src/dashboard/textbook/textbookProgressLabels.js'

describe('ChapterConfidence', () => {
  test('renders a labelled group with Low / Moderate / High and marks the active one', () => {
    render(<ChapterConfidence value="moderate" error={null} onChange={() => {}} />)
    expect(screen.getByRole('group', { name: 'Confidence' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Low' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Moderate' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'High' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('clicking a level calls onChange with it', () => {
    const onChange = vi.fn()
    render(<ChapterConfidence value="low" error={null} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'High' }))
    expect(onChange).toHaveBeenCalledWith('high')
  })

  test('shows the error in a status region', () => {
    render(<ChapterConfidence value="low" error="Couldn't save confidence. Try again." onChange={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent("Couldn't save confidence. Try again.")
  })

  test('no status text when there is no error', () => {
    render(<ChapterConfidence value="low" error={null} onChange={() => {}} />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

describe('isGroupingTopicFor', () => {
  const TOPICS = [
    { id: 'a', slug: 'leaf', has_subtopics: false, subtopics: [] },
    { id: 'b', slug: 'group', has_subtopics: true, subtopics: [{ id: 's1' }] },
  ]
  test('topic with subtopics is a grouping topic', () => {
    expect(isGroupingTopicFor(TOPICS, { id: 'b', slug: 'group' }, false)).toBe(true)
  })
  test('leaf topic is not', () => {
    expect(isGroupingTopicFor(TOPICS, { id: 'a', slug: 'leaf' }, false)).toBe(false)
  })
  test('a subtopic page is never a grouping topic page', () => {
    expect(isGroupingTopicFor(TOPICS, { id: 'b', slug: 'group' }, true)).toBe(false)
  })
  test('unknown topic is not', () => {
    expect(isGroupingTopicFor(TOPICS, { id: 'zz', slug: 'zz' }, false)).toBe(false)
  })
})
