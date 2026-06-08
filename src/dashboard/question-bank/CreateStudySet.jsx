import React, { useState, useRef, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { authenticatedFetch, authHeaders } from '../../auth/token'
import { LuChevronDown, LuChevronRight, LuX, LuSave, LuRefreshCw } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'
import './CreateStudySet.css'
import '../practice/Practice.css'

export default function CreateStudySet() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const isGroupMode = searchParams.get('mode') === 'group'
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const specialtiesReq = useStaleJson(`${API_BASE}/qbank/specialties`, {
    headers: authHeaders(),
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'qbank:specialties',
    transform: (t) => (Array.isArray(t.specialties) ? t.specialties : []),
  })

  const specialties = specialtiesReq.data || []
  const loading = specialtiesReq.loading && !specialtiesReq.data

  const [expandedSpecs, setExpandedSpecs] = useState(new Set())
  const [topicsBySpec, setTopicsBySpec] = useState({}) // specId -> [topics]
  const [loadingTopics, setLoadingTopics] = useState(new Set()) // specIds being loaded

  const [setName, setSetName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [wholeSpecialties, setWholeSpecialties] = useState(new Set())
  const [selectedTopics, setSelectedTopics] = useState(new Set())

  // Validation state
  const [nameError, setNameError] = useState(false)
  const [contentError, setContentError] = useState(false)
  const nameInputRef = useRef(null)
  const contentAreaRef = useRef(null)

  const selectionStats = useMemo(() => {
    let totalQuestions = 0
    let totalRemaining = 0
    let totalIncorrect = 0
    const counted = new Set()

    for (const specId of wholeSpecialties) {
      const topics = topicsBySpec[specId] || []
      for (const t of topics) {
        counted.add(t.id)
        totalQuestions += t.question_count || 0
        totalRemaining += t.remaining_count ?? 0
        totalIncorrect += t.incorrect_count ?? 0
      }
    }

    for (const topicId of selectedTopics) {
      if (counted.has(topicId)) continue
      let t = null
      for (const sid of Object.keys(topicsBySpec)) {
        t = topicsBySpec[sid]?.find((x) => x.id === topicId)
        if (t) break
      }
      if (!t) continue
      totalQuestions += t.question_count || 0
      totalRemaining += t.remaining_count ?? 0
      totalIncorrect += t.incorrect_count ?? 0
    }

    // Ready when we have an array for each whole specialty (even []). Empty ≠ "still loading".
    const needsTopicStats =
      wholeSpecialties.size > 0 &&
      [...wholeSpecialties].some((id) => !Array.isArray(topicsBySpec[id]))

    return { totalQuestions, totalRemaining, totalIncorrect, needsTopicStats }
  }, [wholeSpecialties, selectedTopics, topicsBySpec])

  const loadTopicsFor = async (specId) => {
    if (topicsBySpec[specId] || loadingTopics.has(specId)) return

    setLoadingTopics(prev => new Set(prev).add(specId))
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/specialty/${specId}/topics`)
      if (res.ok) {
        const data = await res.json()
        setTopicsBySpec(prev => ({ ...prev, [specId]: data.topics || [] }))
      } else {
        setTopicsBySpec(prev => ({ ...prev, [specId]: [] }))
      }
    } catch (e) {
      console.error(e)
      setTopicsBySpec(prev => ({ ...prev, [specId]: [] }))
    } finally {
      setLoadingTopics(prev => {
        const next = new Set(prev)
        next.delete(specId)
        return next
      })
    }
  }

  const toggleExpand = (specId) => {
    setExpandedSpecs(prev => {
      const next = new Set(prev)
      if (next.has(specId)) {
        next.delete(specId)
      } else {
        next.add(specId)
        loadTopicsFor(specId)
      }
      return next
    })
  }

  const toggleWholeSpecialty = async (specId) => {
    const isWhole = wholeSpecialties.has(specId)

    if (isWhole) {
      // Unselect whole -> Deselect everything for this specialty
      setWholeSpecialties(prev => {
        const next = new Set(prev)
        next.delete(specId)
        return next
      })
      // Also clear any individual topics for this specialty (cleanup)
      // We need to know which topics belong to this specialty to remove them from selectedTopics
      // If topics aren't loaded, we can't scrub selectedTopics easily by ID without iteration.
      // But wait, if it was "Whole", selectedTopics shouldn't have had entries for it ideally.
      // Just in case, we don't strictly need to remove them immediately if we rely on UI logic,
      // but for correctness:
      if (topicsBySpec[specId]) {
        const tIds = new Set(topicsBySpec[specId].map(t => t.id))
        setSelectedTopics(prev => {
          const next = new Set(prev)
          for (const tId of tIds) next.delete(tId)
          return next
        })
      }
    } else {
      // Select whole
      setWholeSpecialties(prev => new Set(prev).add(specId))
      loadTopicsFor(specId)
      // We can clear individual selections for this spec as they are redundant
      if (topicsBySpec[specId]) {
        const tIds = new Set(topicsBySpec[specId].map(t => t.id))
        setSelectedTopics(prev => {
          const next = new Set(prev)
          for (const tId of tIds) next.delete(tId)
          return next
        })
      }
    }
  }

  const toggleTopic = (specId, topicId) => {
    // If whole specialty is selected, we must first switch to "Partial" mode (all selected except this one)
    if (wholeSpecialties.has(specId)) {
      // We need topics loaded to do this
      if (!topicsBySpec[specId]) {
        loadTopicsFor(specId).then(() => toggleTopic(specId, topicId)) // Retry after load?
        return
      }

      // Uncheck "Whole"
      setWholeSpecialties(prev => {
        const next = new Set(prev)
        next.delete(specId)
        return next
      })

      // Add ALL topics except the one clicked
      const allT = topicsBySpec[specId] || []
      const newSelected = new Set(selectedTopics)
      allT.forEach(t => {
        if (t.id !== topicId) newSelected.add(t.id)
      })
      setSelectedTopics(newSelected)
      return
    }

    // Normal toggle
    setSelectedTopics(prev => {
      const next = new Set(prev)
      if (next.has(topicId)) {
        next.delete(topicId)
      } else {
        next.add(topicId)
      }

      // Check if we selected all -> promote to Whole?
      // Optional optimization. Let's keep it simple for now.
      return next
    })
  }

  const handleCreate = async () => {
    // Clear previous errors
    setNameError(false)
    setContentError(false)

    let hasError = false

    // Validate name
    if (!setName.trim()) {
      setNameError(true)
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      nameInputRef.current?.focus()
      hasError = true
    }

    // Validate content selection
    if (wholeSpecialties.size === 0 && selectedTopics.size === 0) {
      setContentError(true)
      if (!hasError) {
        contentAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      hasError = true
    }

    if (hasError) return

    if (selectionStats.needsTopicStats) {
      alert('Still loading topic stats for the specialties you selected. Expand each specialty or wait a moment, then try again.')
      return
    }

    setSubmitting(true)

    const items = []
    // Add whole specialties
    for (const sId of wholeSpecialties) {
      items.push({ specialty_id: sId })
    }
    // Add topics
    for (const tId of selectedTopics) {
      items.push({ topic_id: tId })
    }

    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets`, {
        method: 'POST',
        body: JSON.stringify({
          name: setName,
          items,
          color: '#3b82f6',
          practice_scope_default: 'unattempted',
          set_type: isGroupMode ? 'group' : 'solo',
        })
      })

      if (!res.ok) throw new Error('Failed to create set')

      navigate(isGroupMode ? '/dashboard/group-study' : '/dashboard/study-sets')
    } catch (e) {
      console.error(e)
      alert('Failed to create study set')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingScreen />

  return (
    <div className="create-set">
      <div className="create-set__header">
        <div className="create-set__title-row">
          <h1>{isGroupMode ? 'Create Group Study Set' : 'Create New Study Set'}</h1>
          <button className="btn btn--exit btn--icon" onClick={() => navigate(-1)}><LuX /> Cancel</button>
        </div>
        <p className="create-set__subtitle">
          {isGroupMode
            ? 'Create a study set for group sessions. It will only appear on the Group Study page.'
            : 'Combine topics from multiple specialties into a single personal study set.'}
        </p>
      </div>

      <div className="create-set__form">
        <div className={`form-group ${nameError ? 'form-group--error' : ''}`}>
          <label>Set Name {nameError && <span className="form-error-text">— Required</span>}</label>
          <input
            ref={nameInputRef}
            type="text"
            className={`form-input ${nameError ? 'form-input--error' : ''}`}
            placeholder="e.g., Finals Revision, Weak Areas, Cardio + Resp"
            value={setName}
            onChange={(e) => {
              setSetName(e.target.value)
              if (e.target.value.trim()) setNameError(false)
            }}
            autoFocus
          />
        </div>

        <div ref={contentAreaRef} className={`selection-area ${contentError ? 'selection-area--error' : ''}`}>
          <h3>Select Content {contentError && <span className="form-error-text">— Select at least one specialty or topic</span>}</h3>
          <div className="specs-list">
            {specialties.map(spec => {
              const isWhole = wholeSpecialties.has(spec.specialty_id)
              const isExpanded = expandedSpecs.has(spec.specialty_id)
              const topics = topicsBySpec[spec.specialty_id] || []
              const topicsLoaded = !!topicsBySpec[spec.specialty_id]

              // Count selected topics if not whole
              let selectedCount = 0
              if (!isWhole && topicsLoaded) {
                topics.forEach(t => {
                  if (selectedTopics.has(t.id)) selectedCount++
                })
              }

              return (
                <div key={spec.specialty_id} className={`spec-item ${isWhole ? 'is-whole' : ''}`}>
                  <div className="spec-header">
                    <button className="spec-expand" onClick={() => toggleExpand(spec.specialty_id)}>
                      {isExpanded ? <LuChevronDown /> : <LuChevronRight />}
                    </button>
                    <div className="spec-label" onClick={() => toggleExpand(spec.specialty_id)}>
                      {spec.specialty_name}
                      {!isWhole && selectedCount > 0 && <span className="spec-badge">{selectedCount} selected</span>}
                      {isWhole && <span className="spec-badge badge--all">All Selected</span>}
                    </div>
                    <div className="spec-actions">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={isWhole}
                          onChange={() => toggleWholeSpecialty(spec.specialty_id)}
                        />
                        <span className="checkbox-custom"></span>
                        Select All
                      </label>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="spec-body">
                      {!topicsLoaded && loadingTopics.has(spec.specialty_id) ? (
                        <div className="spec-loading"><LuRefreshCw className="spin" /> Loading topics...</div>
                      ) : (
                        <div className="topics-grid">
                          {topics.map(topic => {
                            const isSelected = isWhole || selectedTopics.has(topic.id)
                            return (
                              <label key={topic.id} className={`topic-item ${isSelected ? 'is-selected' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTopic(spec.specialty_id, topic.id)}
                                />
                                <span className="topic-name">{topic.name}</span>
                                <span className="topic-count">
                                  {topic.question_count} qs
                                  {topic.remaining_count === 0 ? ' · done' : ''}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {selectionStats.totalQuestions > 0 &&
          selectionStats.totalRemaining === 0 &&
          !selectionStats.needsTopicStats && (
            <p className="form-group" style={{ marginTop: 24, marginBottom: 0, color: 'var(--syn-muted)', fontSize: 15, lineHeight: 1.5 }}>
              You&apos;ve already attempted questions in this selection. After you create the set, open{' '}
              <strong>Practice Setup</strong> to choose new questions only, full review (all questions), or to mix in ones you got wrong.
            </p>
          )}
      </div>

      <div className="create-set__footer">
        <div className="summary-text">
          {wholeSpecialties.size} specialties, {selectedTopics.size} individual topics selected
        </div>
        <button
          className="btn btn--primary btn--icon"
          onClick={handleCreate}
          disabled={submitting || selectionStats.needsTopicStats}
        >
          {submitting ? 'Creating...' : 'Create Study Set'} <LuSave />
        </button>
      </div>
    </div>
  )
}

