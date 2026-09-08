import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LuBookOpen, LuCheck, LuChevronDown, LuChevronRight, LuListChecks, LuLoader, LuRotateCcw, LuX } from 'react-icons/lu'
import { authenticatedFetch } from '../auth/token'
import { invalidateStaleJson, readStaleJson, writeStaleJson } from '../utils/useStaleJson'
import './Settings.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const AREAS = [
  {
    id: 'qbank',
    label: 'Question bank',
    Icon: LuListChecks,
    allTitle: 'Everything in the question bank',
    allCopy: 'Clears every question you have answered, so they show as unattempted again.',
    specificCopy: 'Reset one specialty, or drill into individual topics.',
  },
  {
    id: 'textbook',
    label: 'Textbook',
    Icon: LuBookOpen,
    allTitle: 'Everything in the textbook',
    allCopy: 'Clears reading progress and confidence. Highlights and notes are kept.',
    specificCopy: 'Reset one specialty, or individual conditions.',
  },
]

function topicCoveredBySpecialty(topicId, specialty, wholeSpecialties) {
  return wholeSpecialties.has(specialty.id) && specialty.topics.some((t) => t.id === topicId)
}

function selectionSummary(area, scope, specialties, wholeSpecialties, selectedTopics) {
  const noun = area === 'qbank' ? 'question attempts' : 'textbook progress'
  if (scope === 'all') return `all ${noun}`

  const specNames = specialties
    .filter((s) => wholeSpecialties.has(s.id))
    .map((s) => s.name)
  const topicNames = []
  for (const spec of specialties) {
    for (const topic of spec.topics) {
      if (selectedTopics.has(topic.id) && !wholeSpecialties.has(spec.id)) {
        topicNames.push(topic.name)
      }
    }
  }

  const parts = [...specNames, ...topicNames]
  if (parts.length === 0) return noun
  if (parts.length === 1) return `${noun} for ${parts[0]}`
  if (parts.length === 2) return `${noun} for ${parts[0]} and ${parts[1]}`
  return `${noun} for ${parts[0]} and ${parts.length - 1} more`
}

function bustProgressCaches(area, payload) {
  const specialtyIds = payload.specialty_ids || []
  const topicIds = payload.topic_ids || []
  const all = specialtyIds.length === 0 && topicIds.length === 0

  if (area === 'qbank') {
    const list = readStaleJson('qbank:specialties')
    if (Array.isArray(list) && (all || specialtyIds.length > 0)) {
      const hit = new Set(specialtyIds)
      writeStaleJson(
        'qbank:specialties',
        list.map((item) => {
          if (!all && !hit.has(item.specialty_id)) return item
          return {
            ...item,
            completed_questions: 0,
            correct_questions: 0,
            accuracy_pct: 0,
            attempted_count: 0,
            last_studied: null,
          }
        })
      )
    } else {
      invalidateStaleJson('qbank:specialties')
    }

    if (all) {
      writeStaleJson('qbank:summary', { total_answered: 0, accuracy_pct: 0, avg_time_ms: 0 })
    } else {
      invalidateStaleJson('qbank:summary')
    }
  }

  invalidateStaleJson(['dashboard:', 'analytics:'])
}

export default function ResetProgressCard() {
  const [area, setArea] = useState('qbank')
  const [scope, setScope] = useState('all')
  const [specialties, setSpecialties] = useState([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeError, setTreeError] = useState('')
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())
  const [wholeSpecialties, setWholeSpecialties] = useState(() => new Set())
  const [selectedTopics, setSelectedTopics] = useState(() => new Set())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const treeRequested = useRef(false)

  const areaMeta = AREAS.find((item) => item.id === area) || AREAS[0]
  const hasSelection = scope === 'all' || wholeSpecialties.size > 0 || selectedTopics.size > 0

  useEffect(() => {
    if (!confirmOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [confirmOpen])

  const loadTree = useCallback(async () => {
    if (treeRequested.current) return
    treeRequested.current = true
    setTreeLoading(true)
    setTreeError('')
    try {
      const res = await authenticatedFetch(`${API_BASE}/me/progress/tree`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load specialties')
      const body = await res.json()
      setSpecialties(Array.isArray(body.specialties) ? body.specialties : [])
    } catch {
      treeRequested.current = false
      setTreeError('Could not load specialties. Try again in a moment.')
    } finally {
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (scope === 'selected') loadTree()
  }, [scope, loadTree])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return specialties
    return specialties
      .map((spec) => {
        const specMatch = spec.name.toLowerCase().includes(needle)
        const topics = spec.topics.filter((t) => t.name.toLowerCase().includes(needle))
        if (specMatch) return spec
        if (topics.length === 0) return null
        return { ...spec, topics }
      })
      .filter(Boolean)
  }, [specialties, query])

  const toggleSpecialty = (spec) => {
    setWholeSpecialties((prev) => {
      const next = new Set(prev)
      if (next.has(spec.id)) next.delete(spec.id)
      else next.add(spec.id)
      return next
    })
    setSelectedTopics((prev) => {
      const next = new Set(prev)
      for (const topic of spec.topics) next.delete(topic.id)
      return next
    })
  }

  const toggleTopic = (spec, topicId) => {
    if (wholeSpecialties.has(spec.id)) {
      setWholeSpecialties((prev) => {
        const next = new Set(prev)
        next.delete(spec.id)
        return next
      })
      setSelectedTopics((prev) => {
        const next = new Set(prev)
        for (const topic of spec.topics) {
          if (topic.id !== topicId) next.add(topic.id)
        }
        return next
      })
      return
    }

    setSelectedTopics((prev) => {
      const next = new Set(prev)
      if (next.has(topicId)) next.delete(topicId)
      else next.add(topicId)
      return next
    })
  }

  const topicChecked = (spec, topicId) =>
    wholeSpecialties.has(spec.id) || selectedTopics.has(topicId)

  const toggleExpand = (specId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(specId)) next.delete(specId)
      else next.add(specId)
      return next
    })
  }

  const summary = selectionSummary(area, scope, specialties, wholeSpecialties, selectedTopics)

  const runReset = async () => {
    if (busy || !hasSelection) return
    setBusy(true)
    setMessage({ type: '', text: '' })
    try {
      const payload = { area }
      if (scope === 'selected') {
        payload.specialty_ids = [...wholeSpecialties]
        payload.topic_ids = [...selectedTopics].filter(
          (topicId) => !specialties.some((spec) => topicCoveredBySpecialty(topicId, spec, wholeSpecialties))
        )
      }
      const res = await authenticatedFetch(`${API_BASE}/me/progress/reset`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to reset progress')
      }
      setConfirmOpen(false)
      bustProgressCaches(area, payload)
      setMessage({
        type: 'success',
        text: area === 'qbank' ? 'Question attempts reset.' : 'Textbook progress reset.',
      })
      setTimeout(() => setMessage({ type: '', text: '' }), 4000)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to reset progress' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="qb-card spr-card">
      <div className="qb-card__head">
        <div className="qb-card__titlewrap">
          <div className="qb-card__icon spr__icon">
            <LuRotateCcw size={20} />
          </div>
          <div>
            <div className="qb-card__title">Reset progress</div>
          </div>
        </div>
      </div>

      <div className="spr">
        <p className="spr__intro">
          Start a specialty or topic again without deleting your account. This only affects your own attempts and
          reading progress.
        </p>

        <div className="spr__pills" role="tablist" aria-label="What to reset">
          {AREAS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={area === id}
              className={`spr__pill ${area === id ? 'is-active' : ''}`}
              onClick={() => setArea(id)}
            >
              <Icon size={16} aria-hidden />
              {label}
            </button>
          ))}
        </div>

        <div className="spr__scopes" role="radiogroup" aria-label="How much to reset">
          <label className={`spr__scope ${scope === 'all' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="reset-scope"
              checked={scope === 'all'}
              onChange={() => setScope('all')}
            />
            <span>
              <span className="spr__scope-title">{areaMeta.allTitle}</span>
              <span className="spr__scope-copy">{areaMeta.allCopy}</span>
            </span>
          </label>
          <label className={`spr__scope ${scope === 'selected' ? 'is-active' : ''}`}>
            <input
              type="radio"
              name="reset-scope"
              checked={scope === 'selected'}
              onChange={() => setScope('selected')}
            />
            <span>
              <span className="spr__scope-title">Specific specialties or topics</span>
              <span className="spr__scope-copy">{areaMeta.specificCopy}</span>
            </span>
          </label>
        </div>

        {scope === 'selected' && (
          <div className="spr__picker">
            <input
              type="search"
              className="spr__search"
              placeholder="Search specialties or topics"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search specialties or topics"
            />
            <div className="spr__list">
              {treeLoading && <div className="spr__loading">Loading specialties…</div>}
              {!treeLoading && treeError && (
                <div className="spr__empty">
                  {treeError}{' '}
                  <button type="button" className="spr__retry" onClick={loadTree}>
                    Retry
                  </button>
                </div>
              )}
              {!treeLoading && !treeError && filtered.length === 0 && (
                <div className="spr__empty">No specialties match that search.</div>
              )}
              {!treeLoading &&
                filtered.map((spec) => {
                  const open = expanded.has(spec.id) || query.trim().length > 0
                  return (
                    <div key={spec.id} className="spr__spec">
                      <div className="spr__spec-row">
                        <input
                          type="checkbox"
                          className="spr__check"
                          checked={wholeSpecialties.has(spec.id)}
                          onChange={() => toggleSpecialty(spec)}
                          aria-label={`Reset all of ${spec.name}`}
                        />
                        <span className="spr__spec-name">{spec.name}</span>
                        <span className="spr__spec-count">{spec.topics.length}</span>
                        <button
                          type="button"
                          className="spr__chev"
                          onClick={() => toggleExpand(spec.id)}
                          aria-expanded={open}
                          aria-label={`${open ? 'Hide' : 'Show'} topics in ${spec.name}`}
                        >
                          {open ? <LuChevronDown size={16} /> : <LuChevronRight size={16} />}
                        </button>
                      </div>
                      {open && (
                        <div className="spr__topics">
                          {spec.topics.map((topic) => (
                            <label key={topic.id} className="spr__topic">
                              <input
                                type="checkbox"
                                className="spr__check"
                                checked={topicChecked(spec, topic.id)}
                                onChange={() => toggleTopic(spec, topic.id)}
                              />
                              {topic.name}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        <div className="spr__foot">
          <p className="spr__hint">This cannot be undone. Dashboard stats from these attempts will change.</p>
          <button
            type="button"
            className="qb-btn qb-btn--sm qb-btn--danger"
            style={{ width: 'auto' }}
            disabled={!hasSelection}
            onClick={() => {
              setMessage({ type: '', text: '' })
              setConfirmOpen(true)
            }}
          >
            Reset {areaMeta.label.toLowerCase()}
          </button>
        </div>

        {message.text && (
          <div className={`spr__message ${message.type === 'success' ? 'is-ok' : 'is-err'}`}>
            {message.type === 'success' ? <LuCheck size={16} /> : <LuX size={16} />}
            {message.text}
          </div>
        )}
      </div>

      {confirmOpen && (
        <div className="delete-confirm-overlay">
          <div
            className="delete-confirm-backdrop"
            onClick={() => !busy && setConfirmOpen(false)}
          />
          <div className="delete-confirm-container">
            <div className="delete-confirm-card">
              <div className="delete-confirm-icon-wrapper spr-confirm__icon">
                <LuRotateCcw size={26} />
              </div>
              <h2 className="delete-confirm-title">Reset {summary}?</h2>
              <p className="delete-confirm-text">
                {area === 'qbank'
                  ? 'Those questions will count as unattempted again. Analytics built from them will drop.'
                  : 'Reading status and confidence will go back to not read. Highlights are kept.'}
              </p>
              {message.type === 'error' && message.text && (
                <div className="consent-modal-error-box" style={{ margin: '0 0 12px' }}>
                  <span>{message.text}</span>
                </div>
              )}
              <div className="delete-confirm-actions">
                <button
                  type="button"
                  className="delete-confirm-btn-cancel"
                  disabled={busy}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="delete-confirm-btn-danger"
                  disabled={busy}
                  onClick={runReset}
                >
                  {busy ? (
                    <>
                      <LuLoader className="consent-modal-spinner" size={16} />
                      Resetting...
                    </>
                  ) : (
                    'Reset'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
