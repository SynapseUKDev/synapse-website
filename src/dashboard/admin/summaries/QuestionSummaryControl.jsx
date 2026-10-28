import React, { useEffect, useState } from 'react'
import TopicSummary from '../../practice/TopicSummary'
import {
  clearQuestionLink,
  fetchQuestionLink,
  fetchSummary,
  listSummaries,
  setQuestionLink,
  summaryLabel,
  toPreviewSummary,
} from './summaryAdminApi'
import './AdminSummaries.css'
import './QuestionSummaryControl.css'

const SEARCH_DELAY_MS = 250

function formatDate(value) {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('en-GB', { dateStyle: 'medium' }) : ''
}

/**
 * Editors only (qbank permission): shows which summary this question displays and lets the editor
 * choose any published summary, from any topic, for this one question — or go back to automatic
 * matching. The question's wording, answer, explanations and topic are never changed here.
 * onChange(learningSummary) receives the learner summary the question now shows (or null).
 */
export default function QuestionSummaryControl({ questionId, onChange }) {
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [chosen, setChosen] = useState(null) // { id, label, preview }
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLink(null)
    setError(null)
    setNotice(null)
    setPicking(false)
    setChosen(null)
    fetchQuestionLink(questionId, { signal: controller.signal })
      .then(setLink)
      .catch((e) => e?.name !== 'AbortError' && setError(e.message))
    return () => controller.abort()
  }, [questionId])

  useEffect(() => {
    if (!picking) return undefined
    const controller = new AbortController()
    const timer = setTimeout(() => {
      listSummaries({ status: 'published', q: query.trim(), page_size: 20 }, { signal: controller.signal })
        .then((data) => setResults(data.summaries || []))
        .catch((e) => e?.name !== 'AbortError' && setError(e.message))
    }, SEARCH_DELAY_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [picking, query])

  async function choose(summary) {
    setChosen({ id: summary.id, label: summaryLabel(summary), preview: null })
    setError(null)
    try {
      const detail = await fetchSummary(summary.id)
      const active = detail.versions.find((v) => v.id === detail.summary.active_version_id)
      setChosen((current) =>
        current?.id === summary.id ? { ...current, preview: toPreviewSummary(detail.summary, active) } : current,
      )
    } catch (e) {
      setError(e.message)
    }
  }

  async function apply(action, success) {
    setBusy(true)
    setError(null)
    try {
      const next = await action()
      setLink(next)
      onChange?.(next.learning_summary || null)
      setPicking(false)
      setChosen(null)
      setNotice(success(next))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    apply(
      () => setQuestionLink(questionId, chosen.id),
      () => `Saved. Everyone viewing this question now sees ${chosen.label}.`,
    )
  const useAutomatic = () =>
    apply(
      () => clearQuestionLink(questionId),
      (next) =>
        next.automatic_summary
          ? `Back to automatic matching: ${summaryLabel(next.automatic_summary)}.`
          : 'Back to automatic matching. No summary matches this question automatically.',
    )

  if (!link) {
    return error ? <p className="asum-error qsum" role="alert">{error}</p> : null
  }

  const shown = link.mode === 'manual' ? link.manual_summary : link.automatic_summary
  return (
    <section className="qsum" aria-labelledby={`qsum-heading-${questionId}`}>
      <h3 id={`qsum-heading-${questionId}`} className="qsum__heading">Summary for this question (editors only)</h3>
      <p className="qsum__status">
        {shown ? summaryLabel(shown) : 'No summary'}
        <span className="qsum__mode">
          {link.mode === 'manual' ? `Manual choice${link.set_at ? ` · ${formatDate(link.set_at)}` : ''}` : 'Automatic'}
        </span>
      </p>
      {shown && shown.status !== 'published' && (
        <p className="qsum__note">This summary is {shown.status === 'archived' ? 'withdrawn' : 'a draft'}, so learners see no summary here.</p>
      )}
      {link.mode === 'manual' && (
        <p className="qsum__note">
          Automatic match: {link.automatic_summary ? summaryLabel(link.automatic_summary) : 'none'}
        </p>
      )}
      {notice && <p className="asum-success" role="status">{notice}</p>}
      {error && <p className="asum-error" role="alert">{error}</p>}

      {!picking && (
        <div className="asum-actions">
          <button type="button" className="asum-button" disabled={busy} onClick={() => { setPicking(true); setNotice(null) }}>
            Change summary
          </button>
          {link.mode === 'manual' && (
            <button type="button" className="asum-button" disabled={busy} onClick={useAutomatic}>
              Use automatic selection
            </button>
          )}
        </div>
      )}

      {picking && (
        <div className="qsum__picker">
          <label htmlFor={`qsum-search-${questionId}`}>Search published summaries in any topic</label>
          <input
            id={`qsum-search-${questionId}`}
            type="search"
            value={query}
            placeholder="Topic or drug name, e.g. Croup"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
          />
          {results === null ? (
            <p className="qsum__note">Loading…</p>
          ) : results.length === 0 ? (
            <p className="qsum__note">No published summaries match.</p>
          ) : (
            <ul className="qsum__results" aria-label="Matching summaries">
              {results.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`qsum__result ${chosen?.id === s.id ? 'is-selected' : ''}`}
                    aria-pressed={chosen?.id === s.id}
                    onClick={() => choose(s)}
                  >
                    {summaryLabel(s)}
                    {s.kind === 'drug' && <span className="qsum__mode">Drug</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {chosen && !chosen.preview && <p className="qsum__note">Loading preview…</p>}
          {chosen?.preview && (
            <>
              <p className="qsum__note">Preview of {chosen.label}:</p>
              <TopicSummary summary={chosen.preview} questionId={null} API_BASE="" />
            </>
          )}
          <div className="asum-actions">
            <button
              type="button"
              className="asum-button asum-button--primary"
              disabled={busy || !chosen?.preview || (link.mode === 'manual' && link.manual_summary?.id === chosen.id)}
              onClick={save}
            >
              Save for this question
            </button>
            <button type="button" className="asum-button" disabled={busy} onClick={() => { setPicking(false); setChosen(null) }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
