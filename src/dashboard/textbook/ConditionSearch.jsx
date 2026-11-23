import React, { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuSearch, LuFileSearch, LuX } from 'react-icons/lu'
import { loadConditions, matchConditions } from './textbookConditions.js'

const MAX_MATCHES = 8

function HighlightedName({ name, query }) {
  const i = name.toLowerCase().indexOf(query.trim().toLowerCase())
  if (!query.trim() || i < 0) return name
  const end = i + query.trim().length
  return (
    <>
      {name.slice(0, i)}
      <strong>{name.slice(i, end)}</strong>
      {name.slice(end)}
    </>
  )
}

/**
 * One search box for the textbook: as you type it lists matching conditions to jump to,
 * and its last option searches all textbook content (scoped to `specialtyId` if given).
 */
export default function ConditionSearch({
  API_BASE,
  placeholder = 'Search conditions or textbook content…',
  specialtyId = null,
  currentSlug = null,
  compact = false,
  label = 'Search the textbook',
}) {
  const navigate = useNavigate()
  const listId = useId()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [conditions, setConditions] = useState([])

  useEffect(() => {
    let cancelled = false
    loadConditions(API_BASE)
      .then((list) => { if (!cancelled) setConditions(list) })
      .catch(() => { /* full-text search still works without the list */ })
    return () => { cancelled = true }
  }, [API_BASE])

  const query = q.trim()
  const matches = useMemo(() => matchConditions(conditions, query, MAX_MATCHES), [conditions, query])
  const canSearchAll = query.length >= 2
  const options = useMemo(
    () => [
      ...matches.map((c) => ({ kind: 'condition', c })),
      ...(canSearchAll ? [{ kind: 'all' }] : []),
    ],
    [matches, canSearchAll]
  )
  const showList = open && query.length > 0

  const reset = () => {
    setQ('')
    setOpen(false)
    setActive(0)
  }

  const choose = (opt) => {
    if (!opt) return
    if (opt.kind === 'condition') {
      navigate(`/dashboard/textbook/topic/${opt.c.slug}`)
    } else {
      const sp = new URLSearchParams({ q: query })
      if (specialtyId) sp.set('specialty_id', String(specialtyId))
      navigate(`/dashboard/textbook/search?${sp.toString()}`)
    }
    reset()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActive((i) => (options.length ? (i + 1) % options.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (options.length ? (i - 1 + options.length) % options.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (showList) choose(options[active])
    } else if (e.key === 'Escape') {
      if (q) reset()
      else e.currentTarget.blur()
    }
  }

  const optionId = (i) => `${listId}-opt-${i}`

  return (
    <div className={`tb-csearch ${compact ? 'tb-csearch--compact' : ''}`} role="search" aria-label={label}>
      <div className="tb-csearch__field">
        <LuSearch className="tb-csearch__icon" aria-hidden />
        <input
          className="tb-csearch__input"
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && options[active] ? optionId(active) : undefined}
          placeholder={placeholder}
          value={q}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
        />
        {q && (
          <button
            type="button"
            className="tb-csearch__clear"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={reset}
          >
            <LuX aria-hidden />
          </button>
        )}
      </div>

      {showList && (
        <ul className="tb-csearch__list" id={listId} role="listbox" aria-label="Search suggestions">
          {matches.length === 0 && (
            <li className="tb-csearch__empty" role="presentation">
              {canSearchAll ? 'No condition names match.' : 'Keep typing…'}
            </li>
          )}
          {options.map((opt, i) => (
            <li
              key={opt.kind === 'condition' ? `${opt.c.specialty_slug}/${opt.c.slug}` : 'all'}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              className={`tb-csearch__option ${i === active ? 'is-active' : ''} ${opt.kind === 'all' ? 'tb-csearch__option--all' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              {opt.kind === 'condition' ? (
                <>
                  <span className="tb-csearch__name">
                    <HighlightedName name={opt.c.name} query={query} />
                    {opt.c.slug === currentSlug && <span className="tb-csearch__here"> · you're here</span>}
                  </span>
                  <span className="tb-csearch__meta">
                    {opt.c.parent_name ? `${opt.c.specialty_name} · ${opt.c.parent_name}` : opt.c.specialty_name}
                  </span>
                </>
              ) : (
                <span className="tb-csearch__name">
                  <LuFileSearch aria-hidden /> Search all textbook content for “{query}”
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
