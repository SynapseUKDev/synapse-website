import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authenticatedFetch } from '../../auth/token'
import { LuChevronDown, LuChevronRight, LuX, LuSave, LuRefreshCw } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import './CreateStudySet.css'

export default function CreateStudySet() {
  const navigate = useNavigate()
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const [loading, setLoading] = useState(true)
  const [specialties, setSpecialties] = useState([])
  const [expandedSpecs, setExpandedSpecs] = useState(new Set())
  const [topicsBySpec, setTopicsBySpec] = useState({}) // specId -> [topics]
  const [loadingTopics, setLoadingTopics] = useState(new Set()) // specIds being loaded

  const [setName, setSetName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [wholeSpecialties, setWholeSpecialties] = useState(new Set())
  const [selectedTopics, setSelectedTopics] = useState(new Set())

  useEffect(() => {
    loadSpecialties()
  }, [])

  const loadSpecialties = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/specialties`)
      if (res.ok) {
        const data = await res.json()
        setSpecialties(data.specialties || [])
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const loadTopicsFor = async (specId) => {
    if (topicsBySpec[specId] || loadingTopics.has(specId)) return
    
    setLoadingTopics(prev => new Set(prev).add(specId))
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/specialty/${specId}/topics`)
      if (res.ok) {
        const data = await res.json()
        setTopicsBySpec(prev => ({ ...prev, [specId]: data.topics || [] }))
      }
    } catch (e) {
      console.error(e)
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
    if (!setName.trim()) {
      alert('Please enter a name for your study set')
      return
    }
    if (wholeSpecialties.size === 0 && selectedTopics.size === 0) {
      alert('Please select at least one specialty or topic')
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
          color: '#3b82f6' // default blue for now
        })
      })
      
      if (!res.ok) throw new Error('Failed to create set')
      
      navigate('/dashboard/question-bank')
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
          <h1>Create New Study Set</h1>
          <button className="btn btn--ghost" onClick={() => navigate(-1)}><LuX /> Cancel</button>
        </div>
        <p className="create-set__subtitle">Combine topics from multiple specialties into a single personal study set.</p>
      </div>

      <div className="create-set__form">
        <div className="form-group">
          <label>Set Name</label>
          <input 
            type="text" 
            className="form-input" 
            placeholder="e.g., Finals Revision, Weak Areas, Cardio + Resp"
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            autoFocus
          />
        </div>

        <div className="selection-area">
          <h3>Select Content</h3>
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
                                <span className="topic-count">{topic.remaining_count ?? topic.question_count} qs</span>
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
      </div>

      <div className="create-set__footer">
        <div className="summary-text">
          {wholeSpecialties.size} specialties, {selectedTopics.size} individual topics selected
        </div>
        <button 
          className="btn btn--primary" 
          onClick={handleCreate}
          disabled={submitting || (!setName.trim()) || (wholeSpecialties.size === 0 && selectedTopics.size === 0)}
        >
          {submitting ? 'Creating...' : 'Create Study Set'} <LuSave />
        </button>
      </div>
    </div>
  )
}

