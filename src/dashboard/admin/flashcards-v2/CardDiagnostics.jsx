// Admin-only information about one card. Rendered as a sibling of the student preview, never inside
// it, so nothing here can leak into what learners see.

const SEVERITY_LABEL = { error: 'Error', warning: 'Warning', review: 'Review' }

export default function CardDiagnostics({ card, verdict, onApplySuggestion }) {
  const findings = (card.findings ?? []).filter((f) => f.severity !== 'review')
  const reviewFinding = (card.findings ?? []).find((f) => f.severity === 'review')
  const hasSuggestion = !!verdict && (verdict.correctedQuestion != null || verdict.correctedAnswerMarkdown != null)
  return (
    <section aria-label="Admin diagnostics" className="fcv2a-diag">
      <p className="fcv2a-diag__title">Admin diagnostics</p>
      <dl className="fcv2a-dl">
        <dt>Semantic key</dt>
        <dd>
          <code>{card.semanticKey}</code>
        </dd>
        <dt>QA status</dt>
        <dd>
          <code>{card.qaStatus}</code>
        </dd>
        <dt>Published</dt>
        <dd>{card.isPublished ? 'Yes' : 'No'}</dd>
        <dt>Version</dt>
        <dd>v{card.contentVersion}</dd>
        {card.guidelineSensitive && (
          <>
            <dt>Guideline</dt>
            <dd>Guideline-sensitive: check against current guidance</dd>
          </>
        )}
      </dl>

      {card.legacy && <p className="fcv2a-text-warn">Not part of the current run; retire it before publishing.</p>}

      <p className="fcv2a-label">Findings ({findings.length})</p>
      {findings.length === 0 ? (
        <p className="fcv2a-muted">None.</p>
      ) : (
        <ul className="fcv2a-findings">
          {findings.map((f, i) => (
            <li key={i} className={`fcv2a-finding fcv2a-finding--${f.severity}`}>
              <span className="fcv2a-finding__sev">{SEVERITY_LABEL[f.severity] ?? f.severity}</span> <code>{f.code}</code>{' '}
              <span>{f.message}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="fcv2a-label">Final review verdict</p>
      {verdict ? (
        <div className="fcv2a-verdict">
          <p>
            <strong className={`fcv2a-verdict__tag fcv2a-verdict__tag--${String(verdict.verdict).toLowerCase()}`}>{verdict.verdict}</strong>{' '}
            <span>{verdict.reason}</span>
          </p>
          {verdict.correctedQuestion != null && (
            <div>
              <p className="fcv2a-label">Suggested question</p>
              <p className="fcv2a-suggestion">{verdict.correctedQuestion}</p>
            </div>
          )}
          {verdict.correctedAnswerMarkdown != null && (
            <div>
              <p className="fcv2a-label">Suggested answer (Markdown)</p>
              <pre className="fcv2a-suggestion">{verdict.correctedAnswerMarkdown}</pre>
            </div>
          )}
          {hasSuggestion && (
            <button type="button" className="admin-btn-issue admin-btn-issue--ghost" onClick={onApplySuggestion}>
              Apply suggestion into editor
            </button>
          )}
        </div>
      ) : reviewFinding ? (
        <p>
          <code>{reviewFinding.code}</code> <span>{reviewFinding.message}</span>
        </p>
      ) : (
        <p className="fcv2a-muted">No verdict for this card in the current run.</p>
      )}
    </section>
  )
}
