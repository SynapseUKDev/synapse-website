import React, { useEffect, useState } from 'react'
import { Link, useOutletContext, useSearchParams } from 'react-router-dom'
import { LuChevronLeft } from 'react-icons/lu'
import { canManageQbank } from '../questions/questionAdminAccess'
import { categoryOutcome, conditionOutcome, fetchGaps } from './summaryAdminApi'
import QuestionCategoryControl from './QuestionCategoryControl'
import QuestionConditionControl from './QuestionConditionControl'
import './AdminSummaries.css'

const PAGE_SIZE = 25
const KINDS = [
  ['no_category', 'No category'],
  ['not_linked', 'Not linked'],
]
const INTRO = {
  no_category:
    'Active questions with no category. Choose one: the question is then linked automatically to its condition’s summary for that category, if one is published. Change the condition if it is wrong.',
  not_linked:
    'Active questions with a category but no summary. Choose a summary from any topic, or change the condition or category if it is wrong.',
}

/** QBank → Summaries → questions missing a category or a summary (migration 114). */
export default function AdminSummaryGaps() {
  const { user } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') === 'not_linked' ? 'not_linked' : 'no_category'
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [outcomes, setOutcomes] = useState({}) // question id → { category, topic, text, linked }
  const allowed = canManageQbank(user)

  useEffect(() => {
    if (!allowed) return undefined
    const controller = new AbortController()
    setError(null)
    fetchGaps({ kind, page, page_size: PAGE_SIZE }, { signal: controller.signal })
      .then(setResult)
      .catch((e) => e?.name !== 'AbortError' && setError(e.message))
    return () => controller.abort()
  }, [allowed, kind, page])

  if (!allowed) {
    return (
      <div className="admin">
        <div className="admin-card admin-card--narrow">
          <h1 className="admin__title">Questions to fix</h1>
          <p className="admin__muted">Question-bank admin permission is required.</p>
        </div>
      </div>
    )
  }

  const switchKind = (next) => {
    setParams({ kind: next })
    setPage(1)
    setResult(null)
    setOutcomes({})
  }
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1
  return (
    <div className="admin asum">
      <div className="admin__header">
        <div>
          <Link className="aqe__back" to="/dashboard/admin">
            <LuChevronLeft aria-hidden /> Summaries
          </Link>
          <h1 className="admin__title">Questions to fix</h1>
          <p className="admin__muted">{INTRO[kind]}</p>
        </div>
        <div className="admin-badge">Admin</div>
      </div>

      <div className="asum-card asum-filters">
        <div className="asum-field">
          <span id="asum-gap-kind">Show</span>
          <div className="asum-segmented" role="group" aria-labelledby="asum-gap-kind">
            {KINDS.map(([value, label]) => (
              <button key={value} type="button" aria-pressed={kind === value} onClick={() => switchKind(value)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="asum-error" role="alert">{error}</p>}
      {!result && !error && <p className="asum-results">Loading questions…</p>}
      {result && (
        <>
          <p className="asum-results" aria-live="polite">{result.total.toLocaleString('en-GB')} question(s)</p>
          <div className="asum-table-wrap asum-table-wrap--gaps">
            <table className="asum-table asum-gaps-table">
              <thead>
                <tr>
                  <th scope="col">Question</th>
                  <th scope="col">Condition</th>
                  <th scope="col">Category</th>
                  <th scope="col">Summary</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((item) => {
                  const outcome = outcomes[item.id]
                  const category = outcome ? outcome.category : item.question_category
                  const topic = outcome?.topic ?? { id: item.topic_id, name: item.topic_name }
                  const saved = (r, text) =>
                    setOutcomes((all) => ({
                      ...all,
                      [item.id]: {
                        category: r.question_category,
                        topic: r.topic ?? topic,
                        text,
                        linked: r.auto_linked || r.manual_choice,
                      },
                    }))
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/dashboard/admin/questions/${item.id}`}>{item.stem || `Question ${item.id.slice(0, 8)}`}</Link>
                      </td>
                      <td>
                        <QuestionConditionControl
                          questionId={item.id}
                          topicId={topic.id}
                          topicName={topic.name}
                          onSaved={(r) => saved(r, conditionOutcome(r))}
                        />
                      </td>
                      <td>
                        <QuestionCategoryControl
                          compact
                          questionId={item.id}
                          value={category}
                          onSaved={(r) => saved(r, categoryOutcome(r))}
                        />
                        {outcome && <p className="asum-row-note" role="status">{outcome.text}</p>}
                      </td>
                      <td>
                        {outcome?.linked ? (
                          <span className="asum-row-note">Linked</span>
                        ) : (
                          <Link className="asum-button" to={`/dashboard/admin/questions/${item.id}#summary`}>
                            Choose summary
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {result.items.length === 0 && (
                  <tr><td colSpan={4} className="asum-table__empty">Nothing to fix here.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <nav className="asum-pager" aria-label="Question pages">
              <button type="button" className="asum-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>Page {page} of {totalPages}</span>
              <button type="button" className="asum-button" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </nav>
          )}
        </>
      )}
    </div>
  )
}
