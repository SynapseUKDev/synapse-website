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
  
  // 1. Split into lines to handle block-level elements
  const lines = text.split('\n')
  let inList = false
  let result = []

  lines.forEach(line => {
    const trimmed = line.trim()
    
    // Headings - Should be their own blocks
    if (trimmed.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3>${trimmed.replace('### ', '')}</h3>`)
      return
    }
    if (trimmed.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2>${trimmed.replace('## ', '')}</h2>`)
      return
    }
    if (trimmed.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h1>${trimmed.replace('# ', '')}</h1>`)
      return
    }

    // Lists
    const listMatch = line.match(/^(\s*)([-*]|\d+\.)\s+(.+)$/)
    if (listMatch) {
      if (!inList) { result.push('<ul style="margin-top: 4px; margin-bottom: 4px;">'); inList = true; }
      const indent = listMatch[1].length
      const content = listMatch[3]
      // Simple indentation support via padding
      result.push(`<li style="margin-left: ${indent * 12}px; margin-bottom: 2px;">${inlineMarkdown(content)}</li>`)
      return
    }

    // Paragraph/Text
    if (inList) { result.push('</ul>'); inList = false; }
    if (trimmed) {
      result.push(`<p style="margin: 4px 0;">${inlineMarkdown(line)}</p>`)
    }
  })

  if (inList) result.push('</ul>')
  return result.join('')
}

function inlineMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
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
  const width = content?.width || 50
  return (
    <div className="osce-block--image" style={{ textAlign: 'center', margin: '12px 0', maxWidth: '100%' }}>
      <figure style={{ display: 'inline-block', width: `${width}%`, maxWidth: '100%', margin: 0 }}>
        <img src={url} alt={content.caption || ''} loading="lazy" style={{ width: '100%', height: 'auto', borderRadius: 8, display: 'block' }} />
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
