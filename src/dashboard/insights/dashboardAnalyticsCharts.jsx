import React from 'react'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** Saturday first, then Sunday … Friday. Index 0 = Sat, 1 = Sun, …, 6 = Fri */
export const WEEKDAY_ORDER = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri']

export function dayOfWeek(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'Z')
  return DAY_NAMES[d.getUTCDay()] || ''
}

/** Map date to weekday index: Sat=0, Sun=1, …, Fri=6 */
export function weekdayIndex(dateStr) {
  if (!dateStr) return -1
  const d = new Date(dateStr + 'Z')
  const jsDay = d.getUTCDay()
  return (jsDay + 1) % 7
}

/** Returns the last N calendar days as YYYY-MM-DD strings, oldest first */
function lastNDates(n = 7) {
  const dates = []
  const now = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

/** Format a YYYY-MM-DD date as a short label like "Mon 23" */
function shortDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = d.toLocaleDateString('en-GB', { weekday: 'short' })
  const num = d.getDate()
  return `${day} ${num}`
}

/** Slice trend data to the last 7 calendar days; fills missing days with nulls */
export function getLast7Days(trendDays) {
  const dates = lastNDates(7)
  const byDate = {}
  ;(trendDays || []).forEach((d) => { if (d?.date) byDate[d.date] = d })
  return dates.map((date) => ({
    date,
    label: shortDateLabel(date),
    questions_answered: byDate[date]?.questions_answered ?? null,
    accuracy_pct: byDate[date]?.accuracy_pct ?? null,
    avg_time_ms: byDate[date]?.avg_time_ms ?? null,
  }))
}

/** Aggregate trend days by weekday (Sat..Fri); returns 7 entries with dayName and avgQuestions */
export function aggregateTrendByWeekday(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    if (idx >= 0) {
      sums[idx] += d.questions_answered ?? 0
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgQuestions: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

/** Aggregate accuracy by weekday (Sat..Fri); returns 7 entries with dayName and avgAccuracy (0–100) */
export function aggregateTrendByWeekdayForAccuracy(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    const acc = d.accuracy_pct != null ? Number(d.accuracy_pct) : null
    if (idx >= 0 && acc != null) {
      sums[idx] += acc
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgAccuracy: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}

/** Aggregate time by weekday (Sat..Fri); returns 7 entries with dayName and avgTimeSeconds */
export function aggregateTrendByWeekdayForTime(trendDays) {
  const sums = [0, 0, 0, 0, 0, 0, 0]
  const counts = [0, 0, 0, 0, 0, 0, 0]
  trendDays.forEach((d) => {
    const idx = weekdayIndex(d?.date)
    const ms = d.avg_time_ms != null ? Number(d.avg_time_ms) : null
    if (idx >= 0 && ms != null) {
      sums[idx] += ms / 1000
      counts[idx] += 1
    }
  })
  return WEEKDAY_ORDER.map((dayName, i) => ({
    dayName,
    avgTimeSeconds: counts[i] > 0 ? Math.round((sums[i] / counts[i]) * 10) / 10 : 0,
  }))
}


export function buildDemoTrend() {
  const now = new Date()
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - (29 - i))
    const dateStr = d.toISOString().slice(0, 10)
    const accuracy = 70 + Math.round(8 * Math.sin(i / 4) + i * 0.4)
    const avgTimeS = 40 - Math.round(6 * Math.cos(i / 3) + i * 0.2)
    const questions = Math.round(15 + 12 * Math.sin(i / 5) + i * 0.3)
    return {
      date: dateStr,
      questions_answered: Math.max(0, questions),
      accuracy_pct: Math.max(40, Math.min(98, accuracy)),
      avg_time_ms: Math.max(20, avgTimeS) * 1000,
    }
  })
  return days
}

/**
 * Rolling 7-day Questions bar chart.
 * Each bar = actual questions answered on that calendar day.
 * Bars for days with no data are shown as empty (ghosted).
 */
export function renderQuestionsChart(days7, idPrefix = '') {
  const gid = `${idPrefix}q7-gradient`
  const w = 400
  const h = 220
  const pad = { top: 20, right: 16, bottom: 36, left: 38 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const n = days7.length
  const vals = days7.map((d) => d.questions_answered ?? 0)
  const maxVal = Math.max(1, ...vals)
  const barW = Math.floor((innerW / n) * 0.58)
  const gap = innerW / n
  const baselineY = pad.top + innerH

  // Nice y-axis ticks
  const niceMax = Math.ceil(maxVal / 5) * 5 || 5
  const yTicks = [0, Math.round(niceMax / 2), niceMax]

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Questions answered — last 7 days">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--syn-cyan, #0891b2)" stopOpacity={1} />
          <stop offset="100%" stopColor="var(--syn-cyan, #0891b2)" stopOpacity={0.55} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {/* Grid lines */}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / niceMax) * innerH
        return (
          <line key={tick} x1={pad.left} y1={y} x2={w - pad.right} y2={y}
            stroke="var(--syn-border, #e2e8f0)" strokeWidth={1} strokeDasharray={tick === 0 ? '' : '3 3'} />
        )
      })}
      {/* Y-axis labels */}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / niceMax) * innerH
        return (
          <text key={tick} x={pad.left - 6} y={y + 4} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}</text>
        )
      })}
      {/* Bars */}
      {days7.map((d, i) => {
        const cx = pad.left + i * gap + gap / 2
        const x = cx - barW / 2
        const v = d.questions_answered ?? 0
        const hasData = d.questions_answered != null
        const barH = hasData && v > 0 ? (v / niceMax) * innerH : 0
        const barY = baselineY - barH
        const tooltip = `${d.label}: ${hasData ? `${v} question${v === 1 ? '' : 's'}` : 'No data'}`
        return (
          <g key={d.date}>
            {/* Ghost bar for missing/zero days */}
            {(!hasData || v === 0) && (
              <rect x={x} y={pad.top} width={barW} height={innerH}
                fill="var(--syn-border, #e2e8f0)" opacity={0.35} rx={3}>
                <title>{tooltip}</title>
              </rect>
            )}
            {/* Data bar */}
            {hasData && v > 0 && (
              <rect x={x} y={barY} width={barW} height={barH}
                fill={`url(#${gid})`} rx={3}>
                <title>{tooltip}</title>
              </rect>
            )}
            {/* Value label above bar */}
            {hasData && v > 0 && (
              <text x={cx} y={barY - 4} fontSize={8.5} fill="var(--syn-cyan, #0891b2)" textAnchor="middle" fontWeight="600">{v}</text>
            )}
          </g>
        )
      })}
      {/* X-axis labels */}
      {days7.map((d, i) => {
        const cx = pad.left + i * gap + gap / 2
        return (
          <text key={d.date} x={cx} y={h - 8} fontSize={8.5} fill="var(--syn-muted)" textAnchor="middle">{d.label}</text>
        )
      })}
    </svg>
  )
}

/**
 * Rolling 7-day Accuracy line chart.
 * Renders a smooth line with filled area; days with no data create a gap.
 */
export function renderAccuracyChartByWeekday(days7, idPrefix = '') {
  const gid = `${idPrefix}acc7-gradient`
  const w = 400
  const h = 220
  const pad = { top: 20, right: 16, bottom: 36, left: 38 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const n = days7.length
  const gap = innerW / Math.max(n - 1, 1)
  const baselineY = pad.top + innerH
  const maxVal = 100
  const yTicks = [0, 25, 50, 75, 100]

  const pt = (i, v) => [pad.left + i * gap, pad.top + (1 - v / maxVal) * innerH]

  // Build line segments (skip gaps where no data)
  const segments = []
  let seg = []
  days7.forEach((d, i) => {
    if (d.accuracy_pct != null) {
      seg.push([i, Number(d.accuracy_pct)])
    } else {
      if (seg.length) { segments.push(seg); seg = [] }
    }
  })
  if (seg.length) segments.push(seg)

  const pathD = segments
    .map((s) => s.map(([i, v], j) => {
      const [x, y] = pt(i, v)
      return (j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)
    }).join(' '))
    .join(' ')

  // Area fill (connect each segment to baseline)
  const areaD = segments
    .map((s) => {
      const pts = s.map(([i, v]) => pt(i, v))
      const [fx] = pts[0]
      const [lx] = pts[pts.length - 1]
      return `M ${fx} ${baselineY} ` +
        pts.map(([x, y]) => `L ${x} ${y}`).join(' ') +
        ` L ${lx} ${baselineY} Z`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy — last 7 days">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {/* Grid */}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / maxVal) * innerH
        return (
          <line key={tick} x1={pad.left} y1={y} x2={w - pad.right} y2={y}
            stroke="var(--syn-border, #e2e8f0)" strokeWidth={1} strokeDasharray={tick === 0 ? '' : '3 3'} />
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / maxVal) * innerH
        return <text key={tick} x={pad.left - 6} y={y + 4} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}%</text>
      })}
      {areaD && <path d={areaD} fill={`url(#${gid})`} />}
      {pathD && <path d={pathD} fill="none" stroke="#3b82f6" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {/* Data points */}
      {days7.map((d, i) => {
        if (d.accuracy_pct == null) return null
        const [x, y] = pt(i, Number(d.accuracy_pct))
        const v = Math.round(Number(d.accuracy_pct))
        return (
          <g key={d.date}>
            <circle cx={x} cy={y} r={5} fill="#fff" stroke="#3b82f6" strokeWidth={2.5}>
              <title>{d.label}: {v}% accuracy</title>
            </circle>
            <text x={x} y={y - 9} fontSize={8.5} fill="#3b82f6" textAnchor="middle" fontWeight="600">{v}%</text>
          </g>
        )
      })}
      {/* Ghost dots for missing days */}
      {days7.map((d, i) => {
        if (d.accuracy_pct != null) return null
        const cx = pad.left + i * gap
        return (
          <circle key={d.date} cx={cx} cy={baselineY - 4} r={3}
            fill="var(--syn-border, #e2e8f0)" stroke="none" opacity={0.6}>
            <title>{d.label}: No data</title>
          </circle>
        )
      })}
      {/* X-axis */}
      {days7.map((d, i) => {
        const cx = pad.left + i * gap
        return <text key={d.date} x={cx} y={h - 8} fontSize={8.5} fill="var(--syn-muted)" textAnchor="middle">{d.label}</text>
      })}
    </svg>
  )
}

/**
 * Rolling 7-day Time-per-question line chart.
 */
export function renderTimeChartByWeekday(days7, idPrefix = '') {
  const gid = `${idPrefix}time7-gradient`
  const w = 400
  const h = 220
  const pad = { top: 20, right: 16, bottom: 36, left: 42 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const n = days7.length
  const gap = innerW / Math.max(n - 1, 1)
  const baselineY = pad.top + innerH

  const secVals = days7.map((d) => d.avg_time_ms != null ? Math.round(d.avg_time_ms / 1000) : null)
  const defined = secVals.filter((v) => v != null)
  const maxVal = Math.max(60, ...(defined.length ? defined : [60]))
  const niceMax = Math.ceil(maxVal / 10) * 10
  const yTicks = [0, Math.round(niceMax / 3), Math.round((2 * niceMax) / 3), niceMax]
    .filter((v, i, a) => a.indexOf(v) === i)

  const pt = (i, v) => [pad.left + i * gap, pad.top + (1 - v / niceMax) * innerH]

  // Line segments
  const segments = []
  let seg = []
  secVals.forEach((v, i) => {
    if (v != null) {
      seg.push([i, v])
    } else {
      if (seg.length) { segments.push(seg); seg = [] }
    }
  })
  if (seg.length) segments.push(seg)

  const pathD = segments
    .map((s) => s.map(([i, v], j) => {
      const [x, y] = pt(i, v)
      return (j === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)
    }).join(' '))
    .join(' ')

  const areaD = segments
    .map((s) => {
      const pts = s.map(([i, v]) => pt(i, v))
      const [fx] = pts[0]
      const [lx] = pts[pts.length - 1]
      return `M ${fx} ${baselineY} ` +
        pts.map(([x, y]) => `L ${x} ${y}`).join(' ') +
        ` L ${lx} ${baselineY} Z`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Avg time per question — last 7 days">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.25} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / niceMax) * innerH
        return (
          <line key={tick} x1={pad.left} y1={y} x2={w - pad.right} y2={y}
            stroke="var(--syn-border, #e2e8f0)" strokeWidth={1} strokeDasharray={tick === 0 ? '' : '3 3'} />
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - tick / niceMax) * innerH
        return <text key={tick} x={pad.left - 6} y={y + 4} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}s</text>
      })}
      {areaD && <path d={areaD} fill={`url(#${gid})`} />}
      {pathD && <path d={pathD} fill="none" stroke="#16a34a" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />}
      {secVals.map((v, i) => {
        if (v == null) return null
        const [x, y] = pt(i, v)
        return (
          <g key={days7[i].date}>
            <circle cx={x} cy={y} r={5} fill="#fff" stroke="#16a34a" strokeWidth={2.5}>
              <title>{days7[i].label}: {v}s avg</title>
            </circle>
            <text x={x} y={y - 9} fontSize={8.5} fill="#16a34a" textAnchor="middle" fontWeight="600">{v}s</text>
          </g>
        )
      })}
      {secVals.map((v, i) => {
        if (v != null) return null
        const cx = pad.left + i * gap
        return (
          <circle key={days7[i].date} cx={cx} cy={baselineY - 4} r={3}
            fill="var(--syn-border, #e2e8f0)" stroke="none" opacity={0.6}>
            <title>{days7[i].label}: No data</title>
          </circle>
        )
      })}
      {days7.map((d, i) => {
        const cx = pad.left + i * gap
        return <text key={d.date} x={cx} y={h - 8} fontSize={8.5} fill="var(--syn-muted)" textAnchor="middle">{d.label}</text>
      })}
    </svg>
  )
}

export function renderAccuracyChart(days, idPrefix = '') {
  const gid = `${idPrefix}acc-gradient`
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = days.map((d) => d.accuracy_pct ?? 0)
  const maxVal = 100
  const xStep = innerW / Math.max(days.length - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, 25, 50, 75, 100]
  const xTickIndices = days.length > 0 ? [0, Math.floor(days.length / 4), Math.floor(days.length / 2), Math.floor((3 * days.length) / 4), days.length - 1].filter((v, i, a) => a.indexOf(v) === i) : []
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy over time">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayLabel = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        const tooltip = `${dayLabel}: ${vals[i]}%`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}</text>
          </g>
        )
      })}
      {xTickIndices.map((i) => {
        const x = pad.left + i * xStep
        const label = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="var(--syn-muted)" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function renderTimeChart(days, idPrefix = '') {
  const gid = `${idPrefix}time-gradient`
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = days.map((d) => (d.avg_time_ms != null ? Math.round(d.avg_time_ms / 1000) : 0))
  const timeMax = Math.max(60, ...vals, 0)
  const xStep = innerW / Math.max(days.length - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - ((v ?? 0) / timeMax)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.round(timeMax / 3), Math.round((2 * timeMax) / 3), timeMax].filter((v, i, a) => a.indexOf(v) === i)
  const xTickIndices = days.length > 0 ? [0, Math.floor(days.length / 4), Math.floor(days.length / 2), Math.floor((3 * days.length) / 4), days.length - 1].filter((v, i, a) => a.indexOf(v) === i) : []
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Average time per question">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayLabel = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        const tooltip = `${dayLabel}: ${vals[i]}s`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#16a34a" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / timeMax)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}s</text>
          </g>
        )
      })}
      {xTickIndices.map((i) => {
        const x = pad.left + i * xStep
        const label = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="var(--syn-muted)" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** Daily questions answered (same period as trend days). */
export function renderQuestionsOverTime(days, idPrefix = '') {
  const gid = `${idPrefix}q-daily-gradient`
  const w = 400
  const h = 220
  const pad = { top: 12, right: 16, bottom: 30, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const vals = days.map((d) => d.questions_answered ?? 0)
  const maxVal = Math.max(1, ...vals)
  const xStep = innerW / Math.max(days.length - 1, 1)
  const baselineY = pad.top + innerH
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal].filter((v, i, a) => a.indexOf(v) === i)
  const xTickIndices = days.length > 0 ? [0, Math.floor(days.length / 4), Math.floor(days.length / 2), Math.floor((3 * days.length) / 4), days.length - 1].filter((v, i, a) => a.indexOf(v) === i) : []
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Questions answered over time">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--syn-cyan)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--syn-cyan)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke="var(--syn-cyan)" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const dayLabel = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        const tooltip = `${dayLabel}: ${vals[i]} questions`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="var(--syn-cyan)" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}</text>
          </g>
        )
      })}
      {xTickIndices.map((i) => {
        const x = pad.left + i * xStep
        const label = dayOfWeek(days[i]?.date) || `Day ${i + 1}`
        return (
          <g key={i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 6} fontSize={9} fill="var(--syn-muted)" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

function truncateTopicLabel(name, maxLen = 10) {
  if (!name) return ''
  return name.length <= maxLen ? name : name.slice(0, maxLen) + '…'
}

export function renderAccuracyChartByTopic(topicCards, idPrefix = '') {
  const gid = `${idPrefix}acc-topic-gradient`
  const w = 560
  const h = 220
  const pad = { top: 12, right: 20, bottom: 34, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const baselineY = pad.top + innerH
  if (topicCards.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy by topic">
        <text x={w / 2} y={h / 2} fontSize={13} fill="var(--syn-muted)" textAnchor="middle">Answer questions to see accuracy by topic</text>
      </svg>
    )
  }
  const vals = topicCards.map((t) => (t.accuracy_pct != null ? Number(t.accuracy_pct) : 0))
  const maxVal = Math.max(100, ...vals)
  const xStep = innerW / Math.max(topicCards.length - 1, 1)
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / maxVal)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, 25, 50, 75, 100]
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Accuracy by topic">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const t = topicCards[i]
        const topicName = t?.topic_name || 'Topic'
        const pct = vals[i]
        const tooltip = `${topicName}: ${pct}%`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#3b82f6" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / maxVal)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}%</text>
          </g>
        )
      })}
      {topicCards.map((t, i) => {
        const x = pad.left + i * xStep
        const label = truncateTopicLabel(t.topic_name || 'Topic', 14)
        return (
          <g key={t.topic_id || i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 8} fontSize={8} fill="var(--syn-muted)" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function renderTimeChartByTopic(topicCards, idPrefix = '') {
  const gid = `${idPrefix}time-topic-gradient`
  const w = 560
  const h = 220
  const pad = { top: 12, right: 20, bottom: 34, left: 36 }
  const innerW = w - pad.left - pad.right
  const innerH = h - pad.top - pad.bottom
  const baselineY = pad.top + innerH
  if (topicCards.length === 0) {
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Time by topic">
        <text x={w / 2} y={h / 2} fontSize={13} fill="var(--syn-muted)" textAnchor="middle">Answer questions to see time by topic</text>
      </svg>
    )
  }
  const vals = topicCards.map((t) => (t.avg_time_ms != null ? Math.round(t.avg_time_ms / 1000) : 0))
  const timeMax = Math.max(60, ...vals)
  const xStep = innerW / Math.max(topicCards.length - 1, 1)
  const pt = (i, v) => {
    const x = pad.left + i * xStep
    const y = pad.top + (1 - (v / timeMax)) * innerH
    return [x, y]
  }
  const points = vals.map((v, i) => pt(i, v))
  let linePath = ''
  points.forEach(([x, y], i) => { linePath += (i ? ' L ' : 'M ') + x + ' ' + y })
  const areaPath = linePath
    ? `M ${points[0][0]} ${baselineY} L ${points.map(([x, y]) => `${x} ${y}`).join(' L ')} L ${points[points.length - 1][0]} ${baselineY} Z`
    : ''
  const yTicks = [0, Math.round(timeMax / 3), Math.round((2 * timeMax) / 3), timeMax].filter((v, i, a) => a.indexOf(v) === i)
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Time by topic">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#16a34a" stopOpacity={0.35} />
          <stop offset="100%" stopColor="#16a34a" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={w} height={h} fill="transparent" />
      {areaPath && <path d={areaPath} fill={`url(#${gid})`} />}
      {linePath && <path d={linePath} fill="none" stroke="#16a34a" strokeWidth={2} />}
      {points.map(([x, y], i) => {
        const t = topicCards[i]
        const topicName = t?.topic_name || 'Topic'
        const secs = vals[i]
        const tooltip = `${topicName}: ${secs}s`
        return (
          <circle key={i} cx={x} cy={y} r={3} fill="#16a34a" stroke="#fff" strokeWidth={1}>
            <title>{tooltip}</title>
          </circle>
        )
      })}
      {yTicks.map((tick) => {
        const y = pad.top + (1 - (tick / timeMax)) * innerH
        return (
          <g key={tick}>
            <line x1={pad.left} y1={y} x2={pad.left - 4} y2={y} stroke="#e2e8f0" strokeWidth={1} />
            <text x={pad.left - 6} y={y + 3} fontSize={9} fill="var(--syn-muted)" textAnchor="end">{tick}s</text>
          </g>
        )
      })}
      {topicCards.map((t, i) => {
        const x = pad.left + i * xStep
        const label = truncateTopicLabel(t.topic_name || 'Topic', 14)
        return (
          <g key={t.topic_id || i}>
            <line x1={x} y1={baselineY} x2={x} y2={baselineY + 4} stroke="#e2e8f0" strokeWidth={1} />
            <text x={x} y={h - 8} fontSize={8} fill="var(--syn-muted)" textAnchor="middle">{label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function renderTrendChart(days) {
  const width = 820
  const height = 180
  const padding = { top: 10, right: 20, bottom: 26, left: 36 }
  const innerW = width - padding.left - padding.right
  const innerH = height - padding.top - padding.bottom

  const accVals = days.map(d => (d.accuracy_pct ?? null))
  const timeVals = days.map(d => (d.avg_time_ms != null ? Math.round(d.avg_time_ms / 1000) : null))

  const xStep = innerW / Math.max(days.length - 1, 1)
  const accMax = 100
  const timeMax = Math.max(60, Math.max(...timeVals.filter(v => v != null), 0))

  const pt = (i, v, max) => {
    const x = padding.left + i * xStep
    const y = padding.top + (1 - (v / max)) * innerH
    return [x, y]
  }

  const buildPath = (values, max) => {
    const pts = values.map((v, i) => (v == null ? null : pt(i, v, max)))
    let d = ''
    let started = false
    pts.forEach((p) => {
      if (!p) { started = false; return }
      const [x, y] = p
      if (!started) { d += `M ${x} ${y}`; started = true } else { d += ` L ${x} ${y}` }
    })
    return d
  }

  const accPath = buildPath(accVals, accMax)
  const timePath = buildPath(timeVals, timeMax)

  const xTicks = [0, Math.floor(days.length / 2), days.length - 1].filter(v => v >= 0)
  const accTicks = [0, 25, 50, 75, 100]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" role="img" aria-label="Performance trend chart">
      <rect x="0" y="0" width={width} height={height} fill="var(--surface-card)" rx="12" />
      {accTicks.map((t, i) => {
        const y = padding.top + (1 - (t / accMax)) * innerH
        return <line key={`g-${i}`} x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--syn-border)" />
      })}
      {xTicks.map((i) => {
        const x = padding.left + i * xStep
        return <text key={`xt-${i}`} x={x} y={height - 6} textAnchor="middle" fontSize="11" fill="var(--syn-muted)">{i === 0 ? 'Day 1' : i === days.length - 1 ? `Day ${days.length}` : `Day ${i + 1}`}</text>
      })}
      {accTicks.map((t) => {
        const y = padding.top + (1 - (t / accMax)) * innerH
        return <text key={`yt-a-${t}`} x={6} y={y + 3} fontSize="11" fill="var(--syn-muted)">{t}</text>
      })}
      {timePath && <path d={timePath} fill="none" stroke="#16a34a" strokeWidth="2.25" />}
      {accPath && <path d={accPath} fill="none" stroke="#3b82f6" strokeWidth="2.25" />}
      <g transform={`translate(${width - padding.right - 160}, ${padding.top + 4})`}>
        <circle cx="6" cy="6" r="4" fill="#3b82f6" />
        <text x="16" y="9" fontSize="12" fill="var(--syn-navy-700)">Accuracy (%)</text>
      </g>
      <g transform={`translate(${width - padding.right - 160}, ${padding.top + 22})`}>
        <circle cx="6" cy="6" r="4" fill="#16a34a" />
        <text x="16" y="9" fontSize="12" fill="var(--syn-navy-700)">Avg Time (s)</text>
      </g>
    </svg>
  )
}
