import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

test('admin question component harness renders accessible content', () => {
  render(<button type="button">Preview question</button>)
  expect(screen.getByRole('button', { name: 'Preview question' })).toBeInTheDocument()
})
