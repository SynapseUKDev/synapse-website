import { useMemo, useState } from 'react'
import { LuChevronDown, LuChevronRight, LuPlay } from 'react-icons/lu'
import { MAX_NEW_CARDS, MODES } from './buildDeck'

// Specialty → topic tree from GET /flashcards/v2/topics, multi-select, Due / New / Free modes.
// Presentational: the container owns loading the topics and building the deck.

const MODE_TABS = [
  { mode: MODES.DUE, label: 'Due', hint: 'Cards scheduled for review now.' },
  { mode: MODES.NEW, label: 'New', hint: `Cards you have not seen yet (up to ${MAX_NEW_CARDS}).` },
  { mode: MODES.FREE, label: 'Free study', hint: 'Every card in the selected topics; ratings still count.' },
]

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

function startLabel(mode, cardCount) {
  if (mode === MODES.DUE) return 'Start due review'
  if (mode === MODES.NEW) return `Start · up to ${Math.min(cardCount, MAX_NEW_CARDS)} new`
  return `Start · ${plural(cardCount, 'card')}`
}

export default function TopicPicker({
  topics,
  onRetry,
  showDrafts = false,
  dueCount = null,
  onStart,
  starting = false,
  startError = null,
  notice = null,
}) {
  const [mode, setMode] = useState(MODES.FREE)
  const [expanded, setExpanded] = useState(() => new Set())
  const [selected, setSelected] = useState(() => new Set())

  const specialties = useMemo(() => topics.specialties ?? [], [topics.specialties])
  const selectedCards = useMemo(() => {
    let n = 0
    for (const sp of specialties) for (const t of sp.topics) if (selected.has(t.id)) n += t.cardCount
    return n
  }, [specialties, selected])

  if (topics.status === 'loading') {
    return (
      <div className="fc2-picker__state" role="status">
        <div className="fc-spinner" aria-hidden="true" />
        <p>Loading topics…</p>
      </div>
    )
  }
  if (topics.status === 'error') {
    return (
      <div className="fc2-picker__state">
        <div role="alert" className="fc2-alert">
          We could not load the topics. {topics.error?.message}
        </div>
        <button type="button" className="fc2-btn fc2-btn--primary" onClick={onRetry}>
          Retry
        </button>
      </div>
    )
  }
  if (!specialties.length) {
    return (
      <div className="fc2-picker__state" role="status">
        <p>No flashcards are available yet.</p>
      </div>
    )
  }

  const toggle = (setter, id) =>
    setter((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  function toggleSpecialty(sp) {
    const ids = sp.topics.map((t) => t.id)
    const all = ids.every((id) => selected.has(id))
    setSelected((s) => {
      const n = new Set(s)
      for (const id of ids) {
        if (all) n.delete(id)
        else n.add(id)
      }
      return n
    })
  }

  const activeHint = MODE_TABS.find((t) => t.mode === mode)?.hint
  const canStart = selected.size > 0 && !starting

  return (
    <div className="fc2-picker">
      <div className="fc-mode-tabs" role="tablist" aria-label="Study mode">
        {MODE_TABS.map((t) => (
          <button
            key={t.mode}
            type="button"
            role="tab"
            aria-selected={mode === t.mode}
            aria-controls="fc2-picker-panel"
            className={`fc-mode-tab${mode === t.mode ? ' fc-mode-tab--active' : ''}`}
            onClick={() => setMode(t.mode)}
          >
            {t.label}
            {t.mode === MODES.DUE && dueCount > 0 && <span className="fc-mode-tab__badge">{dueCount}</span>}
          </button>
        ))}
      </div>

      <div id="fc2-picker-panel" role="tabpanel" aria-label="Topics">
        <p className="fc2-picker__hint">{activeHint}</p>

        <ul className="fc2-tree">
          {specialties.map((sp) => {
            const open = expanded.has(sp.id)
            const ids = sp.topics.map((t) => t.id)
            const nSel = ids.filter((id) => selected.has(id)).length
            return (
              <li key={sp.id} className="fc2-tree__specialty">
                <div className="fc2-tree__row fc2-tree__row--specialty">
                  <button
                    type="button"
                    className="fc2-tree__toggle"
                    onClick={() => toggle(setExpanded, sp.id)}
                    aria-expanded={open}
                  >
                    {open ? <LuChevronDown size={16} aria-hidden="true" /> : <LuChevronRight size={16} aria-hidden="true" />}
                    <span>{sp.name}</span>
                    <span className="fc2-tree__count">{plural(sp.topics.length, 'topic')}</span>
                  </button>
                  <label className="fc2-tree__check">
                    <input
                      type="checkbox"
                      checked={nSel === ids.length}
                      ref={(el) => {
                        if (el) el.indeterminate = nSel > 0 && nSel < ids.length
                      }}
                      onChange={() => toggleSpecialty(sp)}
                      aria-label={`Select all topics in ${sp.name}`}
                    />
                    all
                  </label>
                </div>
                {open && (
                  <ul className="fc2-tree__topics">
                    {sp.topics.map((t) => (
                      <li key={t.id}>
                        <label className="fc2-tree__row fc2-tree__row--topic">
                          <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(setSelected, t.id)} />
                          <span className="fc2-tree__topic">{t.name}</span>
                          <span className="fc2-tree__count">{plural(t.cardCount, 'card')}</span>
                          {showDrafts && t.draftCount > 0 && (
                            <span className="fc2-qa">{plural(t.draftCount, 'draft')}</span>
                          )}
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </div>

      {startError && (
        <div role="alert" className="fc2-alert">
          We could not start the session. {startError.message}
        </div>
      )}
      {notice && (
        <p role="status" className="fc2-notice">
          {notice}
        </p>
      )}

      <div className="fc2-picker__footer">
        <span className="fc2-picker__selection">
          {selected.size ? `${plural(selected.size, 'topic')} selected` : 'Select at least one topic'}
        </span>
        <button
          type="button"
          className="fc-picker__start fc2-start"
          disabled={!canStart}
          onClick={() => onStart(mode, [...selected])}
        >
          <LuPlay size={18} aria-hidden="true" />
          {starting ? 'Preparing…' : startLabel(mode, selectedCards)}
        </button>
      </div>
    </div>
  )
}
