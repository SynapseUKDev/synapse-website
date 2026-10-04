import React from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import AdminQuestionImport from '../../src/dashboard/admin/questions/AdminQuestionImport'
import AdminQuestionImportReviewPage from '../../src/dashboard/admin/questions/AdminQuestionImportReview'
import { confirmNavigation } from '../../src/dashboard/navigationGuard'
import {
  AdminQuestionApiError,
  confirmImportBatch,
  fetchImportBatch,
  fetchTaxonomyCached,
  listImportBatches,
  validateImportFile,
} from '../../src/dashboard/admin/questions/questionAdminApi'
import {
  decisionProblems,
  initialDecisions,
  setAcknowledged,
  setDecision,
  toConfirmDecisions,
} from '../../src/dashboard/admin/questions/importReviewModel'

vi.mock('../../src/dashboard/admin/questions/questionAdminApi', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    validateImportFile: vi.fn(),
    listImportBatches: vi.fn(),
    fetchImportBatch: vi.fn(),
    confirmImportBatch: vi.fn(),
    fetchTaxonomyCached: vi.fn(),
  }
})

const QBANK_ADMIN = { id: 'u1', capabilities: { can_manage_qbank: true } }
const dupWarning = { code: 'duplicate_existing', field: 'stem', message: 'A question with the same stem already exists (1 question).' }

const payload = (stem) => ({
  topic_id: 't1',
  type: 'MCQ',
  stem,
  options: ['A', 'B', 'C', 'D', 'E'],
  correct_answer: 1,
  difficulty: 'easy',
  explanation_l2: null,
  explanation_eli5: null,
  explanation_points_by_option: null,
})

const records = [
  { id: 'r0', source_index: 0, outcome: 'pending', decision: 'undecided', warnings: [], validation_errors: [], normalized_payload: payload('Valid stem') },
  { id: 'r1', source_index: 1, outcome: 'pending', decision: 'undecided', warnings: [dupWarning], validation_errors: [], normalized_payload: payload('Duplicate stem') },
  {
    id: 'r2',
    source_index: 2,
    outcome: 'invalid',
    decision: 'undecided',
    warnings: [],
    validation_errors: [{ code: 'too_small', field: 'options', message: 'Imported questions need exactly 5 options.' }],
    normalized_payload: null,
    source_payload: { stem: 'Broken stem' },
  },
]

const batch = {
  id: 'b1',
  source_filename: 'asthma.import.json',
  status: 'validated',
  total_count: 3,
  valid_count: 2,
  invalid_count: 1,
  warning_count: 1,
  duplicate_count: 1,
  selected_count: 0,
  created_count: 0,
  failed_count: 0,
}

function renderAt(path, element) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/dashboard" element={<Outlet context={{ user: QBANK_ADMIN }} />}>
          <Route path="admin" element={element || <p>Admin home</p>} />
          <Route path="admin/question-imports/:batchId" element={<AdminQuestionImportReviewPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function mockBatch(currentBatch, currentRecords) {
  vi.mocked(fetchImportBatch).mockImplementation(async (_id, query) => ({
    batch: currentBatch,
    records: query?.outcome ? currentRecords.filter((r) => r.outcome === query.outcome) : currentRecords,
    total_records: currentRecords.length,
  }))
}

beforeEach(() => {
  vi.mocked(listImportBatches).mockResolvedValue({ batches: [] })
  vi.mocked(fetchTaxonomyCached).mockResolvedValue({
    specialties: [{ id: 's1', name: 'Respiratory', topics: [{ id: 't1', name: 'Asthma' }] }],
  })
  mockBatch(batch, records)
})

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('import review decision rules', () => {
  test('valid records default to include, duplicates start undecided, invalid records get no decision', () => {
    const decisions = initialDecisions(records, 'validated')
    expect(decisions).toEqual({ r0: { decision: 'include', acknowledge: false }, r1: { decision: 'undecided', acknowledge: false } })
    expect(decisionProblems(records, decisions)).toMatchObject({ undecided: [2], blocking: true })
  })

  test('an included duplicate needs acknowledgement; excluding clears it', () => {
    let decisions = setDecision(initialDecisions(records, 'validated'), 'r1', 'include')
    expect(decisionProblems(records, decisions)).toMatchObject({ unacknowledged: [2], blocking: true })
    decisions = setAcknowledged(decisions, 'r1', true)
    expect(decisionProblems(records, decisions).blocking).toBe(false)
    expect(setDecision(decisions, 'r1', 'exclude').r1).toEqual({ decision: 'exclude', acknowledge: false })
  })

  test('confirmation sends one decision per valid record and none for invalid ones', () => {
    const decisions = setAcknowledged(setDecision(initialDecisions(records, 'validated'), 'r1', 'include'), 'r1', true)
    expect(toConfirmDecisions(records, decisions)).toEqual([
      { record_id: 'r0', decision: 'include', acknowledge_warnings: false },
      { record_id: 'r1', decision: 'include', acknowledge_warnings: true },
    ])
  })
})

describe('AdminQuestionImport upload', () => {
  function chooseFile(text, name = 'asthma.import.json') {
    const file = new File([text], name, { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Question file'), { target: { files: [file] } })
  }

  test('rejects unreadable JSON locally without calling the server', async () => {
    renderAt('/dashboard/admin', <AdminQuestionImport />)
    chooseFile('{not json')
    fireEvent.click(screen.getByRole('button', { name: /Validate file/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid JSON')
    expect(validateImportFile).not.toHaveBeenCalled()
  })

  test('sends the raw file to the server and opens the review', async () => {
    vi.mocked(validateImportFile).mockResolvedValue({ batch })
    renderAt('/dashboard/admin', <AdminQuestionImport />)
    chooseFile('[{"stem":"x"}]')
    fireEvent.click(screen.getByRole('button', { name: /Validate file/ }))
    expect(await screen.findByText('Review import')).toBeInTheDocument()
    expect(validateImportFile).toHaveBeenCalledWith('asthma.import.json', '[{"stem":"x"}]')
  })

  test('shows the server’s format guidance when validation fails', async () => {
    vi.mocked(validateImportFile).mockRejectedValue(
      new AdminQuestionApiError({ status: 400, kind: 'validation', message: 'The file has 501 questions; the limit is 500.' }),
    )
    renderAt('/dashboard/admin', <AdminQuestionImport />)
    chooseFile('[]')
    fireEvent.click(screen.getByRole('button', { name: /Validate file/ }))
    expect(await screen.findByRole('alert')).toHaveTextContent('the limit is 500')
  })
})

describe('AdminQuestionImportReview', () => {
  test('shows counts, record issues, and no decision controls for invalid records', async () => {
    renderAt('/dashboard/admin/question-imports/b1')
    const invalid = await screen.findByRole('article', { name: 'Record 3' })
    expect(within(invalid).getByText(/exactly 5 options/)).toBeInTheDocument()
    expect(within(invalid).queryByRole('radio')).toBeNull()
    expect(within(screen.getByRole('article', { name: 'Record 1' })).getByText('Respiratory › Asthma')).toBeInTheDocument()
    expect(screen.getByText('Likely duplicates').nextSibling).toHaveTextContent('1')
  })

  test('blocks confirmation until the duplicate is decided and acknowledged, then confirms', async () => {
    const done = { ...batch, status: 'completed', selected_count: 2, created_count: 2 }
    vi.mocked(confirmImportBatch).mockImplementation(async () => {
      mockBatch(done, records.map((r) => (r.outcome === 'pending' ? { ...r, outcome: 'created', created_question_id: `q-${r.id}` } : r)))
      return { batch: done }
    })
    renderAt('/dashboard/admin/question-imports/b1')

    expect(await screen.findByText(/Choose include or exclude for likely duplicates: record 2/)).toBeInTheDocument()
    const duplicate = screen.getByRole('article', { name: 'Record 2' })
    fireEvent.click(within(duplicate).getByRole('radio', { name: 'Include' }))
    expect(screen.getByText(/Acknowledge the duplicate warning for: record 2/)).toBeInTheDocument()
    fireEvent.click(within(duplicate).getByRole('checkbox', { name: /not an unwanted duplicate/ }))

    fireEvent.click(screen.getByRole('button', { name: 'Review and confirm (2 selected)' }))
    expect(screen.getByText(/inactive question/)).toHaveTextContent('Create 2 inactive questions and exclude 0?')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm import' }))

    expect(await screen.findByText('Imported 2 questions as inactive drafts.')).toBeInTheDocument()
    expect(confirmImportBatch).toHaveBeenCalledWith('b1', [
      { record_id: 'r0', decision: 'include', acknowledge_warnings: false },
      { record_id: 'r1', decision: 'include', acknowledge_warnings: true },
    ])
    await waitFor(() => expect(screen.getAllByRole('link', { name: 'Open created question' })).toHaveLength(2))
  })

  test('explains that nothing can be imported when every record is invalid', async () => {
    mockBatch({ ...batch, valid_count: 0, invalid_count: 3 }, [records[2]])
    renderAt('/dashboard/admin/question-imports/b1')
    expect(await screen.findByText(/nothing to import/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Review and confirm/ })).toBeNull()
  })

  test('warns before leaving an unconfirmed review, not after confirmation', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/dashboard/admin/question-imports/b1')
    await screen.findByRole('article', { name: 'Record 1' })
    expect(confirmNavigation()).toBe(false)
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Recent imports'))
  })

  test('shows failure reasons and retries only with no new decisions', async () => {
    const partial = { ...batch, status: 'completed_with_errors', selected_count: 2, created_count: 1, failed_count: 1 }
    mockBatch(partial, [
      { ...records[0], outcome: 'created', decision: 'include', created_question_id: 'q1' },
      { ...records[1], outcome: 'failed', decision: 'include', failure_message: 'The topic no longer exists.' },
      records[2],
    ])
    vi.mocked(confirmImportBatch).mockResolvedValue({ batch: { ...partial, status: 'completed', created_count: 2, failed_count: 0 } })

    renderAt('/dashboard/admin/question-imports/b1')
    expect(await screen.findByText('The topic no longer exists.')).toBeInTheDocument()
    expect(confirmNavigation()).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Retry failed and pending records' }))
    await waitFor(() => expect(confirmImportBatch).toHaveBeenCalledWith('b1', []))
  })
})
