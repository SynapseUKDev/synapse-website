import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { plainQuestion } from '../../src/dashboard/flashcards-v2/plainQuestion'
import StudyCard from '../../src/dashboard/flashcards-v2/StudyCard'
import { card } from './fetchMock'

describe('plainQuestion', () => {
  test('strips bold, underscore-bold and code markers', () => {
    expect(plainQuestion('What is the **first-line** treatment for __acute__ `gout`?')).toBe(
      'What is the first-line treatment for acute gout?',
    )
  })

  test('strips leading heading and list markers on every line', () => {
    expect(plainQuestion('## Name the drug')).toBe('Name the drug')
    expect(plainQuestion('- Which nerve?')).toBe('Which nerve?')
    expect(plainQuestion('* Which nerve?')).toBe('Which nerve?')
    expect(plainQuestion('+ Which nerve?')).toBe('Which nerve?')
    expect(plainQuestion('1. First step?\n2) Second step?')).toBe('First step?\nSecond step?')
  })

  test('keeps ordinary text, hashes and numbers inside a sentence', () => {
    expect(plainQuestion('What does C# mean in 2 x 3 = 6?')).toBe('What does C# mean in 2 x 3 = 6?')
    expect(plainQuestion('  spaced   out  ')).toBe('spaced out')
  })

  test('tolerates empty input', () => {
    expect(plainQuestion(null)).toBe('')
    expect(plainQuestion(undefined)).toBe('')
  })
})

describe('StudyCard front', () => {
  test('shows only the plain question, never a topic/specialty/category header', () => {
    const c = card('a', {
      question: '**Which** nerve supplies deltoid?',
      topic: { name: 'Brachial plexus' },
      specialty: { name: 'Anatomy' },
      cardType: 'diagnosis',
    })
    const { container } = render(<StudyCard card={c} revealed={false} />)
    expect(screen.getByText('Which nerve supplies deltoid?')).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/Brachial plexus|Anatomy|diagnosis|\*\*/)
    expect(container.querySelector('h1, h2, h3, h4')).toBeNull()
  })

  test('does not render the answer before reveal', () => {
    render(<StudyCard card={card('a', { answerMarkdown: '- secret answer' })} revealed={false} />)
    expect(screen.queryByText('secret answer')).toBeNull()
  })

  test('renders an image only when media is present, with media.alt', () => {
    const { container, rerender } = render(<StudyCard card={card('a')} revealed={false} />)
    expect(container.querySelector('img')).toBeNull()
    rerender(
      <StudyCard card={card('a', { media: { id: 'm1', url: 'https://cdn.example/m1.png', alt: 'Chest radiograph' } })} revealed={false} />,
    )
    const img = screen.getByRole('img', { name: 'Chest radiograph' })
    expect(img).toHaveAttribute('src', 'https://cdn.example/m1.png')
  })

  test('learners never see internal QA fields; admins get a small badge', () => {
    const adminCard = card('a', { qaStatus: 'needs_attention', isPublished: false, semanticKey: 'k1' })
    const { container, rerender } = render(<StudyCard card={adminCard} revealed={false} />)
    expect(container.textContent).not.toMatch(/draft|attention|k1/i)
    rerender(<StudyCard card={adminCard} revealed={false} showAdminBadge />)
    expect(screen.getByText(/Draft/)).toBeInTheDocument()
    expect(screen.getByText(/Needs attention/)).toBeInTheDocument()
    expect(container.textContent).not.toMatch(/k1/)
  })
})

describe('StudyCard back', () => {
  test('renders lists, ordered steps and bold phrases', () => {
    const md = '- one\n- **two**\n\n1. first\n2. second'
    const { container } = render(<StudyCard card={card('a', { answerMarkdown: md })} revealed />)
    expect(container.querySelectorAll('ul li')).toHaveLength(2)
    expect(container.querySelectorAll('ol li')).toHaveLength(2)
    expect(container.querySelector('strong').textContent).toBe('two')
  })

  test('renders GFM tables inside a horizontal-scroll wrapper', () => {
    const md = '| Drug | Dose |\n| --- | --- |\n| A | 1 mg |\n| B | 2 mg |'
    const { container } = render(<StudyCard card={card('a', { answerMarkdown: md })} revealed />)
    const table = container.querySelector('table')
    expect(table).not.toBeNull()
    expect(table.parentElement).toHaveClass('fc2-table-wrap')
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2)
  })

  test('never interprets raw HTML', () => {
    const md = 'Safe <b>bold</b> <script>window.__x = 1</script><img src="https://evil.example/x.png" onerror="x">'
    const { container } = render(<StudyCard card={card('a', { answerMarkdown: md })} revealed />)
    expect(container.querySelector('b, script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(window.__x).toBeUndefined()
  })

  test('renders links as plain text and drops Markdown images', () => {
    const md = 'See [NICE](https://nice.org.uk) and https://example.com\n\n![x-ray](https://evil.example/a.png)'
    const { container } = render(<StudyCard card={card('a', { answerMarkdown: md })} revealed />)
    expect(container.querySelector('a')).toBeNull()
    expect(container.textContent).toContain('NICE')
    expect(container.querySelector('img')).toBeNull()
  })

  test('headings in the answer do not become document headings', () => {
    const { container } = render(<StudyCard card={card('a', { answerMarkdown: '# Big\n\ntext' })} revealed />)
    expect(container.querySelector('h1, h2, h3')).toBeNull()
    expect(container.textContent).toContain('Big')
  })
})
