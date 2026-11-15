import React, { useEffect, useState } from 'react'
import { CATEGORY_LABELS, setQuestionCategory } from './summaryAdminApi'

/**
 * Category picker for one question (migration 114). Saving re-does the automatic summary link for
 * the new category; a manual summary choice is kept. onSaved(result) gets
 * { question_category, auto_linked, manual_choice, link }.
 */
export default function QuestionCategoryControl({ questionId, value, onSaved, compact = false }) {
  const [category, setCategory] = useState(value || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => setCategory(value || ''), [value])

  async function save() {
    setBusy(true)
    setError(null)
    try {
      onSaved?.(await setQuestionCategory(questionId, category))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const selectId = `qcat-${questionId}`
  return (
    <div className="asum-category">
      <label htmlFor={selectId} className={compact ? 'asum-sr-only' : undefined}>
        Category
      </label>
      <select id={selectId} value={category} disabled={busy} onChange={(e) => setCategory(e.target.value)}>
        <option value="" disabled>
          Choose a category…
        </option>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="asum-button asum-button--primary"
        disabled={busy || !category || category === (value || '')}
        onClick={save}
      >
        {busy ? 'Saving…' : 'Save category'}
      </button>
      {error && (
        <p className="asum-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
