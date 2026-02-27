import {
  getBlockWrapperFromSelection,
  computeOffsetsWithinBlock,
  injectUserHighlightsIntoHtml,
} from './textbookHighlights'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import ReportTopicIssueButton from './ReportTopicIssueButton'
import { authHeaders, authenticatedFetch } from '../../auth/token'

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

function RenderBlock({ block, query, blockHighlights = [] }) {
  if (block.block_type === 'image') {
    const data = block.data || {}
    // Backend can send either:
    // - data.images = [{ url, alt?, caption?, attribution?, license? }, ...] for a carousel (bundled images)
    // - data.url (+ optional alt, caption, attribution, license) for a single image (rendered as 1-slide carousel)
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
  const raw = block.content || ''
  const segments = parseContentWithCarousels(raw)
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlightPlain = (text, q) => {
    if (!q) return text
    const re = new RegExp(escapeRegExp(q), 'ig')
    return text.replace(re, (m) => `<mark class="tb-search-mark">${m}</mark>`)
  }
  const highlightHtml = (html, q) => {
    if (!q) return html
    const parts = html.split(/(<[^>]+>)/)
    const re = new RegExp(escapeRegExp(q), 'ig')
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (part && !part.startsWith('<')) {
        parts[i] = part.replace(re, (m) => `<mark class="tb-search-mark">${m}</mark>`)
      }
    }
    return parts.join('')
  }
  return (
    <>
      {segments.map((seg, idx) => {
        if (seg.type === 'carousel') {
          return <ImageCarousel key={idx} images={seg.images} />
        }
        const withUserHighlights = injectUserHighlightsIntoHtml(seg.content, blockHighlights)
        const isHtml = /<[^>]+>/.test(withUserHighlights)
        const rendered = isHtml
          ? highlightHtml(withUserHighlights, query)
          : highlightPlain(withUserHighlights, query).replace(/\n/g, '<br/>')
        return (
          <div key={idx} className="tb-md" dangerouslySetInnerHTML={{ __html: rendered }} />
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
  const [hlToolbar, setHlToolbar] = useState({ open: false, x: 0, y: 0 });
  const [activeHlId, setActiveHlId] = useState(null);
  const [activeNoteDraft, setActiveNoteDraft] = useState('');
  const [activeColorDraft, setActiveColorDraft] = useState('yellow');
  const lastRangeRef = useRef(null)
  const pendingSelectionRef = useRef(null)

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
          }).catch((err) => console.error('Record read failed:', err))
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

   // ===============================
  // Fetch user highlights
  // ===============================
  useEffect(() => {
    const pageId = data?.page?.id
    if (!pageId) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${pageId}`, {
  method: 'GET',
})

if (!res.ok) {
  console.error('[HL] Failed to load highlights:', res.status)
  return
}
        const json = await res.json()

        if (!cancelled) {
          setHighlights(Array.isArray(json?.highlights) ? json.highlights : [])
        }
      } catch (e) {
        console.error('Failed to load highlights', e)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [API_BASE, data?.page?.id])

  useEffect(() => {
  const onMouseUp = async (e) => {
    // ✅ If the user is clicking the toolbar/popover, don't treat it as "selection ended"
    if (
      e?.target?.closest?.('.tb-hl-toolbar') ||
      e?.target?.closest?.('.tb-hl-popover')
    ) {
      return
    }
    const clickedEl = e?.target?.nodeType === Node.TEXT_NODE ? e.target.parentElement : e?.target;
    if (clickedEl?.closest?.('mark.tb-user-mark') || clickedEl?.closest?.('span.tb-hl-wrap')) return

    const sel = window.getSelection()

    if (!sel || sel.isCollapsed) {
      setHlToolbar((t) => ({ ...t, open: false }))
      return
    }

    const blockEl = getBlockWrapperFromSelection(sel)
if (!blockEl) return

const range = sel.getRangeAt(0)

// Store a clone as backup (optional)
lastRangeRef.current = range.cloneRange()

// ✅ Compute and store deterministic offsets NOW (before re-render collapses selection)
const blockId = blockEl.getAttribute('data-tb-block-id')
const sectionAnchor = blockEl.getAttribute('data-tb-section-anchor') || ''

const { start, end, quote, prefix, suffix } = computeOffsetsWithinBlock(blockEl, range)

pendingSelectionRef.current = {
  block_id: blockId,
  section_anchor: sectionAnchor,
  start_offset: start,
  end_offset: end,
  quote,
  prefix,
  suffix,
}

// ✅ Auto-create highlight immediately (no note)
setActiveNoteDraft('') // ensure we don't accidentally attach an old note draft
const ok = await createHighlight({ withNote: false })

if (ok) {
  // Only clear selection AFTER we successfully saved the highlight
  try { sel.removeAllRanges() } catch {}
  setHlToolbar((t) => ({ ...t, open: false }))
} else {
  const rect = range.getBoundingClientRect()
  setHlToolbar({
    open: true,
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.top + window.scrollY - 10,
    mode: 'selection',
  })
}
    
  };
  // ✅ Use capture so we can intercept before other handlers collapse selection
  document.addEventListener('mouseup', onMouseUp, true)
  document.addEventListener('touchend', onMouseUp, true)

  return () => {
    document.removeEventListener('mouseup', onMouseUp, true)
    document.removeEventListener('touchend', onMouseUp, true)
  }
}, [])

      async function createHighlight({ withNote }) {
  console.log('[HL] createHighlight clicked', { withNote })
const sel = window.getSelection()
console.log('[HL] selection', {
  hasSel: !!sel,
  rangeCount: sel?.rangeCount,
  isCollapsed: sel?.isCollapsed,
  lastRange: !!lastRangeRef.current,
})

const pageId = data?.page?.id || data?.page_id || data?.id
if (!pageId) return false

// ✅ Prefer the stored selection payload (survives re-render)
let selPayload = pendingSelectionRef.current

// Fallback: if user somehow opens toolbar without stored payload
if (!selPayload) {
  const sel = window.getSelection()
  let range = null

  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
    range = sel.getRangeAt(0)
  } else if (lastRangeRef.current) {
    range = lastRangeRef.current
  } else {
    return false
  }

  const blockEl =
    (!sel || sel.isCollapsed ? null : getBlockWrapperFromSelection(sel)) ||
    range?.commonAncestorContainer?.parentElement?.closest?.('[data-tb-block-id]')

  if (!blockEl) return false

  const blockId = blockEl.getAttribute('data-tb-block-id')
  const sectionAnchor = blockEl.getAttribute('data-tb-section-anchor') || ''
  const { start, end, quote, prefix, suffix } = computeOffsetsWithinBlock(blockEl, range)

  selPayload = {
    block_id: blockId,
    section_anchor: sectionAnchor,
    start_offset: start,
    end_offset: end,
    quote,
    prefix,
    suffix,
  }
}

const payload = {
  page_id: pageId,
  section_anchor: selPayload.section_anchor,
  block_id: selPayload.block_id,
  color: activeColorDraft,
  quote: selPayload.quote?.trim() || selPayload.quote,
  start_offset: selPayload.start_offset,
  end_offset: selPayload.end_offset,
  prefix: selPayload.prefix,
  suffix: selPayload.suffix,
  note: withNote ? (activeNoteDraft || '') : null,
}

// Sync: backend returns existing highlight (with stored color) or creates new one
const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/sync`, {
  method: 'POST',
  body: JSON.stringify(payload),
})

if (!res.ok) {
  let errText = ''
  try { errText = await res.text() } catch {}
  console.error('[HL] Failed to sync highlight:', res.status, errText)
  return false
}

const json = await res.json()

if (json?.highlight) {
  const hl = json.highlight
  setHighlights((prev) => {
    const idx = prev.findIndex((h) => h.id === hl.id)
    if (idx >= 0) return prev.map((h, i) => (i === idx ? hl : h))
    return [...prev, hl]
  })

  // ✅ If user clicked "Add note", immediately open the editor for the new highlight
  if (withNote) {
    setActiveHlId(hl.id)
    setActiveNoteDraft(hl.note || '')
    setActiveColorDraft(hl.color || activeColorDraft)
  }
}

pendingSelectionRef.current = null
if (!json?.highlight) return false
if (!withNote) setActiveNoteDraft('')
return true
}

      useEffect(() => {
  const container = mainRef.current;
  if (!container) return;

  const onClick = (e) => {
  const clicked = e.target?.nodeType === Node.TEXT_NODE ? e.target.parentElement : e.target;
  const mark = clicked?.closest?.('mark.tb-user-mark') || clicked?.closest?.('span.tb-hl-wrap')?.querySelector?.('mark.tb-user-mark');
  if (!mark) return;

  const id = mark.dataset.hlId;
  if (!highlights.find((x) => x.id === id)) return;

  e.preventDefault();
  e.stopPropagation();
  const rect = mark.getBoundingClientRect();
  setHlToolbar({
    open: true,
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.top + window.scrollY - 10,
    mode: 'existing',
    highlightId: id,
  });
};

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}, [highlights]);

  async function deleteHighlightById(id) {
  if (!id) return;

  const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${id}`, {
    method: 'DELETE',
  });

  if (!res.ok) {
    console.error('[HL] Failed to delete highlight:', res.status);
    return;
  }

  setHighlights((arr) => arr.filter((h) => h.id !== id));

  // if the popover was open for this highlight, close it
  if (activeHlId === id) {
    setActiveHlId(null);
    setActiveNoteDraft('');
  }
}

      async function updateActiveHighlight() {
  const id = activeHlId;
  if (!id) return;

  const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${id}`, {
  method: 'PUT',
  body: JSON.stringify({ color: activeColorDraft, note: activeNoteDraft }),
})
if (!res.ok) {
  console.error('[HL] Failed to update highlight:', res.status)
  return
}

  const json = await res.json();
  if (!json?.highlight) return;

  setHighlights((arr) => arr.map((h) => (h.id === id ? json.highlight : h)));
}

async function deleteActiveHighlight() {
  const id = activeHlId;
  if (!id) return;

  const res = await authenticatedFetch(`${API_BASE}/textbook/highlights/${id}`, {
  method: 'DELETE',
})
if (!res.ok) {
  console.error('[HL] Failed to delete highlight:', res.status)
  return
}

  setHighlights((arr) => arr.filter((h) => h.id !== id));
  setActiveHlId(null);
}

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
          {hlToolbar.open && (
  <div
  className="tb-hl-toolbar"
  style={{ left: hlToolbar.x, top: hlToolbar.y }}
  role="dialog"
  aria-label={hlToolbar.mode === 'existing' ? 'Highlight actions' : 'Highlight toolbar'}
  onMouseDown={(e) => e.preventDefault()}
  onClick={(e) => e.stopPropagation()}
>
  {hlToolbar.mode === 'existing' ? (
    <button
      type="button"
      className="tb-hl-btn tb-hl-btn--danger"
      onClick={() => {
        if (hlToolbar.highlightId) deleteHighlightById(hlToolbar.highlightId);
        setHlToolbar((t) => ({ ...t, open: false }));
      }}
    >
      Delete
    </button>
  ) : (
    <>
      <div className="tb-hl-colors">
        {['yellow','green','pink','blue'].map((c) => (
          <button
            type="button"
            key={c}
            className={`tb-hl-color ${activeColorDraft === c ? 'is-active' : ''}`}
            onClick={() => setActiveColorDraft(c)}
            aria-label={`Highlight colour ${c}`}
          />
        ))}
      </div>
      <button type="button" className="tb-hl-btn" onClick={() => createHighlight({ withNote: false })}>Highlight</button>
      <button type="button" className="tb-hl-btn tb-hl-btn--note" onClick={() => createHighlight({ withNote: true })}>Add note</button>
    </>
  )}
  </div>
)}

{activeHlId && (
  <div className="tb-hl-popover" role="dialog" aria-label="Edit highlight">
    <div className="tb-hl-popover__row">
      <div className="tb-hl-popover__label">Note</div>
      <textarea
        className="tb-hl-popover__textarea"
        value={activeNoteDraft}
        onChange={(e) => setActiveNoteDraft(e.target.value)}
        placeholder="Add a note for this highlight…"
      />
    </div>

    <div className="tb-hl-popover__actions">
      <button type="button" className="tb-hl-btn" onClick={updateActiveHighlight}>Save</button>
      <button type="button" className="tb-hl-btn tb-hl-btn--danger" onClick={deleteActiveHighlight}>Delete</button>
      <button type="button" className="tb-hl-btn tb-hl-btn--ghost" onClick={() => setActiveHlId(null)}>Close</button>
    </div>
  </div>
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


