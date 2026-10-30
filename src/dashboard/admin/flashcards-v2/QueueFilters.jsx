import { useEffect, useId, useRef, useState } from 'react'

export const SEARCH_DEBOUNCE_MS = 300

const KINDS = [
  { value: '', label: 'All' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'needs_image', label: 'Needs image' },
]

/**
 * Queue filters: topic search (sent as `q` 300 ms after the last keystroke), specialty, kind.
 * value {q, specialtyId, kind}; specialties [{id, name}]; onChange(patch) with the changed keys only.
 */
export default function QueueFilters({ value, specialties, onChange }) {
  const [text, setText] = useState(value.q ?? '')
  const ids = { q: useId(), specialty: useId(), kind: useId() }
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  })

  useEffect(() => {
    if (text.trim() === (value.q ?? '').trim()) return undefined
    const timer = setTimeout(() => onChangeRef.current({ q: text.trim() }), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [text, value.q])

  return (
    <div className="fcv2a-filters" role="search" aria-label="Filter cards">
      <div className="fcv2a-filters__field fcv2a-filters__field--grow">
        <label htmlFor={ids.q} className="fcv2a-label">
          Search topics
        </label>
        <input id={ids.q} type="search" value={text} placeholder="Topic name or question text" onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="fcv2a-filters__field">
        <label htmlFor={ids.specialty} className="fcv2a-label">
          Specialty
        </label>
        <select id={ids.specialty} value={value.specialtyId ?? ''} onChange={(e) => onChange({ specialtyId: e.target.value })}>
          <option value="">All specialties</option>
          {(specialties ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div className="fcv2a-filters__field">
        <label htmlFor={ids.kind} className="fcv2a-label">
          Kind
        </label>
        <select id={ids.kind} value={value.kind ?? ''} onChange={(e) => onChange({ kind: e.target.value })}>
          {KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
