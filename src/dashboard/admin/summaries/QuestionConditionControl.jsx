import React, { useEffect, useState } from 'react'
import TopicCombobox from '../questions/TopicCombobox'
import { fetchTaxonomyCached } from '../questions/questionAdminApi'
import { setQuestionCondition } from './summaryAdminApi'

/**
 * A question's condition (topic) with a Change button (migration 115). Saving moves the question,
 * keeps its category and re-does the automatic link for the new condition. onSaved(result) gets
 * { topic, question_category, auto_linked, manual_choice, link }.
 */
export default function QuestionConditionControl({ questionId, topicId, topicName, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [taxonomy, setTaxonomy] = useState(null)
  const [choice, setChoice] = useState(topicId || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!editing || taxonomy) return undefined
    let live = true
    fetchTaxonomyCached()
      .then((data) => live && setTaxonomy(data?.specialties || []))
      .catch((e) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [editing, taxonomy])

  const cancel = () => {
    setEditing(false)
    setChoice(topicId || '')
    setError(null)
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const result = await setQuestionCondition(questionId, choice)
      setEditing(false)
      onSaved?.(result)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const inputId = `qcond-${questionId}`
  if (!editing) {
    return (
      <div className="asum-condition">
        <span>{topicName || '—'}</span>
        <button
          type="button"
          className="asum-link-button"
          aria-label={`Change condition (now ${topicName || 'none'})`}
          onClick={() => setEditing(true)}
        >
          Change
        </button>
      </div>
    )
  }
  return (
    <div className="asum-condition asum-condition--editing">
      <label htmlFor={inputId} className="asum-sr-only">
        Condition
      </label>
      {taxonomy ? (
        <TopicCombobox id={inputId} taxonomy={taxonomy} value={choice} onChange={setChoice} disabled={busy} />
      ) : (
        !error && <span className="asum-row-note">Loading conditions…</span>
      )}
      <div className="asum-condition__actions">
        <button
          type="button"
          className="asum-button asum-button--primary asum-button--small"
          disabled={busy || !choice || choice === topicId}
          onClick={save}
        >
          {busy ? 'Saving…' : 'Save condition'}
        </button>
        <button type="button" className="asum-button asum-button--small" disabled={busy} onClick={cancel}>
          Cancel
        </button>
      </div>
      {error && (
        <p className="asum-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
