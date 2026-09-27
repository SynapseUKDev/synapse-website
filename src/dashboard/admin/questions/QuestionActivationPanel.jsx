import React, { useEffect, useState } from 'react'
import { LuShieldCheck } from 'react-icons/lu'
import { activateQuestion, deactivateQuestion } from './questionAdminApi'
import './AdminQuestions.css'

const FIELD_LABELS = {
  clinical_source_reference: 'Clinical source',
  clinical_review_attested: 'Review confirmation',
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
 * Deliberate publish controls. Activation reviews exactly the saved version:
 * it needs a clinical source and an attestation that starts unticked and is
 * reset whenever the version changes. Active questions must be deactivated
 * before their content or images can be edited.
 */
export default function QuestionActivationPanel({ question, blockedReason = null, onChanged }) {
  const [source, setSource] = useState('')
  const [attested, setAttested] = useState(false)
  const [busy, setBusy] = useState(false)
  const [issues, setIssues] = useState([])
  const [message, setMessage] = useState(null)

  // A confirmation never carries over to a different version.
  useEffect(() => {
    setAttested(false)
    setIssues([])
  }, [question.version, question.is_active])

  const run = async (action) => {
    setBusy(true)
    setIssues([])
    setMessage(null)
    try {
      const data = await action()
      setSource('')
      onChanged?.(data.question)
    } catch (err) {
      if (err.kind === 'validation' && err.issues?.length) setIssues(err.issues)
      else setMessage(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (question.is_active) {
    return (
      <section className="admin-card aqa aqa--active" aria-labelledby="aqa-heading">
        <h2 id="aqa-heading" className="aqe__heading">
          <LuShieldCheck aria-hidden /> Active – visible to learners
        </h2>
        <p className="admin__muted">
          {question.activated_at ? `Activated ${formatDate(question.activated_at)}. ` : ''}
          {question.clinical_source_reference ? `Clinical source: ${question.clinical_source_reference}` : ''}
        </p>
        <p>To change this question or its images, deactivate it first. It will then need a fresh review before it can be activated again.</p>
        {message && (
          <div className="admin-alert" role="alert">
            {message}
          </div>
        )}
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
          {busy ? 'Deactivating…' : 'Deactivate to edit'}
        </button>
      </section>
    )
  }

  const canActivate = !blockedReason && !busy && attested && source.trim().length > 0

  return (
    <section className="admin-card aqa" aria-labelledby="aqa-heading">
      <h2 id="aqa-heading" className="aqe__heading">
        <LuShieldCheck aria-hidden /> Review and activate
      </h2>
      <p className="admin__muted">
        Activation makes version {question.version} visible to learners. Check the saved question, answer, explanations
        and images in the preview first.
      </p>
      {blockedReason && (
        <p className="aqg-required" role="status">
          {blockedReason}
        </p>
      )}
      <label className="aqa__field" htmlFor="aqa-source">
        Clinical source
        <span className="aqf__hint">The guideline, publication or reference you checked this against (not the question file or AI model).</span>
      </label>
      <input
        id="aqa-source"
        value={source}
        maxLength={1000}
        disabled={busy || !!blockedReason}
        onChange={(event) => setSource(event.target.value)}
        placeholder="e.g. NICE NG185 Acute coronary syndromes (2020)"
      />
      <label className="aqa__attest">
        <input type="checkbox" checked={attested} disabled={busy || !!blockedReason} onChange={(event) => setAttested(event.target.checked)} />
        <span>
          I have reviewed version {question.version} – the question, correct answer, explanations and images – for clinical
          accuracy, clarity and suitability for the intended learner.
        </span>
      </label>
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
      <button
        type="button"
        className="aqe-button"
        disabled={!canActivate}
        onClick={() =>
          run(() =>
            activateQuestion(question.id, {
              expectedVersion: question.version,
              clinicalSourceReference: source.trim(),
              attested: true,
            }),
          )
        }
      >
        {busy ? 'Activating…' : `Activate version ${question.version}`}
      </button>
    </section>
  )
}
