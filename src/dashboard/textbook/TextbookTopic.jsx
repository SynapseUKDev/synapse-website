import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import ReportTopicIssueButton from './ReportTopicIssueButton'
import HighlightPopover from '../../components/highlight/HighlightPopover'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { reconcileSelectionRangeToFlat, splitFlatRangeByTableCellsAndSnap } from '../../utils/questionStemHighlight'

// ---- Inline highlight injection into HTML ----

function decodeHtmlEntities(html) {
  const el = typeof document !== 'undefined' ? document.createElement('textarea') : null
  if (!el) return html
  el.innerHTML = html
  return el.value
}

function getTextSegmentsFromHtml(html) {
  const segments = []
  let fullText = ''
  let i = 0
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i + 1)
      i = end === -1 ? html.length : end + 1
      continue
    }
    const start = i
    let raw = ''
    while (i < html.length && html[i] !== '<') { raw += html[i]; i++ }
    if (raw.length > 0) {
      const textStart = fullText.length
      const decoded = decodeHtmlEntities(raw)
      fullText += decoded
      segments.push({ textStart, textEnd: fullText.length, htmlStart: start, htmlEnd: start + raw.length })
    }
  }
  return { fullText, segments }
}

function findBestOffsets(blockText, h) {
  if (!blockText) return null
  const quote = h.quote != null ? String(h.quote) : ''
  const len = blockText.length
  if (typeof h.start_offset === 'number' && typeof h.end_offset === 'number') {
    let s = Math.max(0, Math.min(len, h.start_offset))
    let e = Math.max(s, Math.min(len, h.end_offset))
    if (s < e) return { start: s, end: e }
  }
  if (quote) {
    const idx = blockText.indexOf(quote)
    if (idx !== -1) return { start: idx, end: idx + quote.length }
  }
  return null
}

function decodedOffsetToHtmlOffset(raw, decodedOffset) {
  let dec = 0, i = 0
  while (i < raw.length && dec < decodedOffset) {
    if (raw[i] === '&') {
      const semi = raw.indexOf(';', i)
      if (semi !== -1) { dec++; i = semi + 1; continue }
    }
    dec++; i++
  }
  return i
}

function injectHighlightsIntoHtml(html, highlights) {
  if (!html || !highlights?.length) return html
  const { fullText, segments } = getTextSegmentsFromHtml(html)
  if (!fullText) return html

  const insertions = []
  for (const h of highlights) {
    const offsets = findBestOffsets(fullText, h)
    if (!offsets) continue
    const color = (h.color && /^[a-z]+$/.test(h.color)) ? h.color : 'yellow'
    const id = String(h.id || '').replace(/"/g, '&quot;')
    const hasNote = h.note && h.note.trim()
    const noteAttr = hasNote ? ` data-hl-note="1"` : ''
    const openTag = `<mark class="hl-mark hl-mark--${color}${hasNote ? ' hl-mark--has-note' : ''} tb-user-mark" data-hl-id="${id}" style="cursor:pointer;"${noteAttr}>`
    const deleteBtn = `<button type="button" class="hl-mark__delete" data-tb-ignore="true" data-hl-id="${id}" title="Delete highlight">&times;</button>`
    const closeTag = `${deleteBtn}</mark>`
    for (const seg of segments) {
      const segStart = Math.max(seg.textStart, offsets.start)
      const segEnd = Math.min(seg.textEnd, offsets.end)
      if (segStart >= segEnd) continue
      const rawSeg = html.slice(seg.htmlStart, seg.htmlEnd)
      const htmlSegStart = seg.htmlStart + decodedOffsetToHtmlOffset(rawSeg, segStart - seg.textStart)
      const htmlSegEnd = seg.htmlStart + decodedOffsetToHtmlOffset(rawSeg, segEnd - seg.textStart)
      if (htmlSegStart >= htmlSegEnd) continue
      const slice = fullText.slice(segStart, segEnd)
      if (/^\s*$/.test(slice)) continue
      insertions.push({ pos: htmlSegEnd, tag: closeTag })
      insertions.push({ pos: htmlSegStart, tag: openTag })
    }
  }
  insertions.sort((a, b) => b.pos - a.pos)
  let result = html
  for (const ins of insertions) {
    result = result.slice(0, ins.pos) + ins.tag + result.slice(ins.pos)
  }
  return result
}

// ---- DOM selection helpers ----

function walkTextNodes(root) {
  const nodes = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => {
      if (n.nodeType === Node.ELEMENT_NODE && n.hasAttribute('data-tb-ignore')) {
        return NodeFilter.FILTER_REJECT
      }
      if (n.nodeType === Node.TEXT_NODE) {
        if (!n.nodeValue?.trim() && !n.nodeValue?.length) return NodeFilter.FILTER_REJECT
        if (n.parentElement?.closest?.('[data-tb-ignore]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
      return NodeFilter.FILTER_SKIP
    },
  })

  let n
  while ((n = walker.nextNode())) {
    if (n.nodeType === Node.TEXT_NODE) nodes.push(n)
  }
  return nodes
}

/**
 * Map a (container, offset) range boundary to a single index in the concatenation of
 * `textNodes`. Handles element boundaries, not just text nodes.
 */
function boundaryToFlatOffset(container, offset, textNodes) {
  if (!container) return null
  if (container.nodeType === Node.TEXT_NODE) {
    let acc = 0
    for (const tn of textNodes) {
      if (tn === container) {
        const L = (tn.nodeValue || '').length
        if (offset < 0 || offset > L) return null
        return acc + offset
      }
      acc += (tn.nodeValue || '').length
    }
    return null
  }
  const r = document.createRange()
  try {
    r.setStart(container, offset)
    r.collapse(true)
  } catch (e) {
    return null
  }
  let acc = 0
  for (const tn of textNodes) {
    const L = (tn.nodeValue || '').length
    for (let i = 0; i <= L; i++) {
      try {
        if (r.comparePoint(tn, i) === 0) {
          return acc + i
        }
      } catch (err) {
        // not comparable; try next
      }
    }
    acc += L
  }
  return null
}

function nbs(s) {
  return (s == null ? '' : String(s)).replace(/\u00a0/g, ' ')
}

function computeSelectionOffsets(blockEl, range) {
  const nodes = walkTextNodes(blockEl)
  const fullText = nodes.map(n => n.nodeValue).join('')

  const qRaw = range.toString()
  let start = boundaryToFlatOffset(range.startContainer, range.startOffset, nodes)
  let end = boundaryToFlatOffset(range.endContainer, range.endOffset, nodes)
  const nQ = nbs(qRaw)

  if (start == null && end != null && nQ.length > 0) {
    const a = end - qRaw.length
    if (a >= 0 && nbs(fullText.slice(a, end)) === nQ) start = a
  }
  if (end == null && start != null && nQ.length > 0) {
    const b = start + qRaw.length
    if (b <= fullText.length && nbs(fullText.slice(start, b)) === nQ) end = b
  }

  if (start == null && end == null && nQ.length > 0) {
    const flat = nbs(fullText)
    let idx = fullText.indexOf(qRaw)
    if (idx === -1) idx = flat.indexOf(nQ)
    if (idx !== -1) {
      const len = qRaw.length
      if (idx + len <= fullText.length) {
        start = idx
        end = idx + len
      }
    }
  }
  if (start == null) start = 0
  if (end == null) {
    if (nQ.length > 0) {
      const b = start + qRaw.length
      if (b <= fullText.length && nbs(fullText.slice(start, b)) === nQ) {
        end = b
      } else {
        const flat = nbs(fullText)
        const idx = flat.indexOf(nQ, start)
        if (idx !== -1) {
          start = idx
          end = idx + qRaw.length
        } else {
          end = Math.min(fullText.length, start + qRaw.length)
        }
      }
    } else {
      end = start
    }
  }
  if (end < start) {
    const t = start
    start = end
    end = t
  }

  const quote = qRaw
  const prefix = start != null ? fullText.slice(Math.max(0, start - 30), start) : ''
  const suffix = end != null ? fullText.slice(end, Math.min(fullText.length, end + 30)) : ''
  return { start, end, quote, prefix, suffix, fullText, textNodes: nodes }
}

/** Join split ranges that are only broken at element boundaries (no characters between), not bold/italic–specific. */
function mergeContiguousSplitRanges(ranges) {
  const sorted = ranges
    .filter((r) => r && r.end > r.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
  if (sorted.length <= 1) return sorted
  const out = [sorted[0]]
  for (let k = 1; k < sorted.length; k++) {
    const r = sorted[k]
    const last = out[out.length - 1]
    if (r.start < last.end) {
      last.end = Math.max(last.end, r.end)
      continue
    }
    if (r.start === last.end) last.end = r.end
    else out.push(r)
  }
  return out
}

/**
 * Renders pre-built HTML (with injectHighlightsIntoHtml) and delegates clicks to match React <mark> behaviour.
 */
/** Clicks on &times; often hit a TextNode; TextNode has no .closest. */
function elementFromEventTarget(t) {
  if (!t) return null
  if (t.nodeType === Node.ELEMENT_NODE) return t
  if (t.nodeType === Node.TEXT_NODE) return t.parentElement
  return null
}

function InjectedTbMd({ html, highlights, onHighlightClick, onDeleteHighlight }) {
  const onClick = useCallback(
    (e) => {
      const el = elementFromEventTarget(e.target)
      const del = el?.closest?.('button.hl-mark__delete')
      if (del) {
        e.preventDefault()
        e.stopPropagation()
        const hid = del.getAttribute('data-hl-id')
        if (hid != null && hid !== '') onDeleteHighlight(hid)
        return
      }
      const mark = el?.closest?.('mark.tb-user-mark')
      if (mark) {
        e.preventDefault()
        e.stopPropagation()
        const hid = mark.getAttribute('data-hl-id')
        const hl = highlights.find((h) => String(h.id) === String(hid))
        if (hl) onHighlightClick(hl, mark.getBoundingClientRect())
      }
    },
    [highlights, onDeleteHighlight, onHighlightClick]
  )

  return <div className="tb-md" onClick={onClick} dangerouslySetInnerHTML={{ __html: html }} />
}

function AnchorNav({ sections, hasReferences }) {
  const navigateTo = (anchor) => {
    const el = document.getElementById(`sec-${anchor}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  return (
    <div className="tb-anchors">
      <div className="tb-anchors__title">Chapter Sections</div>
      {sections.filter(s => !s.parent_section_id).map((s) => (
        <button key={s.id} className="tb-anchors__item" onClick={() => navigateTo(s.anchor_slug)}>
          {s.title}
        </button>
      ))}
      {hasReferences && (
        <button className="tb-anchors__item" onClick={() => navigateTo('references')}>
          References
        </button>
      )}
    </div>
  )
}

function ImageCarousel({ images }) {
  const [idx, setIdx] = useState(0)
  const n = Math.max(0, images.length)
  const i = n === 0 ? 0 : ((idx % n) + n) % n
  const cur = images[i]
  const prev = () => setIdx((j) => (n > 0 ? (j - 1 + n) % n : 0))
  const next = () => setIdx((j) => (n > 0 ? (j + 1) % n : 0))
  if (!cur) return null
  return (
    <div className="tb-carousel" role="region" aria-label="Image carousel">
      <button
        type="button"
        className="tb-carousel__nav tb-carousel__prev"
        onClick={prev}
        aria-label="Previous image"
        disabled={n <= 1}
      >
        ‹
      </button>
      <figure className="tb-carousel__asset">
        <img src={cur.url} alt={cur.alt || ''} loading="lazy" decoding="async" />
        {(cur.caption || cur.attribution) && (
          <figcaption className="tb-carousel__cap">
            {cur.caption && <div className="tb-carousel__caption">{cur.caption}</div>}
            {cur.attribution && <div className="tb-attr">{cur.attribution}{cur.license ? `, ${cur.license}` : ''}</div>}
          </figcaption>
        )}
      </figure>
      <button
        type="button"
        className="tb-carousel__nav tb-carousel__next"
        onClick={next}
        aria-label="Next image"
        disabled={n <= 1}
      >
        ›
      </button>
      {n > 1 && (
        <div className="tb-carousel__dots" role="tablist" aria-label="Image selector">
          {images.map((_, di) => (
            <button
              key={di}
              type="button"
              role="tab"
              className={`tb-carousel__dot ${di === i ? 'is-active' : ''}`}
              aria-label={`Go to image ${di + 1}`}
              aria-selected={di === i}
              onClick={() => setIdx(di)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function RenderBlockContent({ content, highlights = [], query = '', onHighlightClick = () => { }, onDeleteHighlight = () => { } }) {
  const hasQuery = Boolean(query && String(query).trim())
  const hasHl = Array.isArray(highlights) && highlights.length > 0

  // Search in paragraph must stay on the React parse path (splits by text node).
  const searchTree = useMemo(() => {
    if (!content) return null
    if (!hasQuery) return null
    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const body = doc.body
    let currentGlobalOffset = 0

    const highlightText = (text, nodeStart) => {
      const nodeEnd = nodeStart + text.length
      const activeHighlights = highlights
        .filter(hl => hl.start_offset < nodeEnd && hl.end_offset > nodeStart)
        .sort((a, b) => a.start_offset - b.start_offset)

      if (activeHighlights.length === 0 && !query) return text

      const parts = []
      let lastIndex = 0

      activeHighlights.forEach((hl, i) => {
        const hlStart = Math.max(0, hl.start_offset - nodeStart)
        const hlEnd = Math.min(text.length, hl.end_offset - nodeStart)

        if (hlStart < lastIndex) return

        if (hlStart > lastIndex) {
          const gapText = text.slice(lastIndex, hlStart)
          if (!query) {
            parts.push({ type: 'text', content: gapText })
          } else {
            const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(`(${escaped})`, 'gi')
            const gParts = gapText.split(regex)
            gParts.forEach((gp, j) => {
              if (gp.toLowerCase() === query.toLowerCase()) {
                parts.push({ type: 'search-hl', content: gp })
              } else if (gp) {
                parts.push({ type: 'text', content: gp })
              }
            })
          }
        }

        parts.push({
          type: 'user-hl',
          content: text.slice(hlStart, hlEnd),
          color: hl.color || 'yellow',
          hasNote: !!hl.note,
          id: hl.id,
          hlObj: hl
        })
        lastIndex = hlEnd
      })

      if (lastIndex < text.length) {
        const remaining = text.slice(lastIndex)
        if (!query) {
          parts.push({ type: 'text', content: remaining })
        } else {
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const regex = new RegExp(`(${escaped})`, 'gi')
          const gParts = remaining.split(regex)
          gParts.forEach((gp) => {
            if (gp.toLowerCase() === query.toLowerCase()) {
              parts.push({ type: 'search-hl', content: gp })
            } else if (gp) {
              parts.push({ type: 'text', content: gp })
            }
          })
        }
      }

      return parts.map((p, i) => {
        if (p.type === 'text') return p.content
        if (p.type === 'user-hl') {
          return (
            <mark
              key={`user-${p.id}-${i}`}
              className={`hl-mark hl-mark--${p.color}${p.hasNote ? ' hl-mark--has-note' : ''} tb-user-mark`}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const rect = e.target.getBoundingClientRect()
                onHighlightClick(p.hlObj, rect)
              }}
              style={{ cursor: 'pointer' }}
            >
              {p.content}
              <button
                className="hl-mark__delete"
                data-tb-ignore="true"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onDeleteHighlight(p.id)
                }}
                title="Delete highlight"
              >
                &times;
              </button>
            </mark>
          )
        }
        if (p.type === 'search-hl') return (
          <mark key={`search-${i}`} className="tb-search-mark">
            {p.content}
          </mark>
        )
        return null
      })
    }

    const VOID_ELEMENTS = new Set(['img', 'br', 'hr', 'input', 'col', 'meta', 'link'])
    const TABLE_ELEMENTS = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup'])

    const traverse = (node, key, parentTagName = '') => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent
        const isWhitespace = !text.trim()
        if (isWhitespace && TABLE_ELEMENTS.has(parentTagName)) return null
        const offset = currentGlobalOffset
        currentGlobalOffset += text.length
        return highlightText(text, offset)
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        const tagName = node.tagName.toLowerCase()
        const props = { key }
        if (node.id) props.id = node.id
        if (node.className) props.className = node.className
        if (tagName === 'a') props.href = node.getAttribute('href')
        if (tagName === 'img') {
          props.src = node.getAttribute('src')
          props.alt = node.getAttribute('alt')
        }
        if (VOID_ELEMENTS.has(tagName)) return React.createElement(tagName, props)
        const children = Array.from(node.childNodes)
          .map((child, i) => traverse(child, `${key}-${i}`, tagName))
          .filter(Boolean)
        return React.createElement(tagName, props, children)
      }
      return null
    }

    return Array.from(body.childNodes).map((node, i) => traverse(node, `root-${i}`))
  }, [content, highlights, hasQuery, query, onHighlightClick, onDeleteHighlight])

  if (!content) return null
  if (hasQuery) {
    return <div className="tb-md">{searchTree}</div>
  }
  if (hasHl) {
    return (
      <InjectedTbMd
        html={injectHighlightsIntoHtml(content, highlights)}
        highlights={highlights}
        onHighlightClick={onHighlightClick}
        onDeleteHighlight={onDeleteHighlight}
      />
    )
  }
  return <div className="tb-md" dangerouslySetInnerHTML={{ __html: content }} />
}

function RenderBlock({ block, query, blockHighlights = [], onHighlightClick = () => { }, onDeleteHighlight = () => { } }) {
  if (block.block_type === 'image') {
    const data = block.data || {}
    const images = Array.isArray(data.images) && data.images.length > 0
      ? data.images.map((im) => ({
        url: im.url,
        alt: im.alt ?? '',
        caption: im.caption ?? data.caption,
        attribution: im.attribution ?? data.attribution,
        license: im.license ?? data.license,
      }))
      : data.url
        ? [{ url: data.url, alt: data.alt ?? '', caption: data.caption, attribution: data.attribution, license: data.license }]
        : []
    if (images.length > 0) {
      return <ImageCarousel images={images} />
    }
    return null
  }

  return (
    <div className="tb-block">
      <RenderBlockContent
        content={block.content}
        highlights={blockHighlights}
        query={query}
        onHighlightClick={onHighlightClick}
        onDeleteHighlight={onDeleteHighlight}
      />
    </div>
  )
}

export default function TextbookTopic() {
  const navigate = useNavigate()
  const { topicSlug } = useParams()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const [navItems, setNavItems] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [topicQ, setTopicQ] = useState('')

  const mainRef = useRef(null);

  const [highlights, setHighlights] = useState([]);
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [popoverHl, setPopoverHl] = useState(null);
  const [popoverRect, setPopoverRect] = useState(null);

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`${API_BASE}/textbook/${topicSlug}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
        if (!res.ok) throw new Error(`Failed to load chapter: ${res.status}`)
        const json = await res.json()
        if (!cancelled) setData(json)
        if (!cancelled && topicSlug) {
          fetch(`${API_BASE}/textbook/record-read`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            body: JSON.stringify({ topic_slug: topicSlug }),
          }).catch(() => { })
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [topicSlug, API_BASE])

  useEffect(() => {
    const pageId = data?.page?.id
    if (!pageId) return
    let cancelled = false
      ; (async () => {
        try {
          const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${pageId}`, { method: 'GET' })
          if (!res.ok) return
          const json = await res.json()
          if (!cancelled) setHighlights(Array.isArray(json?.highlights) ? json.highlights : [])
        } catch { }
      })()
    return () => { cancelled = true }
  }, [API_BASE, data?.page?.id])

  useEffect(() => {
    const onMouseUp = async (e) => {
      if (e?.target?.closest?.('.hl-popover') || e?.target?.closest?.('.hl-popover-backdrop')) return
      const clickedEl = e?.target?.nodeType === Node.TEXT_NODE ? e.target.parentElement : e?.target
      if (clickedEl?.closest?.('mark.tb-user-mark')) return

      const sel = window.getSelection()
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return

      const range = sel.getRangeAt(0)
      const node = range.commonAncestorContainer?.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer?.parentElement
      const blockEl = node?.closest?.('[data-tb-block-id]')
      if (!blockEl) return

      const pageId = data?.page?.id
      if (!pageId) return

      const blockId = blockEl.getAttribute('data-tb-block-id')
      const sectionAnchor = blockEl.getAttribute('data-tb-section-anchor') || ''
      const { start, end, quote: rawQuote, fullText, textNodes } = computeSelectionOffsets(blockEl, range)
      if (!rawQuote || !rawQuote.trim()) return

      let rawLo = Math.min(start, end)
      let rawHi = Math.max(start, end)
      if (e.type === 'mouseup' && e.detail === 2) {
        const r = reconcileSelectionRangeToFlat(fullText, rawLo, rawHi, rawQuote)
        rawLo = r.start
        rawHi = r.end
        if (rawLo >= rawHi) return
      }
      const snappedRanges = splitFlatRangeByTableCellsAndSnap(
        blockEl,
        fullText,
        rawLo,
        rawHi,
        textNodes
      )
      const rangesToCreate = mergeContiguousSplitRanges(snappedRanges)
      if (rangesToCreate.length === 0) return

      const selectionRect = range.getBoundingClientRect()
      try {
        sel.removeAllRanges()
      } catch { }

      const created = []
      const deletedIds = new Set()

      for (let i = 0; i < rangesToCreate.length; i++) {
        const seg = rangesToCreate[i]
        const wordStart = seg.start
        const wordEnd = seg.end
        const snappedQuote = fullText.slice(wordStart, wordEnd)

        const overlapping = highlights.filter(
          (h) =>
            h.block_id === blockId &&
            !deletedIds.has(h.id) &&
            h.start_offset < wordEnd &&
            h.end_offset > wordStart
        )

        let finalStart = wordStart
        let finalEnd = wordEnd
        let finalQuote = snappedQuote

        if (overlapping.length > 0) {
          finalStart = Math.min(wordStart, ...overlapping.map((h) => h.start_offset))
          finalEnd = Math.max(wordEnd, ...overlapping.map((h) => h.end_offset))
          finalQuote = fullText.slice(finalStart, finalEnd)

          await Promise.all(
            overlapping.map((oh) =>
              authenticatedFetch(`${API_BASE}/textbook/highlights/${oh.id}`, { method: 'DELETE' }).catch((err) => {
                console.error('Failed to delete overlapping highlight:', err)
              })
            )
          )
          overlapping.forEach((oh) => deletedIds.add(oh.id))
        }

        const payload = {
          page_id: pageId,
          section_anchor: sectionAnchor,
          block_id: blockId,
          color: 'yellow',
          quote: finalQuote.trim(),
          start_offset: finalStart,
          end_offset: finalEnd,
          prefix: fullText.slice(Math.max(0, finalStart - 30), finalStart),
          suffix: fullText.slice(finalEnd, Math.min(fullText.length, finalEnd + 30)),
          note: null,
        }

        try {
          const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/sync`, {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          if (!res.ok) continue
          const json = await res.json()
          if (json?.highlight) created.push(json.highlight)
        } catch { }
      }

      if (created.length > 0) {
        setHighlights((prev) => {
          const filtered = prev.filter((h) => !deletedIds.has(h.id))
          return [...filtered, ...created]
        })

        setPopoverRect({
          top: selectionRect.top,
          left: selectionRect.left,
          width: selectionRect.width,
          height: selectionRect.height,
        })
        setPopoverHl(created[created.length - 1])
      }
    }
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('touchend', onMouseUp, true)
    return () => {
      document.removeEventListener('mouseup', onMouseUp, true)
      document.removeEventListener('touchend', onMouseUp, true)
    }
  }, [data?.page?.id, API_BASE, highlights])

  const handleDeleteHighlight = async (hlId) => {
    try {
      const idForUrl = encodeURIComponent(String(hlId))
      const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${idForUrl}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete highlight')

      setHighlights((prev) => prev.filter((h) => String(h.id) !== String(hlId)))
      if (popoverHl && String(popoverHl.id) === String(hlId)) {
        setPopoverHl(null)
        setPopoverRect(null)
      }
    } catch (e) {
      console.error('Error deleting highlight:', e)
    }
  }

  const handlePopoverSave = useCallback(async ({ note, color }) => {
    if (!popoverHl) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${popoverHl.id}`, {
        method: 'PUT',
        body: JSON.stringify({ color, note }),
      })
      if (res.ok) {
        const json = await res.json()
        if (json?.highlight) {
          setHighlights((arr) => arr.map((h) => (h.id === popoverHl.id ? json.highlight : h)))
        }
      }
    } catch { }
    setPopoverHl(null)
  }, [popoverHl, API_BASE])

  useEffect(() => {
    if (!data) return
    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      setTimeout(() => {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch { }
      }, 50)
    }
  }, [location.hash, data])

  useEffect(() => {
    if (!data?.topic?.specialties?.slug) return
    let cancelled = false
    async function loadNav() {
      try {
        const specSlug = data.topic.specialties.slug
        const res = await fetch(`${API_BASE}/textbook/specialty/${specSlug}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...authHeaders() } })
        if (!res.ok) return
        const json = await res.json()
        const topics = Array.isArray(json?.topics) ? json.topics : []
        const items = []
        const pushIfHasPage = (label, slug, hasPage, pages) => {
          const has = !!hasPage || (Array.isArray(pages) && pages.length > 0)
          if (has) items.push({ name: label, slug })
        }
        const walkSubtopics = (nodes) => {
          for (const n of nodes || []) {
            pushIfHasPage(n.name, n.slug, n.has_page, n.textbook_pages)
            if (Array.isArray(n.children) && n.children.length > 0) walkSubtopics(n.children)
          }
        }
        for (const t of topics) {
          if (t.has_subtopics && Array.isArray(t.subtopics) && t.subtopics.length > 0) {
            walkSubtopics(t.subtopics)
          } else {
            pushIfHasPage(t.name, t.slug, t.has_page, t.textbook_pages)
          }
        }
        if (!cancelled) {
          setNavItems(items)
          const curr = data?.subtopic?.slug || data?.topic?.slug
          const idx = items.findIndex((it) => it.slug === curr)
          setCurrentIdx(idx)
        }
      } catch { }
    }
    loadNav()
    return () => { cancelled = true }
  }, [data, API_BASE])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft' && currentIdx > 0) {
        const prev = navItems[currentIdx - 1]
        if (prev?.slug) navigate(`/dashboard/textbook/topic/${prev.slug}`)
      }
      if (e.key === 'ArrowRight' && currentIdx >= 0 && currentIdx < navItems.length - 1) {
        const next = navItems[currentIdx + 1]
        if (next?.slug) navigate(`/dashboard/textbook/topic/${next.slug}`)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [currentIdx, navItems])

  const blocksBySection = useMemo(() => {
    const map = {}
    if (data?.blocks) {
      for (const b of data.blocks) {
        if (!map[b.section_id]) map[b.section_id] = []
        map[b.section_id].push(b)
      }
    }
    return map
  }, [data])

  const formatType = (t) => {
    if (!t) return null
    const str = String(t).replace(/_/g, ' ')
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  if (loading) {
    return (
      <div className="tb-page tb-page--chapter">
        <LoadingScreen message="Loading chapter…" inline />
      </div>
    )
  }
  if (error) return <div className="tb-error">{error}</div>
  if (!data) return null

  const topSections = (data.sections || []).filter((s) => !s.parent_section_id)
  const isSubtopic = !!data.subtopic
  const specialty = (data.topic && data.topic.specialties) ? data.topic.specialties : data.topic?.specialties
  const topicName = data.topic?.name
  const currentName = isSubtopic ? data.subtopic?.name : data.topic?.name
  const prevItem = currentIdx > 0 ? navItems[currentIdx - 1] : null
  const nextItem = (currentIdx >= 0 && currentIdx < navItems.length - 1) ? navItems[currentIdx + 1] : null

  return (
    <div className="tb-page tb-page--chapter">
      <header className="tb-header">
        <div className="tb-breadcrumbs">
          <button className="tb-link" onClick={() => navigate('/dashboard/textbook')}>UKMLA Textbook</button>
          <span className="tb-sep">›</span>
          <button className="tb-link" onClick={() => navigate(`/dashboard/textbook/specialty/${specialty?.slug}`)}>{specialty?.name}</button>
          {isSubtopic && (
            <>
              <span className="tb-sep">›</span>
              <button className="tb-link" onClick={() => navigate(`/dashboard/textbook/specialty/${specialty?.slug}`)}>{topicName}</button>
            </>
          )}
          <span className="tb-sep">›</span>
          <span className="tb-current">{currentName}</span>
        </div>
        <h1 className="tb-title">{data.page?.title || currentName}</h1>
        {data.page?.summary && <p className="tb-sub">{data.page.summary}</p>}
        <form className="tb-search" onSubmit={(e) => e.preventDefault()} role="search" aria-label="Search in chapter">
          <input
            className="tb-search__input"
            type="search"
            placeholder="Search within this chapter…"
            value={topicQ}
            onChange={(e) => setTopicQ(e.target.value)}
            aria-label="Search query in chapter"
          />
        </form>
        <div className="tb-header__actions">
          <button
            type="button"
            className={`tb-highlights-toggle ${highlightsOn ? 'is-on' : ''}`}
            onClick={() => setHighlightsOn((on) => !on)}
            title={highlightsOn ? 'Hide highlights' : 'Show highlights'}
            aria-pressed={highlightsOn}
          >
            {highlightsOn ? 'Hide highlights' : 'Show highlights'}
          </button>
          <ReportTopicIssueButton topicSlug={topicSlug} API_BASE={API_BASE} />
        </div>
      </header>

      <div className="tb-layout">
        <div className="tb-main" ref={mainRef}>
          {popoverHl && popoverRect && (
            <HighlightPopover
              anchorRect={popoverRect}
              highlight={popoverHl}
              showColors={true}
              showNote={true}
              onSave={handlePopoverSave}
              onClose={() => setPopoverHl(null)}
            />
          )}

          {topSections.map((s) => (
            <section key={s.id} id={`sec-${s.anchor_slug}`} className="tb-section">
              <h2 className="tb-section__title">{s.title}</h2>
              <div className="tb-section__content">
                {(blocksBySection[s.id] || []).map((b) => (
                  <div
                    key={b.id}
                    className="tb-block"
                    data-tb-block-id={b.id}
                    data-tb-section-anchor={s.anchor_slug}
                  >
                    <RenderBlock
                      block={b}
                      query={topicQ}
                      blockHighlights={highlightsOn ? highlights.filter((h) => String(h.block_id) === String(b.id)) : []}
                      onHighlightClick={(hl, rect) => {
                        setPopoverHl(hl)
                        setPopoverRect(rect)
                      }}
                      onDeleteHighlight={handleDeleteHighlight}
                    />
                  </div>
                ))}
              </div>
            </section>
          ))}

          {Array.isArray(data.citations) && data.citations.length > 0 && (
            <section className="tb-section tb-section--refs" id="sec-references">
              <h2 className="tb-section__title">References</h2>
              <ol className="tb-refs">
                {data.citations.map((c) => (
                  <li key={c.id} className="tb-ref">
                    <div className="tb-ref__row">
                      {c.url ? (
                        <a className="tb-ref__label" href={c.url} target="_blank" rel="noreferrer noopener">{c.label || c.raw_citation}</a>
                      ) : (
                        <span className="tb-ref__label">{c.label || c.raw_citation}</span>
                      )}
                    </div>
                    <div className="tb-ref__meta">
                      {c.source_type && <span className="tb-ref__badge">{formatType(c.source_type)}</span>}
                      {c.publisher && <span className="tb-ref__dot">•</span>}
                      {c.publisher && <span className="tb-ref__publisher">{c.publisher}</span>}
                      {c.year && <span className="tb-ref__dot">•</span>}
                      {c.year && <span className="tb-ref__year">{c.year}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <aside className="tb-aside">
          <AnchorNav sections={data.sections || []} hasReferences={Array.isArray(data.citations) && data.citations.length > 0} />
          {(prevItem || nextItem) && (
            <div className="tb-nav tb-nav--aside">
              {prevItem && (
                <button
                  className="tb-nav__btn tb-nav__btn--wide tb-nav__btn--left"
                  onClick={() => navigate(`/dashboard/textbook/topic/${prevItem.slug}`)}
                  aria-label={`Previous: ${prevItem.name}`}
                  title={`Previous: ${prevItem.name}`}
                >
                  <span className="tb-nav__chev">‹</span>
                  <div className="tb-nav__text">
                    <div className="tb-nav__meta">Previous</div>
                  </div>
                </button>
              )}
              {nextItem && (
                <button
                  className="tb-nav__btn tb-nav__btn--wide tb-nav__btn--right"
                  onClick={() => navigate(`/dashboard/textbook/topic/${nextItem.slug}`)}
                  aria-label={`Next: ${nextItem.name}`}
                  title={`Next: ${nextItem.name}`}
                >
                  <div className="tb-nav__text">
                    <div className="tb-nav__meta">Next</div>
                  </div>
                  <span className="tb-nav__chev">›</span>
                </button>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}


