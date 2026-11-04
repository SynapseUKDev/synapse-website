import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import TopicSummary from '../../practice/TopicSummary'
import {
  MAX_EXTRA_SUMMARIES,
  SUMMARIES_PAGE_PATH,
  addExtraSummary,
  clearQuestionLink,
  fetchQuestionLink,
  fetchSummary,
  listSummaries,
  removeExtraSummary,
  removeQuestionSummary,
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
 * Admin question editor (qbank permission): shows which summary this question displays and lets the
 * editor choose any published summary, from any topic, for this one question — or go back to
 * automatic matching, or remove the summary from this question (kept through uploads). Editors can
 * also add extra summaries, shown after the main one as separate sections. The question's
 * wording, answer, explanations and topic are never changed here.
 * onChange(learningSummary, extraLearningSummaries) receives what the question now shows.
 * Also shown, collapsed, under Practice's admin inline editor. A #summary URL hash scrolls to it.
 */
export default function QuestionSummaryControl({ questionId, onChange, labelledBy }) {
  const sectionRef = useRef(null)
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [picking, setPicking] = useState(false) // false | 'main' | 'extra'
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

  // Nothing linked yet: the search opens straight away. A deliberate "Removed" waits for a click.
  const autoPick = link?.mode === 'automatic' && !link.automatic_summary
  const showPicker = picking || autoPick
  // In that open-by-default case the list waits for a search term, so the editor stays compact.
  const waitForQuery = autoPick && !picking && !query.trim()

  useEffect(() => {
    if (!showPicker || waitForQuery) return undefined
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
  }, [showPicker, waitForQuery, query])

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
      onChange?.(next.learning_summary || null, next.extra_learning_summaries || [])
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
    picking === 'extra'
      ? apply(
          () => addExtraSummary(questionId, chosen.id),
          () => `Added. This question now also shows ${chosen.label}.`,
        )
      : apply(
          () => setQuestionLink(questionId, chosen.id),
          () => `Saved. Everyone viewing this question now sees ${chosen.label}.`,
        )
  const removeExtra = (extra) =>
    apply(
      () => removeExtraSummary(questionId, extra.id),
      () => `Removed ${summaryLabel(extra)} from this question.`,
    )
  const removeSummary = () => {
    if (!window.confirm('Show no summary on this question? It stays removed through future uploads until you choose a summary or automatic selection.')) return
    apply(
      () => removeQuestionSummary(questionId),
      () => 'Removed. This question now shows no summary.',
    )
  }
  const useAutomatic = () =>
    apply(
      () => clearQuestionLink(questionId),
      (next) =>
        next.automatic_summary
          ? `Back to automatic matching: ${summaryLabel(next.automatic_summary)}.`
          : 'Back to automatic matching. No summary matches this question automatically.',
    )

  const loaded = !!link
  useEffect(() => {
    if (loaded && window.location.hash === '#summary') sectionRef.current?.scrollIntoView({ block: 'start' })
  }, [loaded])

  if (!link) {
    return error ? <p className="asum-error qsum" role="alert">{error}</p> : null
  }

  const shown = link.mode === 'manual' ? link.manual_summary : link.mode === 'none' ? null : link.automatic_summary
  const manualMode = link.mode === 'manual' || link.mode === 'none'
  const modeLabel = link.mode === 'none' ? 'Removed' : link.mode === 'manual' ? 'Manual choice' : 'Automatic'
  const extras = Array.isArray(link.extras) ? link.extras : []
  const addingExtra = picking === 'extra'
  const alreadyShown = (summaryId) =>
    addingExtra ? summaryId === shown?.id || extras.some((e) => e.id === summaryId) : link.mode === 'manual' && link.manual_summary?.id === summaryId
  return (
    <section id="summary" ref={sectionRef} className="qsum" aria-labelledby={labelledBy || `qsum-heading-${questionId}`}>
      {!labelledBy && <h2 id={`qsum-heading-${questionId}`} className="qsum__heading">Topic summary</h2>}
      <p className="qsum__status">
        {shown ? summaryLabel(shown) : link.mode === 'none' ? 'No summary' : 'No summary yet'}
        <span className="qsum__mode">
          {manualMode && link.set_at ? `${modeLabel} · ${formatDate(link.set_at)}` : modeLabel}
        </span>
      </p>
      {shown && shown.status !== 'published' && (
        <p className="qsum__note">This summary is {shown.status === 'archived' ? 'withdrawn' : 'a draft'}, so learners see no summary here.</p>
      )}
      {manualMode && (
        <p className="qsum__note">
          Automatic match: {link.automatic_summary ? summaryLabel(link.automatic_summary) : 'none'}
        </p>
      )}
      {notice && <p className="asum-success" role="status">{notice}</p>}
      {error && <p className="asum-error" role="alert">{error}</p>}

      {!showPicker && (
        <div className="asum-actions">
          {shown && (
            <Link className="asum-button" to={`${SUMMARIES_PAGE_PATH}/${shown.id}`}>
              Open summary page
            </Link>
          )}
          <button type="button" className="asum-button" disabled={busy} onClick={() => { setPicking('main'); setNotice(null) }}>
            {shown ? 'Change summary' : 'Choose summary'}
          </button>
          {shown && (
            <button type="button" className="asum-button" disabled={busy} onClick={removeSummary}>
              Remove summary
            </button>
          )}
          {manualMode && (
            <button type="button" className="asum-button" disabled={busy} onClick={useAutomatic}>
              Use automatic selection
            </button>
          )}
        </div>
      )}

      {(extras.length > 0 || (!showPicker && (shown || link.mode === 'none'))) && (
        <div className="qsum__extras">
          <h3 className="qsum__subheading">Also shown</h3>
          {extras.length === 0 ? (
            <p className="qsum__note">No extra summaries. Add one to show it as a separate section after the main summary.</p>
          ) : (
            <ul className="qsum__extra-list" aria-label="Extra summaries">
              {extras.map((extra) => (
                <li key={extra.id}>
                  <span>
                    {summaryLabel(extra)}
                    {extra.status !== 'published' && <span className="qsum__mode">Not shown: {extra.status === 'archived' ? 'withdrawn' : 'draft'}</span>}
                  </span>
                  <button type="button" className="asum-button" disabled={busy} onClick={() => removeExtra(extra)}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!showPicker && extras.length < MAX_EXTRA_SUMMARIES && (
            <div className="asum-actions">
              <button type="button" className="asum-button" disabled={busy} onClick={() => { setPicking('extra'); setNotice(null) }}>
                Add another summary
              </button>
            </div>
          )}
        </div>
      )}

      {showPicker && (
        <div className="qsum__picker">
          <label htmlFor={`qsum-search-${questionId}`}>
            {addingExtra ? 'Search for a summary to add' : 'Search published summaries in any topic'}
          </label>
          <input
            id={`qsum-search-${questionId}`}
            type="search"
            value={query}
            placeholder="Topic or drug name, e.g. Croup"
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            // Inside the question editor's form: Enter must not submit the question.
            onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
          />
          {waitForQuery ? (
            <p className="qsum__note">Type a topic or drug name to see matching summaries.</p>
          ) : results === null ? (
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
              disabled={busy || !chosen?.preview || alreadyShown(chosen.id)}
              onClick={save}
            >
              {addingExtra ? 'Add to this question' : 'Save for this question'}
            </button>
            {!autoPick && (
              <button type="button" className="asum-button" disabled={busy} onClick={() => { setPicking(false); setChosen(null) }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
