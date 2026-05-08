import React, { useState } from 'react'
import { LuCheck } from 'react-icons/lu'

/**
 * Renders a single OSCE content block based on its block_type.
 * Supported types: markdown, checklist, key_value, callout, image, table, list
 */
export default function OsceBlockRenderer({ block, interactive = false }) {
  if (!block) return null

  switch (block.block_type) {
    case 'markdown':
      return <MarkdownBlock content={block.content} />
    case 'checklist':
      return <ChecklistBlock content={block.content} interactive={interactive} />
    case 'key_value':
      return <KeyValueBlock content={block.content} />
    case 'callout':
      return <CalloutBlock content={block.content} />
    case 'image':
      return <ImageBlock content={block.content} />
    case 'table':
      return <TableBlock content={block.content} />
    case 'list':
      return <ListBlock content={block.content} />
    default:
      return <div className="osce-block--markdown"><pre>{JSON.stringify(block.content, null, 2)}</pre></div>
  }
}

/* ── Markdown ──────────────────────────────────────── */

function MarkdownBlock({ content }) {
  const text = content?.text || ''
  // Simple markdown → HTML conversion (bold, italic, headings, links, lists)
  const html = simpleMarkdown(text)
  return <div className="osce-block--markdown" dangerouslySetInnerHTML={{ __html: html }} />
}

function simpleMarkdown(text) {
  if (!text) return ''
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Headings (### → h3, ## → h2, # → h1)
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists (lines starting with - )
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Numbered lists (lines starting with 1. 2. etc)
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    // Line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br/>')

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*?<\/li>(\s*<br\/>)?)+/g, (match) => {
    return '<ul>' + match.replace(/<br\/>/g, '') + '</ul>'
  })

  return '<p>' + html + '</p>'
}

/* ── Checklist ─────────────────────────────────────── */

function ChecklistBlock({ content, interactive }) {
  const items = content?.items || []
  const [checked, setChecked] = useState({})

  const toggle = (idx) => {
    if (!interactive) return
    setChecked((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  return (
    <div className="osce-block--checklist">
      {items.map((item, idx) => (
        <div key={idx} className="osce-checklist__item" onClick={() => toggle(idx)}>
          <div className={`osce-checklist__checkbox ${checked[idx] ? 'osce-checklist__checkbox--checked' : ''}`}>
            {checked[idx] && <LuCheck size={12} color="white" />}
          </div>
          <span>
            {item.label || item}
            {item.required && <span className="osce-checklist__required">*</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

/* ── Key-Value ─────────────────────────────────────── */

function KeyValueBlock({ content }) {
  const pairs = content?.pairs || []
  return (
    <div className="osce-block--kv">
      {pairs.map((pair, idx) => (
        <React.Fragment key={idx}>
          <div className="osce-kv__key">{pair.key}:</div>
          <div className="osce-kv__value">{pair.value}</div>
        </React.Fragment>
      ))}
    </div>
  )
}

/* ── Callout ───────────────────────────────────────── */

function CalloutBlock({ content }) {
  const variant = content?.variant || 'info'
  return (
    <div className="osce-block--callout" data-variant={variant}>
      {content?.title && <div className="osce-callout__title">{content.title}</div>}
      <div>{content?.text || ''}</div>
    </div>
  )
}

/* ── Image ─────────────────────────────────────────── */

function ImageBlock({ content }) {
  const url = content?.url
  if (!url) return null
  const width = content?.width || 100
  return (
    <div className="osce-block--image" style={{ textAlign: 'center' }}>
      <figure style={{ display: 'inline-block', width: `${width}%`, maxWidth: '100%' }}>
        <img src={url} alt={content.caption || ''} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
        {content.caption && <figcaption style={{ marginTop: 8, fontSize: '0.9em', color: 'var(--syn-muted)' }}>{content.caption}</figcaption>}
      </figure>
    </div>
  )
}

/* ── Table ─────────────────────────────────────────── */

function TableBlock({ content }) {
  const headers = content?.headers || []
  const rows = content?.rows || []
  return (
    <div className="osce-block--table">
      <table>
        {headers.length > 0 && (
          <thead>
            <tr>{headers.map((h, i) => <th key={i}>{h}</th>)}</tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri}>{(Array.isArray(row) ? row : []).map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── List ──────────────────────────────────────────── */

function ListBlock({ content }) {
  const items = content?.items || []
  const ordered = content?.ordered || false
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className="osce-block--list">
      {items.map((item, idx) => <li key={idx}>{item}</li>)}
    </Tag>
  )
}
