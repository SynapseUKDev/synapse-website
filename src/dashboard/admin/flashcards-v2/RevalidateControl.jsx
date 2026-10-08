import { useId, useState } from 'react'
import { revalidateTopic } from './flashcardsV2AdminApi'
import { useJobPoller } from './useJobPoller'

const LLM_MESSAGE =
  'The AI reviewer is not configured on this server (LLM_NOT_CONFIGURED), so revalidation is unavailable. ' +
  'Ask a developer to configure the reviewer; you can still edit and publish by hand.'

const MAX_ERROR_CHARS = 500

/** job.error is usually a string, but the column is free-form: show anything else as bounded JSON. */
function errorText(error) {
  if (error == null || error === '') return 'no error message recorded'
  if (typeof error === 'string') return error
  let text
  try {
    text = JSON.stringify(error) ?? String(error)
  } catch {
    text = String(error)
  }
  return text.length > MAX_ERROR_CHARS ? `${text.slice(0, MAX_ERROR_CHARS)}…` : text
}

function phaseText({ phase, job, pollError }) {
  const attempts = job?.attempts ?? 0
  const attemptWord = attempts === 1 ? 'attempt' : 'attempts'
  switch (phase) {
    case 'polling': {
      const line = job ? `Revalidation ${job.status} (attempt ${attempts}).` : 'Revalidation queued; checking every 3 s.'
      return pollError ? `${line} Last check failed: ${pollError.message}` : line
    }
    case 'succeeded':
      return 'Revalidation finished; the review was reloaded with the new run.'
    case 'failed':
      return `Revalidation failed after ${attempts} ${attemptWord}: ${errorText(job?.error)}.`
    case 'timed_out':
      return 'Stopped checking after 10 minutes; the job may still be running. Reload the review later.'
    case 'error':
      return `Could not check the revalidation job: ${pollError?.message || 'unknown error'}.`
    default:
      return ''
  }
}

/**
 * "Revalidate with AI": one fresh independent review of the current deck, run as a background job.
 * 409 JOB_ALREADY_ACTIVE follows the job that is already running instead of failing.
 */
export default function RevalidateControl({ topicId, runId, onSucceeded, onStaleRun }) {
  const [starting, setStarting] = useState(false)
  const [message, setMessage] = useState(null) // {tone: 'info'|'error', text}
  const poller = useJobPoller({ onSucceeded })
  const statusId = useId()

  async function start() {
    setStarting(true)
    setMessage(null)
    try {
      const { jobId } = await revalidateTopic(topicId, runId)
      poller.follow(jobId)
      setMessage({ tone: 'info', text: 'Revalidation started.' })
    } catch (error) {
      if (error?.kind === 'job_active' && error.details?.jobId) {
        poller.follow(error.details.jobId)
        setMessage({ tone: 'info', text: 'A revalidation of this topic was already running; following that job.' })
      } else if (error?.code === 'LLM_NOT_CONFIGURED') {
        setMessage({ tone: 'error', text: LLM_MESSAGE })
      } else if (error?.code === 'STALE_RUN') {
        setMessage({ tone: 'error', text: 'The topic has a newer run than the one loaded; the review was reloaded. Try again.' })
        onStaleRun?.()
      } else {
        setMessage({ tone: 'error', text: `Could not start revalidation: ${error?.message || 'unknown error'}` })
      }
    } finally {
      setStarting(false)
    }
  }

  const busy = starting || poller.polling
  const progress = phaseText(poller)
  return (
    <div className="fcv2a-revalidate">
      <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={start} disabled={busy || !runId} aria-describedby={statusId}>
        {poller.polling ? 'Revalidating…' : 'Revalidate with AI'}
      </button>
      <div id={statusId} role="status" aria-live="polite" aria-label="Revalidation status" className="fcv2a-revalidate__status">
        {message && <p className={message.tone === 'error' ? 'fcv2a-text-error' : undefined}>{message.text}</p>}
        {progress && <p className={['failed', 'error'].includes(poller.phase) ? 'fcv2a-text-error' : undefined}>{progress}</p>}
      </div>
    </div>
  )
}
