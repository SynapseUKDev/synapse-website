import React from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, test, vi } from 'vitest'

vi.mock('../../src/dashboard/osce/Flashcards.jsx', () => ({ default: () => <div>V1 PAGE</div> }))
vi.mock('../../src/dashboard/osce/FlashcardsV2.jsx', () => ({ default: () => <div>V2 PAGE</div> }))

import { flashcardsRoutes } from '../../src/dashboard/flashcardsRoutes.jsx'

function Where() {
  const { pathname } = useLocation()
  return <div data-testid="where">{pathname}</div>
}

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard">{flashcardsRoutes()}</Route>
        <Route path="*" element={<Where />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

describe('route matrix (V2 is the normal Flashcards entry)', () => {
  const matrix = [
    // [path, rendered page, final pathname]
    ['/dashboard/question-bank/flashcards', 'V2 PAGE', '/dashboard/question-bank/flashcards'],
    ['/dashboard/question-bank/flashcards-v1', 'V1 PAGE', '/dashboard/question-bank/flashcards-v1'],
    ['/dashboard/question-bank/flashcards-v2', 'V2 PAGE', '/dashboard/question-bank/flashcards'],
    ['/dashboard/osce/flashcards', 'V2 PAGE', '/dashboard/question-bank/flashcards'],
  ]
  test.each(matrix)('%s -> %s', (path, page, finalPath) => {
    const { container } = renderAt(path)
    expect(screen.getByText(page)).toBeInTheDocument()
    expect(screen.getAllByText(/PAGE/)).toHaveLength(1)
    expect(container.querySelector('[data-testid="where"]').textContent).toBe(finalPath)
  })
})
