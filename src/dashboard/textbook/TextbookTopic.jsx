import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import ReportTopicIssueButton from './ReportTopicIssueButton'
import HighlightPopover from '../../components/highlight/HighlightPopover'
import { authHeaders, authenticatedFetch } from '../../auth/token'

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
    const openTag = `<mark class="tb-user-mark tb-user-mark--${color}" data-hl-id="${id}"${noteAttr}>`
    const closeTag = '</mark>'
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
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (n.nodeValue && n.nodeValue.length > 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
  })
  const nodes = []
  let n
  while ((n = walker.nextNode())) nodes.push(n)
  return nodes
}

function computeSelectionOffsets(blockEl, range) {
  const fullText = blockEl.textContent || ''
  const nodes = walkTextNodes(blockEl)
  const getAbsOffset = (container, offset) => {
    if (container?.nodeType === Node.TEXT_NODE) {
      let cur = 0
      for (const n of nodes) {
        if (n === container) return cur + offset
        cur += n.nodeValue.length
      }
      return null
    }
    return null
  }
  const start = getAbsOffset(range.startContainer, range.startOffset)
  const end = getAbsOffset(range.endContainer, range.endOffset)
  const quote = range.toString()
  const prefix = start != null ? fullText.slice(Math.max(0, start - 30), start) : ''
  const suffix = end != null ? fullText.slice(end, Math.min(fullText.length, end + 30)) : ''
  return { start: start ?? 0, end: end ?? quote.length, quote, prefix, suffix }
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

/** Find and extract carousel div: any div with class containing "carousel". Returns { start, end, inner } or null. */
function findCarouselDiv(html) {
  const start = html.search(/<div[^>]*\bclass="[^"]*carousel[^"]*"/i)
  if (start === -1) return null
  let pos = html.indexOf('>', start) + 1
  let depth = 1
  while (depth > 0 && pos < html.length) {
    const nextOpen = html.indexOf('<div', pos)
    const nextClose = html.indexOf('</div>', pos)
    if (nextClose === -1) return null
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1
      pos = nextOpen + 4
    } else {
      depth -= 1
      pos = nextClose + 6
      if (depth === 0) {
        return { start, end: pos, inner: html.slice(html.indexOf('>', start) + 1, nextClose) }
      }
    }
  }
  return null
}

/** Extract image entries from legacy carousel inner HTML (slides with img + .cap). */
function extractImagesFromCarouselInner(inner) {
  const images = []
  const imgTagRe = /<img\s[^>]*>/gi
  const capRe = /<div[^>]*\bclass="[^"]*cap[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
  const srcAlt = []
  let m
  while ((m = imgTagRe.exec(inner)) !== null) {
    const tag = m[0]
    const src = /src="([^"]*)"/.exec(tag)
    const alt = /alt="([^"]*)"/.exec(tag)
    if (src && src[1]) srcAlt.push({ url: src[1], alt: (alt && alt[1]) ? alt[1].trim() : '' })
  }
  const caps = []
  while ((m = capRe.exec(inner)) !== null) {
    caps.push((m[1] || '').replace(/\s+/g, ' ').trim())
  }
  for (let i = 0; i < srcAlt.length; i++) {
    images.push({
      url: srcAlt[i].url,
      alt: srcAlt[i].alt,
      caption: caps[i] !== undefined ? caps[i] : '',
    })
  }
  return images
}

/** Parse HTML content into segments: html chunks and carousel data (so we can render React carousels). */
function parseContentWithCarousels(html) {
  if (!html || typeof html !== 'string') return [{ type: 'html', content: '' }]
  const segs = []
  let remaining = html
  while (remaining.length > 0) {
    const car = findCarouselDiv(remaining)
    if (!car) {
      segs.push({ type: 'html', content: remaining })
      break
    }
    if (car.start > 0) {
      segs.push({ type: 'html', content: remaining.slice(0, car.start) })
    }
    const images = extractImagesFromCarouselInner(car.inner)
    if (images.length > 0) {
      segs.push({ type: 'carousel', images })
    }
    remaining = remaining.slice(car.end)
  }
  return segs.length > 0 ? segs : [{ type: 'html', content: html }]
}

const RenderBlockContent = ({ content, highlights = [], query = '' }) => {
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Convert HTML string to React elements with highlights
  const renderContent = useMemo(() => {
    if (!content) return null

    const parser = new DOMParser()
    const doc = parser.parseFromString(content, 'text/html')
    const body = doc.body

    let currentGlobalOffset = 0

    const highlightText = (text, startOffset) => {
      let parts = []
      let lastIndex = 0
      
      const nodeStart = startOffset
      const nodeEnd = startOffset + text.length
      
      // 1. Handle User Highlights
      const activeHighlights = highlights.filter(h => 
        h.start_offset < nodeEnd && h.end_offset > nodeStart
      ).sort((a, b) => a.start_offset - b.start_offset)

      activeHighlights.forEach((hl, i) => {
        const hlStart = Math.max(0, hl.start_offset - nodeStart)
        const hlEnd = Math.min(text.length, hl.end_offset - nodeStart)
        
        if (hlStart > lastIndex) {
          parts.push({ type: 'text', content: text.slice(lastIndex, hlStart) })
        }

        parts.push({ 
          type: 'user-hl', 
          content: text.slice(hlStart, hlEnd),
          id: hl.id,
          color: hl.color,
          note: hl.note
        })
        lastIndex = hlEnd
      })

      if (lastIndex < text.length) {
        parts.push({ type: 'text', content: text.slice(lastIndex) })
      }

      // 2. Handle Search Query in 'text' parts
      if (query && query.trim()) {
        const re = new RegExp(escapeRegExp(query), 'ig')
        const newParts = []
        
        parts.forEach(p => {
          if (p.type === 'text') {
            let subIndex = 0
            const mText = p.content
            let match
            while ((match = re.exec(mText)) !== null) {
              if (match.index > subIndex) {
                newParts.push({ type: 'text', content: mText.slice(subIndex, match.index) })
              }
              newParts.push({ type: 'search-hl', content: match[0] })
              subIndex = re.lastIndex
            }
            if (subIndex < mText.length) {
              newParts.push({ type: 'text', content: mText.slice(subIndex) })
            }
          } else {
            newParts.push(p)
          }
        })
        parts = newParts
      }

      // 3. Convert Parts to React Elements
      return parts.map((p, i) => {
        if (p.type === 'text') return p.content
        if (p.type === 'user-hl') {
          const hasNoteClass = p.note ? ' hl-mark--has-note' : ''
          return (
            <mark 
              key={`hl-${p.id}-${i}`} 
              className={`hl-mark hl-mark--${p.color || 'yellow'}${hasNoteClass}`}
              data-hl-id={p.id}
            >
              {p.content}
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
      // 1. Handle Text Nodes
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent
        const isWhitespace = !text.trim()
        
        // Skip whitespace-only nodes in table contexts to avoid React errors
        if (isWhitespace && TABLE_ELEMENTS.has(parentTagName)) {
          return null
        }

        const offset = currentGlobalOffset
        currentGlobalOffset += text.length
        return highlightText(text, offset)
      }

      // 2. Handle Element Nodes
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

        // Void elements MUST NOT have children
        if (VOID_ELEMENTS.has(tagName)) {
          return React.createElement(tagName, props)
        }

        // Recursively traverse children
        const children = Array.from(node.childNodes)
          .map((child, i) => traverse(child, `${key}-${i}`, tagName))
          .filter(Boolean) // Remove nulls (like skipped whitespace)

        return React.createElement(tagName, props, children)
      }

      return null
    }

    return Array.from(body.childNodes).map((node, i) => traverse(node, `root-${i}`))
  }, [content, highlights, query])

  return <div className="tb-md">{renderContent}</div>
}

function RenderBlock({ block, query, blockHighlights = [] }) {
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

  const segments = useMemo(() => parseContentWithCarousels(block.content || ''), [block.content])

  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'carousel') {
          return <ImageCarousel key={idx} images={seg.images} />
        }
        return (
          <RenderBlockContent
            key={idx}
            content={seg.content}
            highlights={blockHighlights}
            query={query}
          />
        )
      })}
    </>
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

  // Navigation state across topics/subtopics within the same specialty
  const [navItems, setNavItems] = useState([])
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [topicQ, setTopicQ] = useState('')

  const mainRef = useRef(null);

  const [highlights, setHighlights] = useState([]);
  const [highlightsOn, setHighlightsOn] = useState(true);
  const [popoverHl, setPopoverHl] = useState(null); // highlight object for popover
  const [popoverRect, setPopoverRect] = useState(null); // anchor rect for popover

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
          }).catch(() => {})
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

  // Fetch user highlights
  useEffect(() => {
    const pageId = data?.page?.id
    if (!pageId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${pageId}`, { method: 'GET' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) setHighlights(Array.isArray(json?.highlights) ? json.highlights : [])
      } catch {}
    })()
    return () => { cancelled = true }
  }, [API_BASE, data?.page?.id])

  // Auto-highlight on text selection
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
      const { start, end, quote, prefix, suffix } = computeSelectionOffsets(blockEl, range)
      if (!quote || !quote.trim()) return

      try { sel.removeAllRanges() } catch {}

      const payload = {
        page_id: pageId,
        section_anchor: sectionAnchor,
        block_id: blockId,
        color: 'yellow',
        quote: quote.trim(),
        start_offset: start,
        end_offset: end,
        prefix,
        suffix,
        note: null,
      }

      try {
        const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/sync`, {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (!res.ok) return
        const json = await res.json()
        if (json?.highlight) {
          const newHl = json.highlight
          setHighlights((prev) => {
            const idx = prev.findIndex((h) => h.id === newHl.id)
            if (idx >= 0) return prev.map((h, i) => (i === idx ? newHl : h))
            return [...prev, newHl]
          })

          // Auto-open popover for the new highlight
          const rect = range.getBoundingClientRect()
          setPopoverRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
          setPopoverHl(newHl)
        }
      } catch {}
    }
    document.addEventListener('mouseup', onMouseUp, true)
    document.addEventListener('touchend', onMouseUp, true)
    return () => {
      document.removeEventListener('mouseup', onMouseUp, true)
      document.removeEventListener('touchend', onMouseUp, true)
    }
  }, [data?.page?.id, API_BASE])

  // Click existing highlight to open popover
  useEffect(() => {
    const container = mainRef.current
    if (!container) return
    const onClick = (e) => {
      const mark = e.target.closest?.('mark.hl-mark')
      if (!mark) return
      const id = mark.dataset.hlId
      const hl = highlights.find((x) => x.id === id)
      if (!hl) return
      e.preventDefault()
      e.stopPropagation()
      const rect = mark.getBoundingClientRect()
      setPopoverRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
      setPopoverHl(hl)
    }
    container.addEventListener('click', onClick)
    return () => container.removeEventListener('click', onClick)
  }, [highlights])

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
    } catch {}
    setPopoverHl(null)
  }, [popoverHl, API_BASE])

  const handlePopoverDelete = useCallback(async () => {
    if (!popoverHl) return
    try {
      const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${popoverHl.id}`, { method: 'DELETE' })
      if (res.ok) {
        setHighlights((arr) => arr.filter((h) => h.id !== popoverHl.id))
      }
    } catch {}
    setPopoverHl(null)
  }, [popoverHl, API_BASE])

  // Scroll to anchor if hash present
  useEffect(() => {
    if (!data) return
    const hash = location.hash && location.hash.startsWith('#') ? location.hash.slice(1) : ''
    if (!hash) return
    const el = document.getElementById(hash)
    if (el) {
      setTimeout(() => {
        try { el.scrollIntoView({ behavior: 'smooth', block: 'start' }) } catch {}
      }, 50)
    }
  }, [location.hash, data])

  // Load specialty topics to build previous/next navigation
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
        // Flatten into linear list of items that have a page
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
      } catch {}
    }
    loadNav()
    return () => { cancelled = true }
  }, [data, API_BASE])

  // Keyboard navigation
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
              onSave={handlePopoverSave}
              onDelete={handlePopoverDelete}
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
    <RenderBlock block={b} query={topicQ} blockHighlights={highlightsOn ? highlights.filter((h) => String(h.block_id) === String(b.id)) : []} />
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


