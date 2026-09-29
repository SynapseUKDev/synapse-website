import React, { useEffect, useState } from 'react'
import { LuEye, LuEyeOff } from 'react-icons/lu'
import { activateQuestion, deactivateQuestion } from './questionAdminApi'
import './AdminQuestions.css'

const FIELD_LABELS = {
  topic_id: 'Topic',
  stem: 'Question stem',
  options: 'Answer options',
  correct_answer: 'Correct answer',
}

function issueLabel(field) {
  const image = /^images\.(\d+)\.alt$/.exec(field || '')
  if (image) return `Image ${Number(image[1]) + 1} alt text`
  return FIELD_LABELS[field] || field
}

function formatDate(value) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  } catch {
    return String(value)
  }
}

/**
 * Publish controls. Activating shows the saved version to learners (after a
 * confirmation); deactivating hides it again. Active questions stay editable,
 * so there is no review gate here (owner decision 2026-09-29).
 */
export default function QuestionActivationPanel({ question, blockedReason = null, onChanged }) {
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState([])
  const [message, setMessage] = useState(null)

  useEffect(() => {
    setIssues([])
    setMessage(null)
  }, [question.version, question.is_active])

  const run = async (action) => {
    setBusy(true)
    setIssues([])
    setMessage(null)
    try {
      const data = await action()
      onChanged?.(data.question)
    } catch (err) {
      if (err.kind === 'validation' && err.issues?.length) setIssues(err.issues)
      else setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  const problems = (
    <>
      {issues.length > 0 && (
        <div className="admin-alert" role="alert">
          <strong>This question cannot be activated yet:</strong>
          <ul>
            {issues.map((issue, index) => (
              <li key={`${issue.field}-${index}`}>
                {issueLabel(issue.field)}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {message && (
        <div className="admin-alert" role="alert">
          {message}
        </div>
      )}
    </>
  )

  if (question.is_active) {
    return (
      <section className="admin-card aqa aqa--active" aria-labelledby="aqa-heading">
        <h2 id="aqa-heading" className="aqe__heading">
          <LuEye aria-hidden /> Live – visible to learners
        </h2>
        {question.activated_at && <p className="admin__muted">Activated {formatDate(question.activated_at)}.</p>}
        {problems}
        <button
          type="button"
          className="aqe-button aqe-button--ghost"
          disabled={busy}
          onClick={() => {
            if (window.confirm('Deactivate this question? Learners will stop seeing it immediately.')) {
              run(() => deactivateQuestion(question.id, question.version))
            }
          }}
        >
          <LuEyeOff aria-hidden /> {busy ? 'Deactivating…' : 'Deactivate (hide from learners)'}
        </button>
      </section>
    )
  }

  return (
    <section className="admin-card aqa" aria-labelledby="aqa-heading">
      <h2 id="aqa-heading" className="aqe__heading">
        <LuEyeOff aria-hidden /> Inactive – hidden from learners
      </h2>
      <p className="admin__muted">Activating makes the saved question and its images visible to learners.</p>
      {blockedReason && (
        <p className="aqg-required" role="status">
          {blockedReason}
        </p>
      )}
      {problems}
      <button
        type="button"
        className="aqe-button"
        disabled={busy || !!blockedReason}
        onClick={() => {
          if (window.confirm('Activate this question? Learners will see it immediately.')) {
            run(() => activateQuestion(question.id, { expectedVersion: question.version }))
          }
        }}
      >
        <LuEye aria-hidden /> {busy ? 'Activating…' : 'Activate'}
      </button>
    </section>
  )
}
