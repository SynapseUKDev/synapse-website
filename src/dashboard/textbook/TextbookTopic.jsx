import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './Textbook.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { authHeaders } from '../../auth/token'

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

function RenderBlock({ block }) {
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
  const html = block.content || ''
  const isHtml = /<[^>]+>/.test(html)
  const rendered = isHtml ? html : html.replace(/\n/g, '<br/>')
  return <div className="tb-md" dangerouslySetInnerHTML={{ __html: rendered }} />
}

export default function TextbookTopic() {
  const navigate = useNavigate()
  const { topicSlug } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [topicSlug, API_BASE])

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

  return (
    <div className="tb-page tb-page--chapter">
      <header className="tb-header">
        <div className="tb-breadcrumbs">
          <button className="tb-link" onClick={() => navigate('/dashboard/textbook')}>UKMLA Textbook</button>
          <span className="tb-sep">›</span>
          <button className="tb-link" onClick={() => navigate(`/dashboard/textbook/specialty/${data.topic?.specialties?.slug}`)}>{data.topic?.specialties?.name}</button>
          <span className="tb-sep">›</span>
          <span className="tb-current">{data.topic?.name}</span>
        </div>
        <h1 className="tb-title">{data.page?.title || data.topic?.name}</h1>
        {data.page?.summary && <p className="tb-sub">{data.page.summary}</p>}
      </header>

      <div className="tb-layout">
        <div className="tb-main">
          {topSections.map((s) => (
            <section key={s.id} id={`sec-${s.anchor_slug}`} className="tb-section">
              <h2 className="tb-section__title">{s.title}</h2>
              <div className="tb-section__content">
                {(blocksBySection[s.id] || []).map((b) => (
                  <RenderBlock key={b.id} block={b} />
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
        </aside>
      </div>
    </div>
  )
}


