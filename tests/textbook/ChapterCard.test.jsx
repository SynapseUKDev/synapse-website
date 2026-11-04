import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn(), useParams: () => ({}) }))
vi.mock('../../src/components/loading/LoadingScreen.jsx', () => ({ default: () => null }))

import { ChapterCard } from '../../src/dashboard/textbook/Textbook.jsx'

const SPECIALTY = {
  specialty_id: 's1',
  specialty_name: 'Cancer',
  topics: Array.from({ length: 10 }, (_, i) => ({ topic_id: `t${i}` })),
}

describe('ChapterCard progress', () => {
  test('uses read/total from progress, including subtopics', () => {
    render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} progress={{ read: 5, total: 42 }} />)
    expect(screen.getByText('5 of 42 read')).toBeInTheDocument()
    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuenow', '12')
    expect(bar).toHaveAttribute('aria-label', '5 of 42 read')
  })

  test('renders no meta or bar when there are no readable items', () => {
    render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} progress={{ read: 0, total: 0 }} />)
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    expect(screen.queryByText(/read/)).not.toBeInTheDocument()
  })

  test('falls back to legacy topicsRead + top-level topic count when progress is missing', () => {
    render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} topicsRead={3} />)
    expect(screen.getByText('3 of 10 read')).toBeInTheDocument()
  })

  test('clamps read to total', () => {
    render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} progress={{ read: 50, total: 42 }} />)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
  })

  test('completed specialty shows the check, "Completed · N/N" and a full bar', () => {
    const { container } = render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} progress={{ read: 27, total: 27 }} />)
    expect(screen.getByText('Completed · 27/27')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100')
    expect(container.querySelector('.tb-card__meta--completed')).not.toBeNull()
    expect(container.querySelector('.tb-card__meta-icon')).not.toBeNull()
  })

  test('one item short of complete shows the normal count, not completed', () => {
    const { container } = render(<ChapterCard specialty={SPECIALTY} onClick={() => {}} progress={{ read: 26, total: 27 }} />)
    expect(screen.getByText('26 of 27 read')).toBeInTheDocument()
    expect(container.querySelector('.tb-card__meta--completed')).toBeNull()
  })
})
