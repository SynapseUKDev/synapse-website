import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import LoadingScreen from '../../components/loading/LoadingScreen.jsx'
import { letterOf, loadConditions } from './textbookConditions.js'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

/** Every condition in the textbook, A–Z, with a letter bar to jump through the list. */
export default function ConditionAZ({ API_BASE }) {
  const navigate = useNavigate()
  const [conditions, setConditions] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    loadConditions(API_BASE)
      .then((list) => { if (!cancelled) setConditions(list) })
      .catch((e) => { if (!cancelled) setError(e?.message || 'Failed to load conditions') })
    return () => { cancelled = true }
  }, [API_BASE])

  const groups = useMemo(() => {
    const map = new Map()
    for (const c of conditions || []) {
      const letter = letterOf(c.name)
      if (!map.has(letter)) map.set(letter, [])
      map.get(letter).push(c)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '#' ? 1 : b === '#' ? -1 : a.localeCompare(b)))
  }, [conditions])

  if (error) return <div className="tb-error">{error}</div>
  if (!conditions) return <LoadingScreen message="Loading conditions…" compact />

  const present = new Set(groups.map(([l]) => l))
  const jumpTo = (letter) => {
    document.getElementById(`tb-az-${letter}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="tb-az" aria-label="All conditions A to Z">
      <nav className="tb-az__letters" aria-label="Jump to letter">
        {[...LETTERS, ...(present.has('#') ? ['#'] : [])].map((l) => (
          <button
            key={l}
            type="button"
            className="tb-az__letter"
            disabled={!present.has(l)}
            onClick={() => jumpTo(l)}
            aria-label={l === '#' ? 'Jump to other' : `Jump to ${l}`}
          >
            {l}
          </button>
        ))}
      </nav>
      <p className="tb-az__count">{conditions.length} conditions</p>
      {groups.map(([letter, items]) => (
        <div key={letter} className="tb-az__group" id={`tb-az-${letter}`}>
          <h3 className="tb-az__heading">{letter}</h3>
          <ul className="tb-az__list">
            {items.map((c) => (
              <li key={`${c.specialty_slug}/${c.slug}`}>
                <button
                  type="button"
                  className="tb-az__item"
                  onClick={() => navigate(`/dashboard/textbook/topic/${c.slug}`)}
                >
                  <span className="tb-az__name">{c.name}</span>
                  <span className="tb-az__meta">
                    {c.parent_name ? `${c.specialty_name} · ${c.parent_name}` : c.specialty_name}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
