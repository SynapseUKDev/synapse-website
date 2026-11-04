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
vi.mock('../../src/dashboard/textbook/ReportTopicIssueButton', () => ({
  default: ({ topicSlug }) => <button type="button" data-slug={topicSlug}>Report</button>,
}))

import { ChapterActions } from '../../src/dashboard/textbook/TextbookTopic.jsx'

const base = {
  placement: 'aside',
  isReviewer: false,
  isAdmin: false,
  hasPage: true,
  editMode: false,
  onToggleEdit: () => {},
  highlightsOn: true,
  onToggleHighlights: () => {},
  topicSlug: 'cardiac-arrest',
  API_BASE: 'http://api.test',
}

describe('ChapterActions', () => {
  test('learner sees the highlight toggle and Report, not Edit', () => {
    render(<ChapterActions {...base} />)
    expect(screen.getByRole('button', { name: 'Hide highlights' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report' })).toHaveAttribute('data-slug', 'cardiac-arrest')
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('admin with a page sees Edit, which toggles the editor', () => {
    const onToggleEdit = vi.fn()
    const { rerender } = render(<ChapterActions {...base} isAdmin onToggleEdit={onToggleEdit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(onToggleEdit).toHaveBeenCalledTimes(1)
    rerender(<ChapterActions {...base} isAdmin editMode onToggleEdit={onToggleEdit} />)
    expect(screen.getByRole('button', { name: 'Close editor' })).toBeInTheDocument()
  })

  test('admin without a page has no Edit', () => {
    render(<ChapterActions {...base} isAdmin hasPage={false} />)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('reviewer sees the Review Mode badge and Report, no highlight toggle or Edit', () => {
    render(<ChapterActions {...base} isReviewer isAdmin />)
    expect(screen.getByText('Review Mode')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /highlights/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  test('highlight toggle reflects state and calls back', () => {
    const onToggleHighlights = vi.fn()
    render(<ChapterActions {...base} highlightsOn={false} onToggleHighlights={onToggleHighlights} />)
    const btn = screen.getByRole('button', { name: 'Show highlights' })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(onToggleHighlights).toHaveBeenCalledTimes(1)
  })

  test('placement sets the modifier class', () => {
    const { container, rerender } = render(<ChapterActions {...base} placement="aside" />)
    expect(container.firstChild).toHaveClass('tb-chapter-actions', 'tb-chapter-actions--aside')
    rerender(<ChapterActions {...base} placement="header" />)
    expect(container.firstChild).toHaveClass('tb-chapter-actions--header')
  })
})
