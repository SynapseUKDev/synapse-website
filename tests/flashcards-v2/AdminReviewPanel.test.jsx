import React from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import ReviewPanel from '../../src/dashboard/admin/flashcards-v2/ReviewPanel'
import { POLL_INTERVAL_MS, POLL_TIMEOUT_MS } from '../../src/dashboard/admin/flashcards-v2/useJobPoller'
import { mockFetch } from './fetchMock'
import { ADMIN, REVIEW_PATH, RUN, TOPIC, adminCard, reviewPayload, verdict } from './adminFixtures'

const JOB = (id) => `${ADMIN}/jobs/${id}`

/** Review served from `state.review` (tests mutate it); other routes from `routes[path]`. */
function api(initialReview, routes = {}) {
  const state = { review: initialReview }
  const m = mockFetch((url, init, call) => {
    const h = routes[url.pathname]
    if (h) return h(url, call, state)
    if (url.pathname === REVIEW_PATH) return [200, state.review]
    return [404, { error: 'unmocked', code: 'NOT_FOUND' }]
  })
  return { ...m, state }
}

const renderPanel = (props = {}) => render(<ReviewPanel topicId={TOPIC} topicName="Gout" {...props} />)
const cardSection = (key) => screen.getByRole('region', { name: `Card ${key}` })

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('blockers', () => {
  test('every blocker is listed and publish is disabled with the reason', async () => {
    api(
      reviewPayload({
        blockers: [
          { code: 'PUBLISH_BLOCKED', message: 'gout:a is needs_attention; it must be validated (or media_pending) to publish.', semanticKey: 'gout:a' },
          { code: 'PUBLISH_UNRESOLVED_CARDS', message: 'old:one is active but not part of the current run; retire it first.', semanticKey: 'old:one' },
        ],
      }),
    )
    renderPanel()
    const panel = await screen.findByRole('region', { name: 'Publish blockers' })
    expect(within(panel).getByText(/gout:a is needs_attention/)).toBeInTheDocument()
    expect(within(panel).getByText(/old:one is active but not part of the current run/)).toBeInTheDocument()
    const publish = screen.getByRole('button', { name: 'Publish topic' })
    expect(publish).toBeDisabled()
    expect(publish).toHaveAccessibleDescription(/2 blockers must be resolved/)
  })

  test('with no blockers publish is enabled', async () => {
    api(reviewPayload())
    renderPanel()
    expect(await screen.findByRole('button', { name: 'Publish topic' })).toBeEnabled()
    expect(screen.getByText(/No blockers/)).toBeInTheDocument()
  })
})

describe('student preview vs admin diagnostics', () => {
  test('diagnostics never render inside the StudyCard preview', async () => {
    api(
      reviewPayload({
        cards: [
          adminCard('c1', 'gout:a', {
            qaStatus: 'needs_attention',
            guidelineSensitive: true,
            findings: [
              { semanticKey: 'gout:a', code: 'answer_too_long', message: 'FINDING-TEXT', severity: 'warning' },
              { semanticKey: 'gout:a', code: 'review_revise', message: 'VERDICT-REASON', severity: 'review' },
            ],
          }),
        ],
        verdicts: [verdict('gout:a', { verdict: 'REVISE', reason: 'VERDICT-REASON', correctedQuestion: 'SUGGESTED-Q?' })],
      }),
    )
    renderPanel()
    const section = await screen.findByRole('region', { name: 'Card gout:a' })
    fireEvent.click(within(section).getByRole('button', { name: 'Show answer' }))
    const preview = within(section).getByRole('article', { name: 'Flashcard' })
    for (const leaked of ['gout:a', 'FINDING-TEXT', 'VERDICT-REASON', 'SUGGESTED-Q?', /needs attention/i, /draft/i, /answer_too_long/]) {
      expect(within(preview).queryByText(leaked)).toBeNull()
    }
    expect(within(preview).getByText('Question gout:a?')).toBeInTheDocument()
    expect(within(preview).getByText('answer gout:a')).toBeInTheDocument()

    const diag = within(section).getByRole('region', { name: 'Admin diagnostics' })
    expect(within(diag).getByText('FINDING-TEXT')).toBeInTheDocument()
    expect(within(diag).getAllByText('VERDICT-REASON').length).toBeGreaterThan(0)
    expect(within(diag).getByText('needs_attention')).toBeInTheDocument()
    expect(within(diag).getByText('SUGGESTED-Q?')).toBeInTheDocument()
  })

  test('a media card shows the image-required placeholder outside the student card', async () => {
    api(reviewPayload({ cards: [adminCard('c1', 'gout:xray', { qaStatus: 'media_pending', isMediaRequired: true, mediaRequirement: 'AP foot X-ray showing erosions' })] }))
    renderPanel()
    const section = await screen.findByRole('region', { name: 'Card gout:xray' })
    expect(within(section).getByText('Image required: AP foot X-ray showing erosions')).toBeInTheDocument()
    expect(within(within(section).getByRole('article')).queryByText(/Image required/)).toBeNull()
  })
})

describe('inline editing', () => {
  test('save sends expectedVersion and only the changed fields, then reloads the review', async () => {
    const m = api(reviewPayload({ cards: [adminCard('c1', 'gout:a', { contentVersion: 3 })] }), {
      [`${ADMIN}/cards/c1`]: () => [200, adminCard('c1', 'gout:a', { contentVersion: 4, question: 'New Q?', qaStatus: 'draft' })],
    })
    renderPanel()
    const section = await screen.findByRole('region', { name: 'Card gout:a' })
    fireEvent.click(within(section).getByRole('button', { name: 'Edit card' }))
    fireEvent.change(within(section).getByLabelText('Question'), { target: { value: 'New Q?' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(m.callsTo(`${ADMIN}/cards/c1`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/cards/c1`)[0]).toMatchObject({ method: 'PATCH', body: { expectedVersion: 3, question: 'New Q?' } })
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    expect(await screen.findByText(/Saved gout:a/)).toBeInTheDocument()
  })

  /** Edit gout:a (v3), type an answer, save → 409, then reload to v5 with someone else's text. */
  async function conflictThenReload() {
    const m = api(reviewPayload({ cards: [adminCard('c1', 'gout:a', { contentVersion: 3 })] }), {
      [`${ADMIN}/cards/c1`]: (_u, call) =>
        call.body.expectedVersion === 3
          ? [409, { error: 'The card was changed by someone else; reload it', code: 'STALE_VERSION', details: { currentVersion: 5 } }]
          : [200, adminCard('c1', 'gout:a', { contentVersion: 6, answerMarkdown: call.body.answerMarkdown, qaStatus: 'draft' })],
    })
    renderPanel()
    let section = await screen.findByRole('region', { name: 'Card gout:a' })
    fireEvent.click(within(section).getByRole('button', { name: 'Edit card' }))
    fireEvent.change(within(section).getByLabelText('Answer (Markdown)'), { target: { value: '- my careful edit' } })
    fireEvent.click(within(section).getByRole('button', { name: 'Save changes' }))
    const alert = await within(section).findByRole('alert')
    expect(alert).toHaveTextContent(/changed by someone else/i)
    expect(alert).toHaveTextContent(/reload/i)
    expect(within(section).getByLabelText('Answer (Markdown)')).toHaveValue('- my careful edit')
    expect(within(section).getByRole('button', { name: 'Save changes' })).toBeDisabled()

    m.state.review = reviewPayload({
      cards: [adminCard('c1', 'gout:a', { contentVersion: 5, question: 'Their question?', answerMarkdown: '- their edit' })],
    })
    fireEvent.click(within(alert).getByRole('button', { name: 'Reload review' }))
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    section = cardSection('gout:a')
    await within(section).findByRole('region', { name: 'Current server version' })
    return { m, section }
  }

  test('409 → reload: the conflict persists, shows the current server text beside the draft, and Save stays disabled', async () => {
    const { m, section } = await conflictThenReload()
    const alert = within(section).getByRole('alert')
    expect(alert).toHaveTextContent(/changed by someone else/i)
    const current = within(section).getByRole('region', { name: 'Current server version' })
    expect(current).toHaveTextContent('v5')
    expect(within(current).getByText('Their question?')).toBeInTheDocument()
    expect(within(current).getByText('- their edit')).toBeInTheDocument()
    expect(within(section).getByLabelText('Answer (Markdown)')).toHaveValue('- my careful edit')
    const save = within(section).getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    fireEvent.click(save)
    expect(m.callsTo(`${ADMIN}/cards/c1`)).toHaveLength(1) // nothing was overwritten
  })

  test('"Keep my draft (replace current)" enables Save against the reloaded version', async () => {
    const { m, section } = await conflictThenReload()
    fireEvent.click(within(section).getByRole('button', { name: 'Keep my draft (replace current)' }))
    expect(within(section).queryByRole('region', { name: 'Current server version' })).toBeNull()
    const save = within(section).getByRole('button', { name: 'Save changes' })
    expect(save).toBeEnabled()
    fireEvent.click(save)
    await waitFor(() => expect(m.callsTo(`${ADMIN}/cards/c1`)).toHaveLength(2))
    expect(m.callsTo(`${ADMIN}/cards/c1`)[1].body).toEqual({
      expectedVersion: 5,
      question: 'Question gout:a?',
      answerMarkdown: '- my careful edit',
    })
  })

  test('"Discard my draft" resets the editor to the current server text', async () => {
    const { m, section } = await conflictThenReload()
    fireEvent.click(within(section).getByRole('button', { name: 'Discard my draft' }))
    expect(within(section).queryByRole('region', { name: 'Current server version' })).toBeNull()
    expect(within(section).queryByRole('alert')).toBeNull()
    expect(within(section).getByLabelText('Question')).toHaveValue('Their question?')
    expect(within(section).getByLabelText('Answer (Markdown)')).toHaveValue('- their edit')
    expect(m.callsTo(`${ADMIN}/cards/c1`)).toHaveLength(1)
  })

  test('"apply suggestion into editor" fills the editor with the reviewer correction', async () => {
    api(
      reviewPayload({
        cards: [adminCard('c1', 'gout:a')],
        verdicts: [verdict('gout:a', { verdict: 'REVISE', reason: 'Too vague', correctedQuestion: 'Which crystal causes gout?', correctedAnswerMarkdown: '- **Monosodium urate**' })],
      }),
    )
    renderPanel()
    const section = await screen.findByRole('region', { name: 'Card gout:a' })
    fireEvent.click(within(section).getByRole('button', { name: 'Apply suggestion into editor' }))
    expect(within(section).getByLabelText('Question')).toHaveValue('Which crystal causes gout?')
    expect(within(section).getByLabelText('Answer (Markdown)')).toHaveValue('- **Monosodium urate**')
  })
})

describe('revalidate', () => {
  async function flushAll() {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })
  }
  async function advance(ms) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms)
    })
  }

  test('the poll cadence is 3 s and the give-up deadline 10 minutes', () => {
    expect(POLL_INTERVAL_MS).toBe(3000)
    expect(POLL_TIMEOUT_MS).toBe(10 * 60 * 1000)
  })

  test('polls the job every 3 s until it succeeds, then reloads the review', async () => {
    vi.useFakeTimers()
    let polls = 0
    const m = api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [202, { jobId: 'job-1' }],
      [JOB('job-1')]: () => {
        polls += 1
        return [200, { id: 'job-1', kind: 'revalidate_topic', status: polls < 2 ? 'running' : 'succeeded', attempts: 1 }]
      },
    })
    renderPanel()
    await flushAll()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate with AI' }))
    await flushAll()
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/revalidate`)[0].body).toEqual({ runId: RUN })
    expect(m.callsTo(JOB('job-1'))).toHaveLength(0)

    await advance(POLL_INTERVAL_MS - 1)
    expect(m.callsTo(JOB('job-1'))).toHaveLength(0)
    await advance(1)
    expect(m.callsTo(JOB('job-1'))).toHaveLength(1)
    expect(screen.getByRole('status', { name: 'Revalidation status' })).toHaveTextContent(/running.*attempt 1/i)
    expect(m.callsTo(REVIEW_PATH)).toHaveLength(1)

    await advance(POLL_INTERVAL_MS)
    expect(m.callsTo(JOB('job-1'))).toHaveLength(2)
    await flushAll()
    expect(m.callsTo(REVIEW_PATH)).toHaveLength(2)
    expect(screen.getByRole('status', { name: 'Revalidation status' })).toHaveTextContent(/finished/i)

    await advance(POLL_INTERVAL_MS * 3)
    expect(m.callsTo(JOB('job-1'))).toHaveLength(2) // stopped
  })

  test('409 JOB_ALREADY_ACTIVE resumes polling the existing job', async () => {
    vi.useFakeTimers()
    const m = api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [409, { error: 'already', code: 'JOB_ALREADY_ACTIVE', details: { jobId: 'job-9' } }],
      [JOB('job-9')]: () => [200, { id: 'job-9', status: 'running', attempts: 2 }],
    })
    renderPanel()
    await flushAll()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate with AI' }))
    await flushAll()
    expect(screen.getByRole('status', { name: 'Revalidation status' })).toHaveTextContent(/already running/i)
    await advance(POLL_INTERVAL_MS)
    expect(m.callsTo(JOB('job-9'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Revalidat/ })).toBeDisabled()
  })

  test('a failed job shows its attempts and error and stops polling', async () => {
    vi.useFakeTimers()
    const m = api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [202, { jobId: 'job-2' }],
      [JOB('job-2')]: () => [200, { id: 'job-2', status: 'failed', attempts: 3, error: 'JOB_ATTEMPTS_EXHAUSTED' }],
    })
    renderPanel()
    await flushAll()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate with AI' }))
    await flushAll()
    await advance(POLL_INTERVAL_MS)
    const status = screen.getByRole('status', { name: 'Revalidation status' })
    expect(status).toHaveTextContent(/failed after 3 attempts/i)
    expect(status).toHaveTextContent('JOB_ATTEMPTS_EXHAUSTED')
    await advance(POLL_INTERVAL_MS * 2)
    expect(m.callsTo(JOB('job-2'))).toHaveLength(1)
    expect(m.callsTo(REVIEW_PATH)).toHaveLength(1)
  })

  test('a non-string job error is shown as bounded JSON', async () => {
    vi.useFakeTimers()
    const big = { code: 'REVIEW_FAILED', detail: 'x'.repeat(2000) }
    api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [202, { jobId: 'job-4' }],
      [JOB('job-4')]: () => [200, { id: 'job-4', status: 'failed', attempts: 1, error: big }],
    })
    renderPanel()
    await flushAll()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate with AI' }))
    await flushAll()
    await advance(POLL_INTERVAL_MS)
    const text = screen.getByRole('status', { name: 'Revalidation status' }).textContent
    expect(text).toContain('{"code":"REVIEW_FAILED","detail":"xxx')
    expect(text).not.toContain('[object Object]')
    expect(text.length).toBeLessThan(700)
  })

  test('polling gives up after 10 minutes', async () => {
    vi.useFakeTimers()
    const m = api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [202, { jobId: 'job-3' }],
      [JOB('job-3')]: () => [200, { id: 'job-3', status: 'running', attempts: 1 }],
    })
    renderPanel()
    await flushAll()
    fireEvent.click(screen.getByRole('button', { name: 'Revalidate with AI' }))
    await flushAll()
    await advance(POLL_TIMEOUT_MS + POLL_INTERVAL_MS)
    const count = m.callsTo(JOB('job-3')).length
    expect(count).toBeLessThanOrEqual(POLL_TIMEOUT_MS / POLL_INTERVAL_MS)
    expect(screen.getByRole('status', { name: 'Revalidation status' })).toHaveTextContent(/stopped checking after 10 minutes/i)
    await advance(POLL_INTERVAL_MS * 5)
    expect(m.callsTo(JOB('job-3'))).toHaveLength(count)
  })

  test('503 LLM_NOT_CONFIGURED shows a clear message and never polls', async () => {
    const m = api(reviewPayload(), {
      [`${ADMIN}/topics/${TOPIC}/revalidate`]: () => [503, { error: 'The AI reviewer is not configured on this server', code: 'LLM_NOT_CONFIGURED' }],
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Revalidate with AI' }))
    expect(await screen.findByText(/AI reviewer is not configured on this server/i)).toBeInTheDocument()
    expect(m.calls.some((c) => c.url.pathname.startsWith(`${ADMIN}/jobs/`))).toBe(false)
  })
})

describe('publish and unpublish', () => {
  const UP1 = 'ABCDEF01-2345-4678-89AB-CDEF01234567'
  const UP2 = 'FEDCBA98-7654-4321-8FED-CBA987654321'
  const deck = () =>
    reviewPayload({
      cards: [
        adminCard(UP1, 'gout:a', { contentVersion: 3 }),
        adminCard(UP2, 'gout:xray', { contentVersion: 7, qaStatus: 'media_pending', isMediaRequired: true, mediaRequirement: 'Foot X-ray' }),
      ],
    })

  test('the dialog lists what publishes and what stays media-pending; confirm sends lowercase ids + versions', async () => {
    const m = api(deck(), {
      [`${ADMIN}/topics/${TOPIC}/publish`]: () => [200, { topicId: TOPIC, runId: RUN, publishedIds: [UP1.toLowerCase()], alreadyPublishedIds: [], mediaPendingIds: [UP2.toLowerCase()] }],
    })
    const onChanged = vi.fn()
    renderPanel({ onChanged })
    fireEvent.click(await screen.findByRole('button', { name: 'Publish topic' }))
    const dialog = screen.getByRole('dialog', { name: /Publish Gout/ })
    expect(within(within(dialog).getByRole('region', { name: 'Will publish' })).getByText('gout:a')).toBeInTheDocument()
    expect(within(within(dialog).getByRole('region', { name: 'Stays awaiting image' })).getByText('gout:xray')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm publish' }))
    await waitFor(() => expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/publish`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/publish`)[0].body).toEqual({
      runId: RUN,
      expectedVersions: { [UP1.toLowerCase()]: 3, [UP2.toLowerCase()]: 7 },
    })
    expect(await screen.findByText(/Published 1 card; 1 stays awaiting an image/)).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onChanged).toHaveBeenCalled()
  })

  test('409 shows the returned blockers and offers a reload', async () => {
    const m = api(deck(), {
      [`${ADMIN}/topics/${TOPIC}/publish`]: () => [
        409,
        {
          error: 'PUBLISH_BLOCKED',
          code: 'PUBLISH_BLOCKED',
          details: { blockers: [{ code: 'PUBLISH_BLOCKED', message: 'gout:a is draft; it must be validated', semanticKey: 'gout:a' }], detail: 'gout:a:draft' },
        },
      ],
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Publish topic' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm publish' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText('gout:a is draft; it must be validated')).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Reload review' }))
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  test('409 PUBLISH_STALE_VERSION shows the detail and offers a reload', async () => {
    api(deck(), {
      [`${ADMIN}/topics/${TOPIC}/publish`]: () => [409, { error: 'PUBLISH_STALE_VERSION', code: 'PUBLISH_STALE_VERSION', details: `${UP1.toLowerCase()}:4` }],
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Publish topic' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm publish' }))
    const dialog = screen.getByRole('dialog')
    expect(await within(dialog).findByText(/changed since this review was loaded/i)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Reload review' })).toBeInTheDocument()
  })

  test('Escape closes the publish dialog and returns focus to the button', async () => {
    api(deck())
    renderPanel()
    const button = await screen.findByRole('button', { name: 'Publish topic' })
    button.focus()
    fireEvent.click(button)
    const dialog = screen.getByRole('dialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  test('unpublish requires a reason', async () => {
    const m = api(reviewPayload({ review: { status: 'approved' }, cards: [adminCard('c1', 'gout:a', { isPublished: true })] }), {
      [`${ADMIN}/topics/${TOPIC}/unpublish`]: () => [200, { topicId: TOPIC, unpublishedIds: ['c1'] }],
    })
    renderPanel()
    fireEvent.click(await screen.findByRole('button', { name: 'Unpublish topic' }))
    const dialog = screen.getByRole('dialog', { name: /Unpublish Gout/ })
    const confirm = within(dialog).getByRole('button', { name: 'Confirm unpublish' })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Reason for unpublishing'), { target: { value: '   ' } })
    expect(confirm).toBeDisabled()
    fireEvent.change(within(dialog).getByLabelText('Reason for unpublishing'), { target: { value: 'Outdated NICE guidance' } })
    fireEvent.click(confirm)
    await waitFor(() => expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/unpublish`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/unpublish`)[0].body).toEqual({ reason: 'Outdated NICE guidance' })
    expect(await screen.findByText(/Unpublished 1 card/)).toBeInTheDocument()
  })
})

describe('retire legacy cards', () => {
  test('multi-select sends the current runId and the selected keys', async () => {
    const m = api(
      reviewPayload({
        cards: [
          adminCard('c1', 'gout:a'),
          adminCard('L1', 'old:one', { legacy: true, latestRunId: null }),
          adminCard('L2', 'old:two', { legacy: true, latestRunId: null }),
        ],
        retiredCandidates: ['old:one', 'old:two'],
        blockers: [
          { code: 'PUBLISH_UNRESOLVED_CARDS', message: 'old:one is active but not part of the current run; retire it first.', semanticKey: 'old:one' },
          { code: 'PUBLISH_UNRESOLVED_CARDS', message: 'old:two is active but not part of the current run; retire it first.', semanticKey: 'old:two' },
        ],
      }),
      { [`${ADMIN}/topics/${TOPIC}/retire`]: () => [200, { topicId: TOPIC, runId: RUN, retired: ['old:two'] }] },
    )
    renderPanel()
    const legacy = await screen.findByRole('region', { name: 'Card old:two' })
    expect(within(legacy).getByText(/Legacy/)).toBeInTheDocument()
    expect(within(cardSection('gout:a')).queryByRole('checkbox')).toBeNull()

    const retirePanel = screen.getByRole('region', { name: 'Retire candidates' })
    const retireBtn = within(retirePanel).getByRole('button', { name: /Retire selected/ })
    expect(retireBtn).toBeDisabled()
    fireEvent.click(within(legacy).getByRole('checkbox', { name: 'Select old:two for retirement' }))
    expect(within(retirePanel).getByRole('checkbox', { name: 'Retire old:two' })).toBeChecked()
    expect(retireBtn).toHaveTextContent('Retire selected (1)')
    fireEvent.click(retireBtn)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm retire' }))
    await waitFor(() => expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/retire`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/topics/${TOPIC}/retire`)[0].body).toEqual({ runId: RUN, semanticKeys: ['old:two'] })
    expect(await screen.findByText(/Retired 1 card: old:two/)).toBeInTheDocument()
    await waitFor(() => expect(m.callsTo(REVIEW_PATH)).toHaveLength(2))
  })
})

describe('textbook issues', () => {
  const issues = [
    { reviewIndex: 0, issueIndex: 0, blockIds: ['b1'], currentText: 'Colchicine 2 mg hourly', problem: 'Outdated dosing', proposedCorrection: 'Colchicine 500 micrograms BD–QDS', resolution: null },
    { reviewIndex: 0, issueIndex: 1, blockIds: ['b2'], currentText: 'Urate always high', problem: 'Can be normal in attacks', proposedCorrection: 'Urate may be normal during an attack', resolution: { status: 'open', note: null } },
  ]

  test('changing the status calls the API with the issue indexes; a note is saved with it', async () => {
    const m = api(reviewPayload({ textbookIssues: issues }), {
      [`${ADMIN}/runs/${RUN}/textbook-issues/0/1`]: (_u, call) => [200, { runId: RUN, reviewIndex: 0, issueIndex: 1, status: call.body.status, note: call.body.note }],
    })
    renderPanel()
    const panel = await screen.findByRole('region', { name: 'Textbook issues' })
    expect(within(panel).getByText('Urate always high')).toBeInTheDocument()
    expect(within(panel).getByText('Can be normal in attacks')).toBeInTheDocument()
    expect(within(panel).getByText('Urate may be normal during an attack')).toBeInTheDocument()
    expect(within(panel).getByRole('link', { name: /textbook/i })).toHaveAttribute('href', expect.stringContaining('/dashboard/textbook/search?q=Gout'))

    fireEvent.change(within(panel).getByLabelText('Status of issue 2'), { target: { value: 'accepted' } })
    await waitFor(() => expect(m.callsTo(`${ADMIN}/runs/${RUN}/textbook-issues/0/1`)).toHaveLength(1))
    expect(m.callsTo(`${ADMIN}/runs/${RUN}/textbook-issues/0/1`)[0]).toMatchObject({ method: 'PATCH', body: { status: 'accepted', note: null } })

    fireEvent.change(within(panel).getByLabelText('Note for issue 2'), { target: { value: 'Raised with the textbook team' } })
    fireEvent.click(within(panel).getAllByRole('button', { name: 'Save note' })[1])
    await waitFor(() => expect(m.callsTo(`${ADMIN}/runs/${RUN}/textbook-issues/0/1`)).toHaveLength(2))
    expect(m.callsTo(`${ADMIN}/runs/${RUN}/textbook-issues/0/1`)[1].body).toEqual({ status: 'accepted', note: 'Raised with the textbook team' })
  })
})

describe('run summary and load errors', () => {
  test('shows run status, model, prompt version and imported time', async () => {
    api(reviewPayload())
    renderPanel()
    const summary = await screen.findByRole('region', { name: 'Run summary' })
    expect(summary).toHaveTextContent('pending_review')
    expect(summary).toHaveTextContent('ready_for_admin')
    expect(summary).toHaveTextContent('gpt-5.2')
    expect(summary).toHaveTextContent('v2.2-ts-review')
    expect(within(summary).getByText(/2026/)).toBeInTheDocument()
  })

  test('a 404 review says the topic has no review', async () => {
    api(null, { [REVIEW_PATH]: () => [404, { error: 'This topic has no flashcard review', code: 'NOT_FOUND' }] })
    renderPanel()
    expect(await screen.findByText(/no flashcard review/i)).toBeInTheDocument()
  })
})
