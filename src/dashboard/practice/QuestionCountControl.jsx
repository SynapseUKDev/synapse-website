import React from 'react'
import {
  formatQuestionCountOnBlur,
  resolveQuestionCountInput,
  sanitizeQuestionCountTyping,
} from './questionCountInput'

const DEFAULT_CHIPS = [10, 25, 50, 100, 200]

export default function QuestionCountControl({
  input,
  onInputChange,
  min,
  max,
  disabled = false,
  chipPresets = DEFAULT_CHIPS,
}) {
  const parsed = input === '' || input === '0' ? null : parseInt(input, 10)
  const stepValue = resolveQuestionCountInput(input, min, max)

  const handleChange = (e) => {
    const next = sanitizeQuestionCountTyping(e.target.value)
    if (next !== null) onInputChange(next)
  }

  const handleBlur = () => {
    onInputChange(formatQuestionCountOnBlur(input, min, max))
  }

  const stepDown = () => {
    if (disabled || max <= 0) return
    onInputChange(String(Math.max(min, stepValue - 1)))
  }

  const stepUp = () => {
    if (disabled || max <= 0) return
    onInputChange(String(Math.min(max, stepValue + 1)))
  }

  return (
    <div className="setup__qty">
      <div className="qty__control">
        <button
          type="button"
          className="qty__btn"
          disabled={disabled || max <= 0 || stepValue <= min}
          onClick={stepDown}
        >
          −
        </button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          className="qty__input"
          value={input}
          disabled={disabled}
          aria-label="Number of questions"
          onChange={handleChange}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="qty__btn"
          disabled={disabled || max <= 0 || stepValue >= max}
          onClick={stepUp}
        >
          +
        </button>
      </div>
      <div className="qty__chips">
        {chipPresets.filter((n) => n <= max).map((n) => (
          <button
            key={n}
            type="button"
            className={`chip ${parsed === n ? 'is-active' : ''}`}
            disabled={disabled}
            onClick={() => onInputChange(String(n))}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          className={`chip ${parsed === max ? 'is-active' : ''}`}
          disabled={disabled}
          onClick={() => onInputChange(String(max))}
        >
          Max
        </button>
      </div>
    </div>
  )
}
