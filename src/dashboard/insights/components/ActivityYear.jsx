import { useMemo } from 'react'
import useStaleJson from '../../../utils/useStaleJson'
import { authHeaders } from '../../../auth/token'

const DAYS_TOTAL = 365

/** Map question count to heatmap level (fixed thresholds, not relative to max). */
function levelFor(count) {
  if (!count || count <= 0) return 0
  if (count <= 49) return 1
  if (count <= 99) return 2
  if (count <= 199) return 3
  return 4
}

/** Local YYYY-MM-DD key, matching ActivityHeatmap's formatDateKey. */
function formatDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatTitleDate(date) {
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ActivityYear() {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const tz = (typeof Intl !== 'undefined' && Intl.DateTimeFormat
    ? Intl.DateTimeFormat().resolvedOptions().timeZone
    : '') || 'UTC'

  const req = useStaleJson(
    `${API_BASE}/qbank/activity/daily?timezone=${encodeURIComponent(tz)}&days=365`,
    {
      headers: { ...authHeaders() },
      staleMs: 300_000,
      persist: 'session',
      key: 'analytics:activity:365',
    }
  )

  const { cells, columns } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const start = new Date(today)
    start.setDate(start.getDate() - (DAYS_TOTAL - 1))
    const startWeekday = start.getDay() === 0 ? 6 : start.getDay() - 1 // Mon=0..Sun=6

    const out = []
    for (let i = 0; i < startWeekday; i++) out.push(null)

    const cur = new Date(start)
    for (let i = 0; i < DAYS_TOTAL; i++) {
      out.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }

    return { cells: out, columns: Math.ceil(out.length / 7) }
  }, [])

  const counts = useMemo(() => {
    const map = {}
    const dates = req.data?.dates
    if (Array.isArray(dates)) {
      dates.forEach((item) => {
        map[item.date] = item.count || 0
      })
    }
    return map
  }, [req.data])

  const stats = useMemo(() => {
    let total = 0
    let activeDays = 0
    let longest = 0
    let current = 0
    cells.forEach((d) => {
      if (!d) return
      const count = counts[formatDateKey(d)] || 0
      total += count
      if (count > 0) {
        activeDays += 1
        current += 1
        if (current > longest) longest = current
      } else {
        current = 0
      }
    })
    return { total, activeDays, longest }
  }, [cells, counts])

  const monthLabels = useMemo(() => {
    const labels = []
    let lastCol = -Infinity
    cells.forEach((d, idx) => {
      if (!d || d.getDate() !== 1) return
      const col = Math.floor(idx / 7)
      if (col - lastCol > 2) {
        labels.push({ col, label: d.toLocaleDateString('en-GB', { month: 'short' }) })
        lastCol = col
      }
    })
    return labels
  }, [cells])

  if (req.loading && !req.data) {
    return <p className="ay-status">Loading…</p>
  }

  if (req.error) {
    return <p className="ay-status">Couldn't load activity.</p>
  }

  return (
    <div className="ay">
      <div className="ay-scroll">
        <div className="ay-cols" style={{ '--ay-cols': columns }}>
          <div className="ay-months">
            {monthLabels.map(({ col, label }) => (
              <div key={`${col}-${label}`} className="ay-month-label" style={{ gridColumnStart: col + 2 }}>
                {label}
              </div>
            ))}
          </div>
          <div className="ay-grid" role="grid" aria-label="Questions answered per day over the last year">
            {['Mon', '', 'Wed', '', 'Fri', '', ''].map((label, i) => (
              <div key={`wd-${i}`} className="ay-weekday-label">{label}</div>
            ))}
            {cells.map((d, idx) => {
              if (!d) return <div key={`pad-${idx}`} className="ay-pad" />
              const key = formatDateKey(d)
              const count = counts[key] || 0
              const level = levelFor(count)
              return (
                <div
                  key={key}
                  role="gridcell"
                  className={`ay-cell ay-cell--l${level}`}
                  title={`${formatTitleDate(d)}: ${count} questions`}
                />
              )
            })}
          </div>
        </div>
      </div>

      <div className="ay-summary-row">
        <p className="ay-summary">
          {stats.total} questions in the last year · {stats.activeDays} active days · longest streak {stats.longest} days
        </p>
        <div className="ay-legend">
          <span>Less</span>
          <div className="ay-legend__sw ay-legend__sw--l0" />
          <div className="ay-legend__sw ay-legend__sw--l1" />
          <div className="ay-legend__sw ay-legend__sw--l2" />
          <div className="ay-legend__sw ay-legend__sw--l3" />
          <div className="ay-legend__sw ay-legend__sw--l4" />
          <span>More</span>
        </div>
      </div>
    </div>
  )
}
