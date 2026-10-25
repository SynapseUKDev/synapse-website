import React, { useId, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { LuBookOpen, LuChevronDown, LuExternalLink } from 'react-icons/lu'
import ReportIssueButton from './ReportIssueButton'
import './TopicSummary.css'

// Summary bodies are Markdown only. No rehype-raw: any HTML in a body stays inert text.
const markdownComponents = {
  table: ({ node: _node, ...props }) => (
    <div className="topic-summary__table-wrap" role="region" aria-label="Summary table" tabIndex={0}>
      <table {...props} />
    </div>
  ),
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
}

function reviewedLabel(value) {
  const date = value ? new Date(value) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Shared "Topic summary" panel, shown under the explanations once they are revealed.
 * Renders nothing without a summary. Call sites key it by summary.version_id so a newly
 * published version replaces the old content.
 */
export default function TopicSummary({ summary, questionId, API_BASE }) {
  const [expanded, setExpanded] = useState(true)
  const headingId = useId()
  const bodyId = useId()
  if (!summary) return null

  const reviewed = reviewedLabel(summary.reviewed_at)
  const sources = Array.isArray(summary.sources) ? summary.sources : []

  return (
    <section className="topic-summary" aria-labelledby={headingId}>
      <div className="topic-summary__header">
        <div className="topic-summary__heading">
          <h3 id={headingId} className="topic-summary__eyebrow">Topic summary</h3>
          <p className="topic-summary__title">{summary.title}</p>
        </div>
        <button
          type="button"
          className="topic-summary__toggle"
          aria-expanded={expanded}
          aria-controls={bodyId}
          aria-label={expanded ? 'Hide topic summary' : 'Show topic summary'}
          onClick={() => setExpanded((open) => !open)}
        >
          <span aria-hidden="true">{expanded ? 'Hide' : 'Show'}</span>
          <LuChevronDown aria-hidden="true" className="topic-summary__chevron" />
        </button>
      </div>

      <div id={bodyId} className="topic-summary__body" hidden={!expanded}>
        <div className="topic-summary__markdown">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {summary.body_markdown || ''}
          </ReactMarkdown>
        </div>

        <footer className="topic-summary__footer">
          {summary.textbook_href && (
            <a className="topic-summary__textbook" href={summary.textbook_href} target="_blank" rel="noopener noreferrer">
              <LuBookOpen aria-hidden="true" />
              <span>Read textbook</span>
              <LuExternalLink aria-hidden="true" className="topic-summary__external" />
            </a>
          )}

          {sources.length > 0 && (
            <div className="topic-summary__sources">
              <h4 className="topic-summary__sources-title">Sources</h4>
              <ul>
                {sources.map((source, index) => (
                  <li key={`${source.kind}-${index}`}>
                    {source.kind === 'textbook' && source.href ? (
                      <a href={source.href} target="_blank" rel="noopener noreferrer">{source.label}</a>
                    ) : source.url ? (
                      <a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a>
                    ) : (
                      <span>{source.label}</span>
                    )}
                    {source.version && <span className="topic-summary__meta"> ({source.version})</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="topic-summary__footer-row">
            {reviewed && <span className="topic-summary__reviewed">Reviewed {reviewed}</span>}
            <ReportIssueButton questionId={questionId} API_BASE={API_BASE} summary={summary} />
          </div>
        </footer>
      </div>
    </section>
  )
}
