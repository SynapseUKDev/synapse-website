import React, { useId, useMemo, useRef, useState } from 'react'
import { LuChevronDown, LuX } from 'react-icons/lu'
import './AdminQuestions.css'

function flattenTopics(taxonomy) {
  return taxonomy.flatMap((specialty) =>
    specialty.topics.map((topic) => ({
      id: topic.id,
      name: topic.name,
      specialtyId: specialty.id,
      specialty: specialty.name,
      haystack: `${specialty.name} ${topic.name}`.toLowerCase(),
    })),
  )
}

function matches(topic, query) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  return words.every((word) => topic.haystack.includes(word))
}

/**
 * Searchable topic picker (ARIA 1.2 combobox with a grouped listbox). Typing
 * filters by topic or specialty name; arrow keys move, Enter selects, Escape
 * closes without changing the selection.
 */
export default function TopicCombobox({
  id,
  taxonomy = [],
  value = '',
  onChange,
  placeholder = 'Search topics or specialties…',
  clearLabel = null,
  disabled = false,
  invalid = false,
  describedBy,
}) {
  const listboxId = useId()
  const inputRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const topics = useMemo(() => flattenTopics(taxonomy), [taxonomy])
  const selected = topics.find((topic) => topic.id === value) || null
  const results = useMemo(() => (query.trim() ? topics.filter((topic) => matches(topic, query)) : topics), [topics, query])

  const groups = useMemo(() => {
    const bySpecialty = new Map()
    results.forEach((topic, index) => {
      if (!bySpecialty.has(topic.specialtyId)) bySpecialty.set(topic.specialtyId, { name: topic.specialty, items: [] })
      bySpecialty.get(topic.specialtyId).items.push({ topic, index })
    })
    return [...bySpecialty.entries()]
  }, [results])

  const selectedLabel = selected ? `${selected.specialty} › ${selected.name}` : value ? `Unknown topic (${value})` : ''
  const optionId = (index) => `${listboxId}-opt-${index}`

  const openList = () => {
    if (disabled) return
    setOpen(true)
    const selectedIndex = results.findIndex((topic) => topic.id === value)
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
  }

  const close = () => {
    setOpen(false)
    setQuery('')
  }

  const choose = (topic) => {
    onChange(topic.id)
    close()
  }

  const scrollIntoView = (index) => {
    requestAnimationFrame(() => document.getElementById(optionId(index))?.scrollIntoView?.({ block: 'nearest' }))
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return openList()
      if (!results.length) return
      const next =
        event.key === 'ArrowDown' ? Math.min(activeIndex + 1, results.length - 1) : Math.max(activeIndex - 1, 0)
      setActiveIndex(next)
      scrollIntoView(next)
    } else if (event.key === 'Enter') {
      if (open && results[activeIndex]) {
        event.preventDefault()
        choose(results[activeIndex])
      }
    } else if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        close()
      }
    }
  }

  return (
    <div className={`topic-combobox ${open ? 'is-open' : ''}`}>
      <div className="topic-combobox__control">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[activeIndex] ? optionId(activeIndex) : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          autoComplete="off"
          disabled={disabled}
          placeholder={selectedLabel || placeholder}
          value={open ? query : selectedLabel}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            if (!open) setOpen(true)
          }}
          onFocus={openList}
          onClick={() => !open && openList()}
          onBlur={close}
          onKeyDown={onKeyDown}
        />
        {clearLabel && value && !disabled ? (
          <button
            type="button"
            className="topic-combobox__icon-button"
            aria-label={`Clear topic (${clearLabel})`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange('')
              close()
            }}
          >
            <LuX aria-hidden />
          </button>
        ) : (
          <LuChevronDown className="topic-combobox__chevron" aria-hidden />
        )}
      </div>

      {open && (
        <div className="topic-combobox__popup">
          <div className="topic-combobox__count" aria-live="polite">
            {results.length === topics.length
              ? `${topics.length} topics`
              : `${results.length} of ${topics.length} topics match`}
          </div>
          <ul id={listboxId} role="listbox" aria-label="Topics" className="topic-combobox__list">
            {groups.map(([specialtyId, group]) => (
              <li key={specialtyId} role="presentation">
                <div className="topic-combobox__group" aria-hidden="true">
                  {group.name}
                </div>
                <ul role="group" aria-label={group.name}>
                  {group.items.map(({ topic, index }) => (
                    <li
                      key={topic.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={topic.id === value}
                      className={`topic-combobox__option ${index === activeIndex ? 'is-active' : ''} ${
                        topic.id === value ? 'is-selected' : ''
                      }`}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => choose(topic)}
                    >
                      {topic.name}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {results.length === 0 && (
              <li role="presentation" className="topic-combobox__empty">
                No topics match “{query.trim()}”.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
