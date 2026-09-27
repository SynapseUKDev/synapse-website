import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import TopicCombobox from '../../src/dashboard/admin/questions/TopicCombobox'

const taxonomy = [
  { id: 's1', name: 'Cardiology', topics: [{ id: 't1', name: 'Acute coronary syndrome' }, { id: 't2', name: 'Heart failure' }] },
  { id: 's2', name: 'Renal', topics: [{ id: 't3', name: 'Acute kidney injury' }] },
]

function Harness({ initial = '', clearLabel }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <label htmlFor="topic">Topic</label>
      <TopicCombobox id="topic" taxonomy={taxonomy} value={value} onChange={setValue} clearLabel={clearLabel} />
      <output data-testid="value">{value}</output>
    </>
  )
}

describe('TopicCombobox', () => {
  test('matches every word against specialty and topic names', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Topic' })
    fireEvent.change(input, { target: { value: 'acute renal' } })
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Acute kidney injury'])
  })

  test('arrow keys move the active option and Enter selects it', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Topic' })
    fireEvent.focus(input)
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(input).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: 'Acute kidney injury' }).id)
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByTestId('value')).toHaveTextContent('t3')
  })

  test('clicking an option selects it and shows a helpful empty state', () => {
    render(<Harness />)
    const input = screen.getByRole('combobox', { name: 'Topic' })
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('No topics match “zzz”.')).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'heart' } })
    fireEvent.click(screen.getByRole('option', { name: 'Heart failure' }))
    expect(screen.getByTestId('value')).toHaveTextContent('t2')
    expect(input).toHaveValue('Cardiology › Heart failure')
  })

  test('can be cleared when a clear label is given', () => {
    render(<Harness initial="t1" clearLabel="show all topics" />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear topic (show all topics)' }))
    expect(screen.getByTestId('value')).toBeEmptyDOMElement()
  })
})
