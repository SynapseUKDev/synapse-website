import React, { useState } from 'react'
import { LuCheck } from 'react-icons/lu'

/**
 * Renders a single OSCE content block based on its block_type.
 * Supported types: markdown, checklist, key_value, callout, image, table, list
 */
export default function OsceBlockRenderer({ block, interactive = false, isReviewer = false, reviewComments = [] }) {
  if (!block) return null

  switch (block.block_type) {
    case 'markdown':
      return <MarkdownBlock content={block.content} isReviewer={isReviewer} reviewComments={reviewComments} />
    case 'checklist':
      return <ChecklistBlock content={block.content} interactive={interactive} />
    case 'key_value':
      return <KeyValueBlock content={block.content} />
    case 'callout':
      return <CalloutBlock content={block.content} isReviewer={isReviewer} reviewComments={reviewComments} />
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

function MarkdownBlock({ content, isReviewer, reviewComments }) {
  const text = content?.text || ''
  // Simple markdown → HTML conversion (bold, italic, headings, links, lists)
  const html = simpleMarkdown(text)
  const finalHtml = isReviewer ? injectReviewCommentsIntoHtml(html, reviewComments) : html
  return <div className="osce-block--markdown" dangerouslySetInnerHTML={{ __html: finalHtml }} />
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

function CalloutBlock({ content, isReviewer, reviewComments }) {
  const variant = content?.variant || 'info'
  const html = content?.text || ''
  const finalHtml = isReviewer ? injectReviewCommentsIntoHtml(html, reviewComments) : html
  return (
    <div className="osce-block--callout" data-variant={variant}>
      {content?.title && <div className="osce-callout__title">{content.title}</div>}
      <div dangerouslySetInnerHTML={{ __html: finalHtml }} />
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

/* ── Inject Review Comments Helper ─────────────────── */

function injectReviewCommentsIntoHtml(html, reviewComments) {
  if (!html || !reviewComments?.length) return html
  if (typeof document === 'undefined' || typeof DOMParser === 'undefined') return html

  let doc
  try {
    doc = new DOMParser().parseFromString(`<!doctype html><body><div id="__tbroot">${html}</div>`, 'text/html')
  } catch (e) {
    return html
  }
  const root = doc.getElementById('__tbroot')
  if (!root) return html

  const collectTextNodes = () => {
    const nodes = []
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => NodeFilter.FILTER_ACCEPT,
    })
    let n
    while ((n = walker.nextNode())) nodes.push(n)
    return nodes
  }

  const buildIndex = () => {
    const tns = collectTextNodes()
    let fullText = ''
    const map = []
    for (const tn of tns) {
      const start = fullText.length
      fullText += tn.nodeValue || ''
      map.push({ node: tn, start, end: fullText.length })
    }
    return { fullText, map }
  }

  const findBestOffsets = (blockText, quote, startOffset, endOffset) => {
    const len = blockText.length
    if (typeof startOffset === 'number' && typeof endOffset === 'number') {
      let s = Math.max(0, Math.min(len, startOffset))
      let e = Math.max(s, Math.min(len, endOffset))
      if (s < e) return { start: s, end: e }
    }
    if (quote) {
      const idx = blockText.indexOf(quote)
      if (idx !== -1) return { start: idx, end: idx + quote.length }
    }
    return null
  }

  // Sort comments right-to-left
  const ordered = reviewComments
    .map((rc) => {
      const { fullText } = buildIndex()
      const off = findBestOffsets(fullText, rc.quote, rc.start_offset, rc.end_offset)
      return { rc, off }
    })
    .filter((x) => x.off)
    .sort((a, b) => b.off.start - a.off.start)

  for (const { rc, off } of ordered) {
    const { fullText, map } = buildIndex()
    if (!off || off.start >= off.end) continue

    const subRange = doc.createRange()
    let firstNode = null, lastNode = null
    let firstStart = 0, lastEnd = 0

    for (const e of map) {
      if (e.end <= off.start) continue
      if (e.start >= off.end) break
      if (!firstNode) {
        firstNode = e.node
        firstStart = off.start - e.start
      }
      lastNode = e.node
      lastEnd = off.end - e.start
    }

    if (!firstNode || !lastNode) continue

    try {
      subRange.setStart(firstNode, firstStart)
      subRange.setEnd(lastNode, lastEnd)
    } catch (e) {
      continue
    }

    if (subRange.collapsed) continue

    const mark = doc.createElement('mark')
    mark.className = 'rv-mark'
    mark.setAttribute('data-comment-id', rc.id)
    mark.setAttribute('style', 'cursor:pointer;')

    try {
      const frag = subRange.extractContents()
      mark.appendChild(frag)
      subRange.insertNode(mark)
    } catch (e) {
      continue
    }
  }

  return root.innerHTML
}
