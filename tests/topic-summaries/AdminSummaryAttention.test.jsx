import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminSummaryAttention from '../../src/dashboard/admin/summaries/AdminSummaryAttention'
import AdminSummaryAttentionItem from '../../src/dashboard/admin/summaries/AdminSummaryAttentionItem'
import {
  SummaryAdminApiError,
  approveAttention,
  fetchAttentionItem,
  listAttention,
  rejectAttention,
  saveAttentionDraft,
  textToReferences,
} from '../../src/dashboard/admin/summaries/summaryAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    listAttention: vi.fn(),
    fetchAttentionItem: vi.fn(),
    saveAttentionDraft: vi.fn(),
    approveAttention: vi.fn(),
    rejectAttention: vi.fn(),
  }
})
// The selector has its own tests; here it only needs to render.
vi.mock('../../src/dashboard/admin/summaries/QuestionSummaryControl', () => ({
  default: () => <p>Summary selector</p>,
}))

const QBANK_ADMIN = { id: 'u1', capabilities: { can_manage_qbank: true } }
const ITEM = 'item-1'

const detail = (overrides = {}) => ({
  item: {
    id: ITEM,
    state: 'draft',
    revision: 1,
    reason: 'Review incomplete',
    warnings: 'Saved description names Asthma | Pregnancy detail missing',
    condition_name: 'COPD',
    question_id: 'q-1',
    question_category: 'diagnosis',
    target_summary: { subject_label: 'COPD', scope_label: 'Pregnancy', question_category: 'diagnosis' },
    draft: { title: 'COPD diagnosis in pregnancy', body_markdown: 'Generated body.', external_references: [] },
    original_draft: { title: 'COPD diagnosis in pregnancy', body_markdown: 'Generated body.' },
    review_notes: { relevance: 'medium', completeness: 'partial', coverage_note: null, issues: ['Add pregnancy detail'], source_gaps: [], suggested_sources: [] },
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  },
  events: [],
  other_cases: [],
  question: { id: 'q-1', stem: 'A pregnant woman with breathlessness…', topic: { name: 'COPD' } },
  link: null,
})

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user: QBANK_ADMIN }} />}>
          <Route path="admin/summaries/attention" element={<AdminSummaryAttention />} />
          <Route path="admin/summaries/attention/:itemId" element={<AdminSummaryAttentionItem />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => vi.restoreAllMocks())

describe('Needs attention list', () => {
  test('shows open items by default with labelled states', async () => {
    vi.mocked(listAttention).mockResolvedValue({
      items: [
        { id: ITEM, state: 'draft', condition_name: 'COPD', question_category: 'diagnosis', draft_title: 'COPD diagnosis in pregnancy', reason: 'Review incomplete', created_at: '2026-11-01T10:00:00Z' },
        { id: 'item-2', state: 'awaiting_content', condition_name: 'COPD', question_category: 'drugs', target_label: 'Oxygen', reason: 'Evidence incomplete', created_at: '2026-11-01T10:00:00Z' },
      ],
      total: 2,
      counts: { draft: 1, awaiting_content: 1 },
    })
    renderAt('/dashboard/admin/summaries/attention')
    expect(await screen.findByRole('link', { name: 'COPD diagnosis in pregnancy' })).toHaveAttribute('href', `/dashboard/admin/summaries/attention/${ITEM}`)
    expect(screen.getByText('Draft — hidden from students')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Oxygen (no text yet)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Needs attention (2)' })).toHaveAttribute('aria-pressed', 'true')
    expect(listAttention).toHaveBeenCalledWith({ state: 'open', q: '', page: 1, page_size: 25 }, expect.anything())
  })
})

describe('Needs attention item', () => {
  test('approval waits for a saved draft with an evidence link and a note', async () => {
    vi.mocked(fetchAttentionItem).mockResolvedValue(detail())
    renderAt(`/dashboard/admin/summaries/attention/${ITEM}`)
    expect(await screen.findByText('Review incomplete')).toBeInTheDocument()
    expect(screen.getByText('Add pregnancy detail')).toBeInTheDocument()
    const approve = screen.getByRole('button', { name: 'Approve for this question' })
    fireEvent.change(screen.getByLabelText(/Approval note/), { target: { value: 'Checked against NICE' } })
    expect(approve).toBeDisabled() // no evidence link saved yet

    const saved = detail({
      revision: 2,
      draft: { title: 'COPD diagnosis in pregnancy', body_markdown: 'Edited body.', external_references: [{ url: 'https://www.nice.org.uk/guidance/ng115', label: 'NICE NG115' }] },
    })
    vi.mocked(saveAttentionDraft).mockResolvedValue(saved)
    fireEvent.change(screen.getByLabelText('Body (Markdown)'), { target: { value: 'Edited body.' } })
    fireEvent.change(screen.getByLabelText(/Evidence links/), { target: { value: 'https://www.nice.org.uk/guidance/ng115 | NICE NG115' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }))
    await waitFor(() =>
      expect(saveAttentionDraft).toHaveBeenCalledWith(ITEM, {
        expectedRevision: 1,
        title: 'COPD diagnosis in pregnancy',
        bodyMarkdown: 'Edited body.',
        externalReferences: [{ url: 'https://www.nice.org.uk/guidance/ng115', label: 'NICE NG115' }],
        reason: '',
      }),
    )
    expect(await screen.findByText(/Draft saved/)).toBeInTheDocument()

    vi.mocked(approveAttention).mockResolvedValue(detail({ ...saved.item, state: 'approved', revision: 3 }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Approve for this question' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: 'Approve for this question' }))
    await waitFor(() => expect(approveAttention).toHaveBeenCalledWith(ITEM, 2, 'Checked against NICE'))
    expect(await screen.findByText(/Students now see this text on this question/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reject' })).toBeNull()
  })

  test('a stale decision shows the server message and keeps the page', async () => {
    vi.mocked(fetchAttentionItem).mockResolvedValue(detail())
    vi.spyOn(window, 'prompt').mockReturnValue('')
    vi.mocked(rejectAttention).mockRejectedValue(
      new SummaryAdminApiError({ status: 409, kind: 'validation', code: 'REVIEW_STALE', message: 'This item was changed by someone else.' }),
    )
    renderAt(`/dashboard/admin/summaries/attention/${ITEM}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    await waitFor(() => expect(rejectAttention).toHaveBeenCalledWith(ITEM, 1, ''))
    expect(await screen.findByRole('alert')).toHaveTextContent('This item was changed by someone else.')
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
  })

  test('an item with no summary target cannot be written, only redirected', async () => {
    vi.mocked(fetchAttentionItem).mockResolvedValue(detail({ state: 'awaiting_content', target_summary: null, draft: null, original_draft: null }))
    renderAt(`/dashboard/admin/summaries/attention/${ITEM}`)
    expect(await screen.findByText(/no summary target/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Body (Markdown)')).toBeNull()
    expect(screen.getByText('Summary selector')).toBeInTheDocument()
  })
})

describe('textToReferences', () => {
  test('keeps the fields of references it already had', () => {
    const existing = [{ url: 'https://a.org/x', label: 'Old', citation_id: 'c1' }]
    expect(textToReferences('https://a.org/x | New\nhttps://b.org', existing)).toEqual([
      { url: 'https://a.org/x', label: 'New', citation_id: 'c1' },
      { url: 'https://b.org' },
    ])
  })
})
