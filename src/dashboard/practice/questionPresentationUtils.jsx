/*
 * Pure learner-facing question presentation helpers shared by solo practice,
 * group practice and the admin preview.
 */

export function hasMarkdown(text = '') {
  // Detect headers, lists, bold, italics, code, links, and tables (|---|)
  return /(^|\n)\s{0,3}#{1,6}\s+|(^|\n)\s*([-*+]\s+|\d+\.\s+)|\*\*[^*]+\*\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\)|\|[^|]+\|/m.test(text)
}

export const stemMarkdownComponents = {
  p: ({ node, ...props }) => <p style={{ marginBottom: '12px', lineHeight: '1.6' }} {...props} />,
  h1: ({ node, ...props }) => <h1 style={{ fontSize: '1.5em', fontWeight: 800, marginBottom: '12px', marginTop: '16px' }} {...props} />,
  h2: ({ node, ...props }) => <h2 style={{ fontSize: '1.3em', fontWeight: 800, marginBottom: '10px', marginTop: '14px' }} {...props} />,
  h3: ({ node, ...props }) => <h3 style={{ fontSize: '1.1em', fontWeight: 700, marginBottom: '8px', marginTop: '12px' }} {...props} />,
  ul: ({ node, ...props }) => <ul style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
  ol: ({ node, ...props }) => <ol style={{ marginBottom: '12px', paddingLeft: '24px' }} {...props} />,
  li: ({ node, ...props }) => <li style={{ marginBottom: '4px' }} {...props} />,
  table: ({ node, ...props }) => (
    <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          border: '1px solid var(--stem-md-table-border)',
          color: 'var(--stem-md-td-fg)',
        }}
        {...props}
      />
    </div>
  ),
  th: ({ node, ...props }) => (
    <th
      style={{
        border: '1px solid var(--stem-md-table-border)',
        padding: '8px',
        backgroundColor: 'var(--stem-md-th-bg)',
        color: 'var(--stem-md-th-fg)',
        fontWeight: 700,
        textAlign: 'left',
      }}
      {...props}
    />
  ),
  td: ({ node, ...props }) => (
    <td
      style={{
        border: '1px solid var(--stem-md-table-border)',
        padding: '8px',
        textAlign: 'left',
        color: 'var(--stem-md-td-fg)',
      }}
      {...props}
    />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote style={{ borderLeft: '4px solid #cbd5e1', paddingLeft: '12px', margin: '12px 0', color: '#64748b' }} {...props} />
  ),
  code: ({ node, inline, ...props }) => {
    if (inline) {
      return <code style={{ backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '0.9em' }} {...props} />
    }
    return <code style={{ display: 'block', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '8px', overflowX: 'auto', marginBottom: '12px' }} {...props} />
  },
}

export function optionLabel(index) {
  return String.fromCharCode(65 + index)
}

/** Learner option shape: stored option strings become { id, label, body }. */
export function toLearnerOptions(options = []) {
  return options.map((body, idx) => ({ id: idx, label: optionLabel(idx), body }))
}

/**
 * Quick explanations show the first point for each option that has one, in
 * option order, marking the correct option.
 */
export function buildQuickPoints(pointsByOption, correctAnswer, optionCount) {
  if (!pointsByOption) return []
  return Array.from({ length: optionCount }, (_, idx) => ({
    label: optionLabel(idx),
    text: pointsByOption[String(idx)]?.[0] || null,
    isCorrect: correctAnswer === idx,
  })).filter((p) => p.text)
}

/** Learner asset shape from API image rows ({ asset_url, asset_type, ... }). */
export function toLearnerAssets(images = []) {
  return images.map((asset, index) => ({
    id: asset.id,
    type: asset.asset_type || 'image',
    url: asset.asset_url,
    alt: asset.alt || null,
    caption: asset.caption || null,
    credit: asset.credit || null,
    position: asset.position || index + 1,
  }))
}

/**
 * Applies an admin save response to a learner session question. Images come
 * back as `images` (legacy responses used `assets`); when neither is present
 * the question keeps the images it already had.
 */
export function mergeAdminQuestionUpdate(question, updated) {
  const optionBodies = Array.isArray(updated.options)
    ? updated.options.map((option) => (typeof option === 'string' ? option : option?.body || option?.text || option?.label || ''))
    : []
  const images = updated.images ?? updated.assets
  return {
    ...question,
    ...updated,
    assets: images ? toLearnerAssets(images) : question.assets,
    options: toLearnerOptions(optionBodies),
    explanations: {
      ...(question.explanations || {}),
      detailed: updated.explanation_l2 || '',
      eli5: updated.explanation_eli5 || '',
      points_by_option: updated.explanation_points_by_option || null,
    },
  }
}
