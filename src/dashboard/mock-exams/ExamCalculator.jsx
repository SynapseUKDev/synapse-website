import React, { useCallback, useState } from 'react'

const KEYS = [
  ['C', '⌫', '(', ')'],
  ['7', '8', '9', '/'],
  ['4', '5', '6', '*'],
  ['1', '2', '3', '-'],
  ['0', '.', '=', '+'],
]

function evaluateExpression(raw) {
  const expr = String(raw || '').trim()
  if (!expr) return ''
  if (!/^[0-9+\-*/().\s]+$/.test(expr)) return 'Error'
  try {
    const value = Function(`"use strict"; return (${expr})`)()
    if (!Number.isFinite(value)) return 'Error'
    const rounded = Math.round(value * 1e10) / 1e10
    return String(rounded)
  } catch {
    return 'Error'
  }
}

export default function ExamCalculator() {
  const [expression, setExpression] = useState('')
  const [result, setResult] = useState('')

  const display = result || expression || '0'

  const append = useCallback((key) => {
    setResult('')
    setExpression((prev) => prev + key)
  }, [])

  const clear = useCallback(() => {
    setExpression('')
    setResult('')
  }, [])

  const backspace = useCallback(() => {
    setResult('')
    setExpression((prev) => prev.slice(0, -1))
  }, [])

  const onKey = useCallback(
    (key) => {
      if (key === 'C') {
        clear()
        return
      }
      if (key === '⌫') {
        backspace()
        return
      }
      if (key === '=') {
        const next = evaluateExpression(expression)
        setResult(next)
        if (next !== 'Error') setExpression(next)
        return
      }
      append(key)
    },
    [append, backspace, clear, expression],
  )

  return (
    <div className="me-calc" aria-label="Calculator">
      <div className="me-calc__display" aria-live="polite">
        {display}
      </div>
      <div className="me-calc__keys">
        {KEYS.flat().map((key) => (
          <button
            key={key}
            type="button"
            className={`me-calc__key ${key === '=' ? 'me-calc__key--equals' : ''} ${key === 'C' ? 'me-calc__key--clear' : ''}`}
            onClick={() => onKey(key)}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  )
}
