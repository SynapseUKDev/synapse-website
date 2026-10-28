import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminSummaryDetail from '../../src/dashboard/admin/summaries/AdminSummaryDetail'
import { confirmNavigation } from '../../src/dashboard/navigationGuard'
import {
  SummaryAdminApiError,
  createVersion,
  deleteSummary,
  fetchPracticePreview,
  fetchSummary,
  publishVersion,
  withdrawSummary,
} from '../../src/dashboard/admin/summaries/summaryAdminApi'

vi.mock('../../src/dashboard/admin/summaries/summaryAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    fetchSummary: vi.fn(),
    fetchPracticePreview: vi.fn(),
    createVersion: vi.fn(),
    publishVersion: vi.fn(),
    withdrawSummary: vi.fn(),
    redraftSummary: vi.fn(),
    deleteSummary: vi.fn(),
  }
})

const QBANK_ADMIN = { id: 'u1', capabilities: { can_manage_qbank: true } }
const S = 's-1'
const BODY = 'Shockable rhythms need early defibrillation.\n\n- Shock\n- Resume CPR'

const version = (n, overrides = {}) => ({
  id: `v-${n}`,
  summary_id: S,
  version: n,
  title: `VF management v${n}`,
  body_markdown: BODY,
  textbook_slug: 'cardiac-arrest',
  textbook_anchor: 'management',
  external_references: [{ citation_id: 'c1', label: 'RCUK Adult ALS 2025', url: 'https://www.resus.org.uk/als' }],
  validation_status: 'passed',
  validation_report: { structural: { errors: [], warnings: [] } },
  origin: 'generated',
  created_at: '2026-10-25T10:00:00Z',
  reviewed_at: n === 1 ? '2026-10-25T11:00:00Z' : null,
  ...overrides,
})

function detail(overrides = {}) {
  return {
    summary: {
      id: S,
      kind: 'condition',
      question_category: 'management',
      subject_label: 'Cardiac Arrest',
      topic: { name: 'Cardiac Arrest' },
      scope_label: 'General',
      status: 'published',
      active_version_id: 'v-1',
      row_version: 4,
      withdrawn_reason: null,
    },
    versions: [version(2, { validation_status: 'needs_review', origin: 'admin_edit' }), version(1)],
    linked_questions: [
      { id: 'q-1', topic_name: 'Cardiac Arrest', stem_excerpt: 'A patient in VF after two shocks…', keyed_answer: 'A. Adrenaline 1 mg IV', is_active: true },
    ],
    open_reports: [],
    ...overrides,
  }
}

function renderPage(user = QBANK_ADMIN) {
  return render(
    <MemoryRouter initialEntries={[`/dashboard/admin/summaries/${S}`]}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user }} />}>
          <Route path="admin" element={<p>Admin home</p>} />
          <Route path="admin/summaries/:summaryId" element={<AdminSummaryDetail />} />
          <Route path="question-bank/practice" element={<PracticeStub />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function PracticeStub() {
  const { state } = useLocation()
  return <p>Practice review: {state?.questions?.length} question(s), {state?.sessionStats?.specialtyName}, summary {state?.questions?.[0]?.learning_summary?.version_id}</p>
}

beforeEach(() => {
  vi.mocked(fetchSummary).mockResolvedValue(detail())
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('AdminSummaryDetail', () => {
  test('needs QBank permission', () => {
    renderPage({ id: 'u2', capabilities: {} })
    expect(screen.getByText(/permission is required/)).toBeInTheDocument()
    expect(fetchSummary).not.toHaveBeenCalled()
  })

  test('lists versions with text status and previews the live version through TopicSummary', async () => {
    renderPage()
    const versions = await screen.findByRole('region', { name: 'Versions' })
    expect(within(versions).getByRole('button', { name: /^v2 — Needs review/ })).toBeInTheDocument()
    expect(within(versions).getByRole('button', { name: /^v1 \(live\) — Passed validation/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Published')).toBeInTheDocument()
    const preview = screen.getByRole('region', { name: 'Topic summary' })
    expect(within(preview).getByText('VF management v1')).toBeInTheDocument()
    expect(within(preview).getByRole('link', { name: /read textbook/i })).toHaveAttribute(
      'href', '/dashboard/textbook/topic/cardiac-arrest#sec-management',
    )
  })

  test('shows linked questions with the stem excerpt and keyed answer', async () => {
    renderPage()
    const linked = await screen.findByRole('region', { name: /Linked questions/ })
    expect(within(linked).getByRole('link', { name: 'A patient in VF after two shocks…' })).toHaveAttribute(
      'href', '/dashboard/admin/questions/q-1',
    )
    expect(within(linked).getByText('A. Adrenaline 1 mg IV')).toBeInTheDocument()
  })

  test('a drug overview is labelled by drug and lists each question with its topic and tested aspect', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(detail({
      summary: { ...detail().summary, kind: 'drug', question_category: 'drugs', subject_label: 'Bendroflumethiazide', topic: null },
      linked_questions: [
        { id: 'q13', topic_name: 'Hypertension', stem_excerpt: 'Which electrolyte…', keyed_answer: 'A. Hypokalaemia', drug_focus: 'adverse_effects', is_active: true },
        { id: 'q14', topic_name: 'Gout', stem_excerpt: 'Which adverse effect…', keyed_answer: 'A. Gout', drug_focus: 'adverse_effects', is_active: true },
      ],
    }))
    renderPage()
    expect(await screen.findByText('Drug: Bendroflumethiazide')).toBeInTheDocument()
    const linked = screen.getByRole('region', { name: /Linked questions \(2\)/ })
    expect(within(linked).getByText('Hypertension · adverse effects')).toBeInTheDocument()
    expect(within(linked).getByText('Gout · adverse effects')).toBeInTheDocument()
  })

  test('"Preview in practice" opens the linked questions in practice review mode with the selected version', async () => {
    vi.mocked(fetchPracticePreview).mockResolvedValue({
      version: 2,
      questions: [{ id: 'q-1', stem: 'Stem', options: [], explanations: {}, learning_summary: { version_id: 'v-2' } }],
    })
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^v2 — Needs review/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Preview v2 in practice' }))
    expect(await screen.findByText('Practice review: 1 question(s), Summary preview: Cardiac Arrest v2, summary v-2')).toBeInTheDocument()
    expect(fetchPracticePreview).toHaveBeenCalledWith(S, 'v-2')
  })

  test('a version that did not pass cannot be published', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^v2 — Needs review/ }))
    expect(screen.queryByRole('button', { name: /^Publish v2/ })).toBeNull()
    expect(screen.getByText(/Only a version that passed validation can be published/)).toBeInTheDocument()
  })

  test('publishing (rolling back) asks for confirmation first', async () => {
    vi.mocked(fetchSummary).mockResolvedValue(detail({
      versions: [version(2), version(1)],
      summary: { ...detail().summary, active_version_id: 'v-2' },
    }))
    vi.mocked(publishVersion).mockResolvedValue({ summary: {} })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: /^v1 — Passed/ }))
    const rollBack = screen.getByRole('button', { name: 'Roll back to v1' })
    fireEvent.click(rollBack)
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(publishVersion).not.toHaveBeenCalled()
    fireEvent.click(rollBack)
    await waitFor(() => expect(publishVersion).toHaveBeenCalledWith(S, 'v-1', 4))
  })

  test('withdraw needs only a confirmation, no reason', async () => {
    vi.mocked(withdrawSummary).mockResolvedValue({ summary: {} })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    const withdraw = await screen.findByRole('button', { name: 'Withdraw' })
    fireEvent.click(withdraw)
    expect(withdrawSummary).not.toHaveBeenCalled()
    fireEvent.click(withdraw)
    await waitFor(() => expect(withdrawSummary).toHaveBeenCalledWith(S, 4))
    expect(screen.queryByLabelText(/Reason/)).toBeNull()
  })

  test('delete asks once, deletes with the row version and returns to the admin page', async () => {
    vi.mocked(deleteSummary).mockResolvedValue({ deleted: {} })
    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    renderPage()
    const remove = await screen.findByRole('button', { name: 'Delete summary' })
    fireEvent.click(remove)
    expect(deleteSummary).not.toHaveBeenCalled()
    expect(window.confirm.mock.calls[0][0]).toMatch(/permanently.*2 version\(s\)/)
    fireEvent.click(remove)
    await waitFor(() => expect(deleteSummary).toHaveBeenCalledWith(S, 4))
    expect(await screen.findByText('Admin home')).toBeInTheDocument()
  })

  test('a 409 keeps the edited text and tells the admin to reload', async () => {
    vi.mocked(createVersion).mockRejectedValue(
      new SummaryAdminApiError({
        status: 409,
        kind: 'conflict',
        code: 'ROW_VERSION_CONFLICT',
        message: 'This summary was changed by someone else after you opened it. Reload to see the latest version. Your text has been kept.',
      }),
    )
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit v1' }))
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'VF management (edited)' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save as new version' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/changed by someone else.*Reload/)
    expect(screen.getByLabelText('Title')).toHaveValue('VF management (edited)')
    expect(createVersion).toHaveBeenCalledWith(S, {
      title: 'VF management (edited)', bodyMarkdown: BODY, baseVersionId: 'v-1', expectedRowVersion: 4,
    })
  })

  test('the edit preview updates live and unsaved edits guard navigation', async () => {
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Edit v1' }))
    fireEvent.change(screen.getByLabelText(/Body/), { target: { value: `${BODY}\n- Give amiodarone` } })
    expect(within(screen.getByRole('region', { name: 'Topic summary' })).getByText('Give amiodarone')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenCalled()
  })
})
