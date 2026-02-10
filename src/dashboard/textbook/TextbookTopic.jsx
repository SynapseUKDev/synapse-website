import {
  getBlockWrapperFromSelection,
  computeOffsetsWithinBlock,
  rangeFromOffsets,
  unwrapAllUserHighlights,
  applyHighlightToRange,
  findBestOffsets,
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

function RenderBlock({ block, query }) {
  if (block.block_type === 'image') {
    const meta = block.data || {}
    return (
      <figure className="tb-figure">
        <img src={meta.url} alt={meta.alt || ''} />
        {(meta.caption || meta.attribution) && (
          <figcaption>
            {meta.caption && <div>{meta.caption}</div>}
            {meta.attribution && <div className="tb-attr">{meta.attribution}{meta.license ? `, ${meta.license}` : ''}</div>}
          </figcaption>
        )}
      </figure>
    )
  }
  const raw = block.content || ''
  const isHtml = /<[^>]+>/.test(raw)
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
  const rendered = isHtml
    ? highlightHtml(raw, query)
    : highlightPlain(raw, query).replace(/\n/g, '<br/>')
  return <div className="tb-md" dangerouslySetInnerHTML={{ __html: rendered }} />
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
  const container = mainRef.current;
  if (!container) return;

  // clear old
  unwrapAllUserHighlights(container);

  // re-apply by block
  for (const h of highlights) {
    const blockEl = container.querySelector(`[data-tb-block-id="${h.block_id}"]`);
    if (!blockEl) continue;

    const blockText = blockEl.textContent || '';
    const offsets = findBestOffsets(blockText, h);
    if (!offsets) continue;

    const r = rangeFromOffsets(blockEl, offsets.start, offsets.end);
    if (!r) continue;

    applyHighlightToRange(r, h);
  }
}, [highlights, data?.blocks, topicQ]);

      useEffect(() => {
  const onMouseUp = (e) => {
    // ✅ If the user is clicking the toolbar/popover, don't treat it as "selection ended"
    if (
      e?.target?.closest?.('.tb-hl-toolbar') ||
      e?.target?.closest?.('.tb-hl-popover')
    ) {
      return
    }

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
setActiveNoteDraft('') // ensures we don't accidentally attach an old draft note
createHighlight({ withNote: false })

// ✅ Clear native selection (so the blue selection disappears)
try { sel.removeAllRanges() } catch {}

// ✅ Do not open toolbar
setHlToolbar((t) => ({ ...t, open: false }))
  }

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
if (!pageId) return

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
    return
  }

  const blockEl =
    (!sel || sel.isCollapsed ? null : getBlockWrapperFromSelection(sel)) ||
    range?.commonAncestorContainer?.parentElement?.closest?.('[data-tb-block-id]')

  if (!blockEl) return

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
  quote: selPayload.quote,
  start_offset: selPayload.start_offset,
  end_offset: selPayload.end_offset,
  prefix: selPayload.prefix,
  suffix: selPayload.suffix,
  note: withNote ? (activeNoteDraft || '') : null,
}

const res = await authenticatedFetch(`${API_BASE}/textbook/highlights`, {
  method: 'POST',
  body: JSON.stringify(payload),
})

if (!res.ok) {
  console.error('[HL] Failed to create highlight:', res.status)
  return
}

const json = await res.json()

if (json?.highlight) {
  setHighlights((h) => [...h, json.highlight])

  // ✅ If user clicked "Add note", immediately open the editor for the new highlight
  if (withNote) {
    setActiveHlId(json.highlight.id)
    setActiveNoteDraft(json.highlight.note || '')
    setActiveColorDraft(json.highlight.color || activeColorDraft)
  }
}

// cleanup
pendingSelectionRef.current = null
if (sel?.removeAllRanges) sel.removeAllRanges()
setHlToolbar((t) => ({ ...t, open: false }))
setActiveNoteDraft('')
}

      useEffect(() => {
  const container = mainRef.current;
  if (!container) return;

  const onClick = (e) => {
    const mark = e.target.closest?.('mark.tb-user-mark');
    if (!mark) return;

    const id = mark.dataset.hlId;
    const hl = highlights.find((x) => x.id === id);
    if (!hl) return;

    setActiveHlId(id);
    setActiveNoteDraft(hl.note || '');
    setActiveColorDraft(hl.color || 'yellow');
  };

  container.addEventListener('click', onClick);
  return () => container.removeEventListener('click', onClick);
}, [highlights]);

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
  aria-label="Highlight toolbar"
  onMouseDown={(e) => e.preventDefault()}   // ✅ keep selection alive
  onClick={(e) => e.stopPropagation()}     // ✅ don't bubble to document
>

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

    <button 
      type="button"
      className="tb-hl-btn" 
      onClick={() => createHighlight({ withNote: false })}
      >
      Highlight
    </button>

    <button 
      type="button"
      className="tb-hl-btn tb-hl-btn--note" 
      onClick={() => createHighlight({ withNote: true })}
      >
      Add note
    </button>
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
    <RenderBlock block={b} query={topicQ} />
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


