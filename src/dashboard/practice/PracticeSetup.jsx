import React, { useEffect, useState } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LuChevronLeft, LuPlay, LuUsers } from 'react-icons/lu'
import './PracticeSetup.css'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import {
  clearStudySetQuestionIdsPrefetch,
  setStudySetQuestionIdsPrefetch,
} from '../question-bank/studySetPrefetchStore'

export default function PracticeSetup() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const specialtyId = searchParams.get('specialty_id')
  const specialtyName = searchParams.get('specialty_name') || 'Unknown Specialty'
  const studySetId = searchParams.get('study_set_id')
  const studySetName = searchParams.get('study_set_name') || 'Unknown Set'

  const [loading, setLoading] = useState(true)
  const [studySetError, setStudySetError] = useState(null)
  const [topics, setTopics] = useState([])
  const [selectedTopics, setSelectedTopics] = useState(new Set())
  const [numQuestions, setNumQuestions] = useState(25)
  const [timerMinutes, setTimerMinutes] = useState(30)
  const [timerEnabled, setTimerEnabled] = useState(false)
  const [includeAttempted, setIncludeAttempted] = useState(() => searchParams.get('include_attempted') === '1')
  const [includeIncorrect, setIncludeIncorrect] = useState(() => {
    return (
      searchParams.get('include_incorrect') === '1' ||
      searchParams.get('incorrect_only') === '1'
    )
  })
  const [studySetData, setStudySetData] = useState(null)
  const [studySetPrefetch, setStudySetPrefetch] = useState({
    /** idle = not started, loading = fetching pages, ready = all ids in store, error = soft-fail (session still works) */
    status: 'idle',
    loaded: 0,
    error: null,
  })
  const [specialtyAttemptedCount, setSpecialtyAttemptedCount] = useState(null)
  const [specialtyTotalQuestions, setSpecialtyTotalQuestions] = useState(null)

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    if (studySetId) {
      clearStudySetQuestionIdsPrefetch(studySetId)
      loadStudySet()
    } else if (specialtyId) {
      loadTopics()
    } else {
      navigate('/dashboard/question-bank')
    }
  }, [specialtyId, studySetId])

  const loadStudySet = async () => {
    setStudySetError(null)
    setStudySetData(null)
    clearStudySetQuestionIdsPrefetch(studySetId)
    setStudySetPrefetch({ status: 'idle', loaded: 0, error: null })
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/sets/${encodeURIComponent(studySetId)}`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) {
        const t = await res.text()
        throw new Error(t || 'Failed to load study set')
      }
      const data = await res.json()
      const set = data.set
      if (!set || typeof set.total_questions !== 'number') {
        throw new Error('Could not load question counts for this study set. Try again or update the app.')
      }

      const poolScopeItems = (set.items || []).map((i) =>
        i.topic_id
          ? {
              scope: 'topic',
              topic_name: i.topic_name ?? i.topic_id,
              specialty_name: i.specialty_name ?? i.specialty_id ?? null,
            }
          : {
              scope: 'whole_specialty',
              specialty_name: i.specialty_name ?? i.specialty_id ?? null,
              note: 'All active questions under this specialty are in the pool',
            }
      )
      console.log('[practice-setup] study set question pool — topics / specialties we fetch', {
        study_set_id: studySetId,
        study_set_name: studySetName,
        item_count: poolScopeItems.length,
        items: poolScopeItems,
      })

      setStudySetData(set)

      const paramIncAtt = searchParams.get('include_attempted') === '1'
      const paramIncInc =
        searchParams.get('include_incorrect') === '1' || searchParams.get('incorrect_only') === '1'

      let effectiveAttempted = false
      let effectiveIncorrect = false
      if (paramIncAtt || paramIncInc) {
        effectiveAttempted = paramIncAtt
        effectiveIncorrect = paramIncInc && !paramIncAtt
      } else {
        const scope = set?.practice_scope_default
        if (scope === 'all_answered') {
          effectiveAttempted = true
          effectiveIncorrect = false
        } else if (scope === 'incorrect_focus' || set?.incorrect_only) {
          effectiveIncorrect = true
          effectiveAttempted = false
        }
      }

      setIncludeAttempted(effectiveAttempted)
      setIncludeIncorrect(effectiveIncorrect)

      // "new only" → only unattempted questions are available.
      // Do NOT fall back to total_questions — if remaining is 0 (all done), the correct answer IS 0.
      const totalAvailable =
        effectiveIncorrect && !effectiveAttempted
          ? (set.remaining_questions ?? 0) + (set.incorrect_questions ?? 0)
          : effectiveAttempted
            ? (set.total_questions ?? 0)
            : (set.remaining_questions ?? 0)

      const tot = set.total_questions ?? 0
      const rem = set.remaining_questions ?? 0
      const inc = set.incorrect_questions ?? 0
      const attemptedInSet = Math.max(0, tot - rem)
      const initialSessionSize = totalAvailable > 0 ? Math.min(totalAvailable, 25) : 0

      console.log('[practice-setup] study set counts (first fetch after Start Set)', {
        study_set_id: studySetId,
        study_set_name: studySetName,
        from_api: {
          total_questions: tot,
          remaining_questions: rem,
          incorrect_questions: inc,
        },
        derived: {
          attempted_in_pool: attemptedInSet,
          new_unattempted: rem,
        },
        default_scope: {
          practice_scope_default: set.practice_scope_default,
          incorrect_only_legacy: set.incorrect_only,
        },
        toggles_applied: {
          include_previously_answered: effectiveAttempted,
          include_incorrect_with_new: effectiveIncorrect,
        },
        ui: {
          total_available_for_mode: totalAvailable,
          initial_num_questions_input: initialSessionSize,
        },
      })

      setNumQuestions(initialSessionSize)
    } catch (error) {
      console.error('Error loading study set:', error)
      setStudySetError(error?.message || 'Failed to load study set')
      setStudySetData(null)
    } finally {
      setLoading(false)
    }
  }

  /** Background: paginate all question ids for this study set while user adjusts settings. */
  useEffect(() => {
    if (!studySetId || studySetData == null) return
    if (typeof studySetData.total_questions !== 'number') return

    const setId = String(studySetId)
    let cancelled = false
    const total = studySetData.total_questions

    setStudySetPrefetch({ status: 'loading', loaded: 0, error: null })

    ;(async () => {
      const ids = []
      try {
        let offset = 0
        const limit = 500
        let iterations = 0
        const maxIterations = Math.min(200, Math.ceil((total || 5000) / limit) + 5)
        while (!cancelled && iterations < maxIterations) {
          iterations += 1
          const res = await authenticatedFetch(
            `${API_BASE}/qbank/sets/${encodeURIComponent(setId)}/question-ids-chunk?offset=${offset}&limit=${limit}`,
            { credentials: 'include', headers: authHeaders() }
          )
          if (!res.ok) {
            const errText = await res.text()
            throw new Error(errText || 'Prefetch failed')
          }
          const j = await res.json()
          const chunk = Array.isArray(j.ids) ? j.ids : []
          ids.push(...chunk)
          if (!cancelled) {
            setStudySetPrefetch({ status: 'loading', loaded: ids.length, error: null })
          }
          const complete = j.complete === true || chunk.length < limit
          if (complete) break
          offset += chunk.length
        }
        if (cancelled) return
        if (iterations >= maxIterations) {
          throw new Error('Prefetch stopped after too many pages (contact support).')
        }
        if (total > 0 && ids.length !== total) {
          console.warn(
            `Study set prefetch count mismatch: loaded ${ids.length}, expected ${total} (continuing with loaded ids)`
          )
        }
        setStudySetQuestionIdsPrefetch(setId, ids)
        setStudySetPrefetch({ status: 'ready', loaded: ids.length, error: null })
      } catch (e) {
        console.error('Study set question prefetch:', e)
        if (!cancelled) {
          clearStudySetQuestionIdsPrefetch(setId)
          setStudySetPrefetch({
            status: 'error',
            loaded: ids.length,
            error: e?.message || 'Prefetch failed',
          })
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [studySetId, studySetData])

  const loadTopics = async () => {
    try {
      const res = await fetch(`${API_BASE}/qbank/specialty/${specialtyId}/topics`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error('Failed to load topics')
      const data = await res.json()
      setTopics(data.topics || [])
      setSpecialtyAttemptedCount(typeof data.specialty_attempted_count === 'number' ? data.specialty_attempted_count : null)
      setSpecialtyTotalQuestions(typeof data.specialty_total_questions === 'number' ? data.specialty_total_questions : null)

      // Select all topics by default
      const allTopicIds = new Set(data.topics?.map(t => t.id) || [])
      setSelectedTopics(allTopicIds)

      const preferIncludeIncorrect =
        searchParams.get('include_incorrect') === '1' || searchParams.get('incorrect_only') === '1'
      if (preferIncludeIncorrect) setIncludeIncorrect(true)
      const totalAvailable =
        preferIncludeIncorrect && !includeAttempted
          ? (data.topics || []).reduce(
              (sum, t) => sum + (t.remaining_count || 0) + (t.incorrect_count || 0),
              0
            )
          : (data.topics || []).reduce(
              (sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)),
              0
            )
      if (totalAvailable > 0) {
        setNumQuestions(Math.min(totalAvailable, 25))
      } else {
        setNumQuestions(0)
      }
    } catch (error) {
      console.error('Error loading topics:', error)
      setTopics([])
    } finally {
      setLoading(false)
    }
  }

  const toggleTopic = (topicId) => {
    const newSelected = new Set(selectedTopics)
    if (newSelected.has(topicId)) {
      newSelected.delete(topicId)
    } else {
      newSelected.add(topicId)
    }
    setSelectedTopics(newSelected)

    // Update question count when topics change
    const newTotalAvailable = topics
      .filter(t => newSelected.has(t.id))
      .reduce((sum, t) => {
        if (includeIncorrect && !includeAttempted) {
          return sum + (t.remaining_count || 0) + (t.incorrect_count || 0)
        }
        return sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0))
      }, 0)

    if (newTotalAvailable === 0) {
      setNumQuestions(0)
    } else if (numQuestions === 0 || numQuestions > newTotalAvailable) {
      setNumQuestions(newTotalAvailable)
    }
  }

  const updateSliderProgress = (value, min, max) => {
    const progress = ((value - min) / (max - min)) * 100
    return progress
  }

  const selectAllTopics = () => {
    const allTopicIds = new Set(topics.map(t => t.id))
    setSelectedTopics(allTopicIds)
  }

  const clearAllTopics = () => {
    setSelectedTopics(new Set())
    setNumQuestions(0)
  }

  const getTotalQuestions = () => {
    if (studySetId) {
      if (includeAttempted) return studySetData?.total_questions ?? 0
      if (includeIncorrect) {
        // new + incorrectly-answered-but-never-correct
        return (studySetData?.remaining_questions ?? 0) + (studySetData?.incorrect_questions ?? 0)
      }
      // "new only" — strictly unattempted; NEVER fall back to total
      return studySetData?.remaining_questions ?? 0
    }
    if (includeIncorrect && !includeAttempted) {
      return topics
        .filter(t => selectedTopics.has(t.id))
        .reduce((sum, t) => sum + (t.remaining_count || 0) + (t.incorrect_count || 0), 0)
    }
    return topics
      .filter(t => selectedTopics.has(t.id))
      .reduce((sum, t) => sum + (includeAttempted ? (t.question_count || 0) : (t.remaining_count || 0)), 0)
  }

  const getStepperMin = () => {
    const total = getTotalQuestions()
    return total > 0 ? 1 : 0
  }

  const startSession = () => {
    if (!studySetId && selectedTopics.size === 0) {
      alert('Please select at least one topic')
      return
    }

    const params = new URLSearchParams({
      num_questions: numQuestions.toString(),
      timer_minutes: timerEnabled ? timerMinutes.toString() : '0',
      include_attempted: includeAttempted ? '1' : '0'
    })
    if (includeIncorrect && !includeAttempted) params.set('include_incorrect', '1')

    if (studySetId) {
      params.append('study_set_id', studySetId)
      params.append('study_set_name', studySetName)
    } else {
      params.append('specialty_id', specialtyId)
      params.append('specialty_name', specialtyName)
      params.append('topic_ids', Array.from(selectedTopics).join(','))
    }

    navigate(`/dashboard/question-bank/practice?${params.toString()}`)
  }

  const startGroupSession = () => {
    if (!studySetId && selectedTopics.size === 0) {
      alert('Please select at least one topic')
      return
    }

    const params = new URLSearchParams({
      num_questions: numQuestions.toString(),
      timer_minutes: timerEnabled ? timerMinutes.toString() : '0',
      include_attempted: includeAttempted ? '1' : '0',
    })
    if (includeIncorrect && !includeAttempted) params.set('include_incorrect', '1')

    if (studySetId) {
      params.append('study_set_id', studySetId)
      params.append('study_set_name', studySetName)
    } else {
      params.append('specialty_id', specialtyId)
      params.append('specialty_name', specialtyName)
      params.append('topic_ids', Array.from(selectedTopics).join(','))
    }

    navigate(`/dashboard/question-bank/group_setup?${params.toString()}`)
  }

  if (loading) {
    return (
      <LoadingScreen
        message={
          studySetId
            ? 'Loading your study set and counting questions…'
            : 'Loading practice setup…'
        }
      />
    )
  }

  if (studySetId && studySetError) {
    return (
      <div className="setup">
        <div className="setup__header">
          <button type="button" className="setup__back" onClick={() => navigate('/dashboard/question-bank')}>
            <LuChevronLeft />
            Back to Question Bank
          </button>
          <div className="setup__title-section">
            <h1 className="setup__title">{studySetName}</h1>
            <p className="setup__subtitle">Could not open practice setup</p>
          </div>
        </div>
        <div className="setup__content" style={{ padding: '24px 0' }}>
          <p style={{ marginBottom: 16 }}>{studySetError}</p>
          <button
            type="button"
            className="setup__start-btn"
            onClick={() => {
              setLoading(true)
              loadStudySet()
            }}
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (studySetId && !studySetData) {
    return <LoadingScreen message="Loading your study set…" />
  }

  const totalAvailable = getTotalQuestions()
  const maxQuestions = totalAvailable
  const stepperMin = getStepperMin()
  const isDisabled = totalAvailable === 0

  return (
    <div className="setup">
      <div className="setup__header">
        <button
          className="setup__back"
          onClick={() => navigate('/dashboard/question-bank')}
        >
          <LuChevronLeft />
          Back to Question Bank
        </button>
        <div className="setup__title-section">
          <div>
            <h1 className="setup__title">{studySetId ? studySetName : specialtyName} Practice Setup</h1>
            <p className="setup__subtitle">
              {!studySetId && specialtyAttemptedCount !== null && specialtyTotalQuestions !== null
                ? `${specialtyAttemptedCount}/${specialtyTotalQuestions} attempted in this specialty • Configure your session`
                : studySetId && studySetData
                  ? (() => {
                      const rem = studySetData.remaining_questions ?? 0
                      const tot = studySetData.total_questions ?? 0
                      const inc = studySetData.incorrect_questions ?? 0
                      const attempted = tot - rem
                      return `${tot} question${tot === 1 ? '' : 's'} in this set • ${attempted} attempted, ${rem} new${inc > 0 ? `, ${inc} incorrect` : ''}`
                    })()
                  : 'Configure your study session'}
            </p>
          </div>
        </div>
      </div>

      <div className="setup__content">
        <div className="setup__main">
          {!studySetId && (
            <div className="setup__section">
              <div className="setup__section-header">
                <div>
                  <h2 className="setup__section-title">Select Topics</h2>
                  <p className="setup__section-subtitle">Choose specific areas to focus on</p>
                </div>
                <div className="setup__topic-actions">
                  <button className="setup__topic-action" onClick={selectAllTopics}>
                    Select All
                  </button>
                  <button className="setup__topic-action" onClick={clearAllTopics}>
                    Clear All
                  </button>
                </div>
              </div>

              <div className="setup__topics">
                {topics.map((topic) => (
                  <label key={topic.id} className="setup__topic">
                    <input
                      type="checkbox"
                      checked={selectedTopics.has(topic.id)}
                      onChange={() => toggleTopic(topic.id)}
                      className="setup__topic-checkbox"
                    />
                    <span className="setup__checkbox" aria-hidden="true" />
                    <div className="setup__topic-content">
                      <div className="setup__topic-name">{topic.name}</div>
                      <div className="setup__topic-count">
                        {typeof topic.attempted_count === 'number' ? (
                          <>
                            {topic.attempted_count}/{topic.question_count} done{topic.remaining_count !== undefined ? ` • ${topic.remaining_count} left` : ''}
                            {typeof topic.incorrect_count === 'number' && topic.incorrect_count > 0
                              ? ` • ${topic.incorrect_count} incorrect`
                              : ''}
                          </>
                        ) : (
                          <>{topic.question_count} questions available</>
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="setup__section">
            <h2 className="setup__section-title">Question Settings</h2>
            <p className="setup__section-subtitle">
              Choose which questions count toward this session. You can use one option or combine them: turn on{' '}
              <strong>Include previously answered</strong> for full review (every question in scope), or leave it off and turn on{' '}
              <strong>Include incorrectly answered</strong> to mix new questions with ones you still have not answered correctly.
            </p>

            <div className="qs-grid">
              <div className="qs-col">
                <div className="setup__setting">
                  <label className="setup__setting-label">
                    Number of Questions
                  </label>
                  <div className="setup__qty">
                    <div className="qty__control">
                      <button className="qty__btn" disabled={isDisabled || numQuestions <= stepperMin} onClick={() => setNumQuestions(Math.max(stepperMin, numQuestions - 1))}>−</button>
                      <input
                        type="number"
                        className="qty__input"
                        value={numQuestions}
                        min={stepperMin}
                        max={maxQuestions}
                        disabled={isDisabled}
                        onChange={(e) => {
                          const v = parseInt(e.target.value || '0', 10)
                          if (Number.isNaN(v)) return
                          setNumQuestions(Math.max(stepperMin, Math.min(maxQuestions, v)))
                        }}
                      />
                      <button className="qty__btn" disabled={isDisabled || numQuestions >= maxQuestions} onClick={() => setNumQuestions(Math.min(maxQuestions, numQuestions + 1))}>+</button>
                    </div>
                    <div className="qty__chips">
                      {[10, 25, 50, 100, 200].filter(n => n <= maxQuestions).map(n => (
                        <button key={n} className={`chip ${numQuestions === n ? 'is-active' : ''}`} disabled={isDisabled} onClick={() => setNumQuestions(n)}>{n}</button>
                      ))}
                      <button className={`chip ${numQuestions === maxQuestions ? 'is-active' : ''}`} disabled={isDisabled} onClick={() => setNumQuestions(maxQuestions)}>Max</button>
                    </div>
                  </div>
                  <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                    <label htmlFor="include-toggle" className="setup__toggle-label">Include previously answered</label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="include-toggle"
                        checked={includeAttempted}
                        onChange={(e) => {
                          const next = e.target.checked
                          const oldMax = getTotalQuestions()
                          if (next) setIncludeIncorrect(false)
                          setIncludeAttempted(next)
                          if (studySetId && studySetData) {
                            const newMax = next
                              ? (studySetData.total_questions ?? 0)
                              : includeIncorrect
                                ? (studySetData.remaining_questions ?? 0) + (studySetData.incorrect_questions ?? 0)
                                : (studySetData.remaining_questions ?? 0)  // new-only: never fall back to total
                            if (newMax === 0) {
                              setNumQuestions(0)
                            } else if (numQuestions === oldMax || numQuestions > newMax) {
                              setNumQuestions(newMax)
                            }
                          } else if (!studySetId) {
                            const newMax = topics
                              .filter(t => selectedTopics.has(t.id))
                              .reduce((sum, t) => {
                                if (next) return sum + (t.question_count || 0)
                                if (includeIncorrect) return sum + (t.remaining_count || 0) + (t.incorrect_count || 0)
                                return sum + (t.remaining_count || 0)
                              }, 0)
                            if (newMax === 0) {
                              setNumQuestions(0)
                            } else if (numQuestions === oldMax || numQuestions > newMax) {
                              setNumQuestions(newMax)
                            }
                          }
                        }}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="include-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeAttempted ? 'Full pool' : 'Off'}</span>
                  </div>

                  <div className="setup__toggle-row" style={{ marginTop: 20 }}>
                    <label htmlFor="incorrect-toggle" className="setup__toggle-label">Include incorrectly answered (with new)</label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="incorrect-toggle"
                        checked={includeIncorrect}
                        disabled={includeAttempted}
                        onChange={(e) => {
                          const next = e.target.checked
                          setIncludeIncorrect(next)
                          const newMax = includeAttempted
                            ? (studySetId
                              ? (studySetData?.total_questions ?? 0)
                              : topics.filter(t => selectedTopics.has(t.id)).reduce((s, t) => s + (t.question_count || 0), 0))
                            : next
                              ? (studySetId
                                ? (studySetData?.remaining_questions ?? 0) + (studySetData?.incorrect_questions ?? 0)
                                : topics.filter(t => selectedTopics.has(t.id)).reduce((s, t) => s + (t.remaining_count || 0) + (t.incorrect_count || 0), 0))
                              : (studySetId
                                ? (studySetData?.remaining_questions ?? 0)  // new-only: never fall back to total
                                : topics.filter(t => selectedTopics.has(t.id)).reduce((s, t) => s + (t.remaining_count || 0), 0))
                          if (newMax === 0) setNumQuestions(0)
                          else setNumQuestions((n) => (n === 0 || n > newMax ? newMax : Math.min(n, newMax)))
                        }}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="incorrect-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className="setup__timer-inline" style={{ fontWeight: 700 }}>{includeIncorrect ? 'On' : 'Off'}</span>
                  </div>
                  {includeAttempted && (
                    <p className="setup__section-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
                      Full pool is every question in this set or topic selection, including ones you already got right. Turn this off if you only want new and/or incorrect questions.
                    </p>
                  )}
                  {includeIncorrect && !includeAttempted && (
                    <p className="setup__section-subtitle" style={{ marginTop: 12, marginBottom: 0 }}>
                      Unattempted questions are mixed with ones you have not yet answered correctly. If none are left unattempted, only incorrect questions are used.
                    </p>
                  )}
                  {isDisabled && studySetId && !includeAttempted && !includeIncorrect && (
                    <p className="setup__section-subtitle" style={{ marginTop: 12, marginBottom: 0, color: 'var(--color-warning, #d97706)' }}>
                      You have attempted all questions in this set. Turn on <strong>Include previously answered</strong> to review the full bank, or <strong>Include incorrectly answered</strong> to focus on questions you have not yet got right.
                    </p>
                  )}

                </div>
              </div>
              <div className="qs-col">
                <div className="setup__setting">
                  <div className="setup__toggle-row">
                    <label htmlFor="timer-toggle" className="setup__toggle-label">
                      Enable Timer
                    </label>
                    <div className="setup__toggle-container">
                      <input
                        type="checkbox"
                        id="timer-toggle"
                        checked={timerEnabled}
                        onChange={(e) => setTimerEnabled(e.target.checked)}
                        className="setup__toggle-input"
                      />
                      <label htmlFor="timer-toggle" className="setup__toggle-slider"></label>
                    </div>
                    <span className={`setup__timer-inline ${!timerEnabled ? 'is-off' : ''}`}>
                      {timerEnabled ? `${timerMinutes} minutes` : 'Off'}
                    </span>
                  </div>
                  <div className={`setup__timer-setting ${!timerEnabled ? 'is-dim' : ''}`}>
                    <div className="setup__slider-wrapper">
                      <input
                        type="range"
                        min="10"
                        max="120"
                        step="5"
                        value={timerMinutes}
                        onChange={(e) => setTimerMinutes(parseInt(e.target.value))}
                        className={`setup__slider ${!timerEnabled ? 'setup__slider--disabled' : ''}`}
                        style={{ '--progress': `${updateSliderProgress(timerMinutes, 10, 120)}%` }}
                        disabled={!timerEnabled}
                      />
                      <div className="setup__slider-labels-new">
                        <span className="setup__slider-label-left">10 mins</span>
                        <span className="setup__slider-label-right">120 mins</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="setup__sidebar">
          <div className="setup__summary">
            <h3 className="setup__summary-title">Session Summary</h3>

            <div className="setup__summary-item">
              <div className="setup__summary-label">Type:</div>
              <div className="setup__summary-value">{studySetId ? 'Study Set' : 'Specialty Practice'}</div>
            </div>

            {!studySetId && (
              <div className="setup__summary-item">
                <div className="setup__summary-label">Topics:</div>
                <div className="setup__summary-value">
                  {selectedTopics.size > 0 ? selectedTopics.size : 0}
                </div>
              </div>
            )}

            <div className="setup__summary-item">
              <div className="setup__summary-label">Questions:</div>
              <div className="setup__summary-value">{numQuestions}</div>
            </div>

            {studySetId && (
              <div className="setup__summary-item">
                <div className="setup__summary-label">Bank load:</div>
                <div className="setup__summary-value">
                  {studySetPrefetch.status === 'error'
                    ? `Will load when you start (${studySetPrefetch.error || 'prefetch failed'})`
                    : studySetPrefetch.status === 'ready'
                      ? `Ready (${studySetPrefetch.loaded})`
                      : studySetPrefetch.status === 'idle'
                        ? '…'
                        : `Loading… ${studySetPrefetch.loaded}${
                            typeof studySetData?.total_questions === 'number'
                              ? ` / ${studySetData.total_questions}`
                              : ''
                          }`}
                </div>
              </div>
            )}

            <div className="setup__summary-item">
              <div className="setup__summary-label">Time:</div>
              <div className="setup__summary-value">
                {timerEnabled ? `${timerMinutes} min` : 'No limit'}
              </div>
            </div>

            <div className="setup__summary-divider"></div>

            <button
              className="setup__start-btn"
              onClick={startSession}
              disabled={isDisabled}
            >
              <LuPlay />
              Start Session
            </button>

            <button
              className="setup__start-btn setup__start-btn--secondary"
              onClick={startGroupSession}
              disabled={isDisabled}
              style={{ marginTop: 10 }}
            >
              <LuUsers />
              Group Study
            </button>

          </div>
        </div>

      </div>
    </div>
  )
}
