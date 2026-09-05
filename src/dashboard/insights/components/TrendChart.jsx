import { useMemo } from 'react'

const W = 600
const H = 190
const PAD_L = 34
const PAD_R = 6
const MIN_Y = 0.4
const MAX_Y = 1

function yFor(acc) {
  const clamped = Math.max(MIN_Y, Math.min(MAX_Y, acc))
  return H - ((clamped - MIN_Y) / (MAX_Y - MIN_Y)) * (H - 10) - 5
}

export default function TrendChart({ trend }) {
  const { bars, line, maxQ } = useMemo(() => {
    const pts = trend || []
    const maxQ = Math.max(1, ...pts.map((p) => p.questions))
    const step = (W - PAD_L - PAD_R) / Math.max(1, pts.length)
    const barW = Math.max(2, step * 0.6)
    const bars = pts.map((p, i) => {
      const h = (p.questions / maxQ) * (H - 20)
      return { x: PAD_L + i * step + (step - barW) / 2, y: H - h, w: barW, h, date: p.date, q: p.questions }
    })
    const line = pts
      .map((p, i) => (p.accuracy_rolling_7d === null ? null : `${(PAD_L + i * step + step / 2).toFixed(1)},${yFor(p.accuracy_rolling_7d).toFixed(1)}`))
      .filter(Boolean)
      .join(' ')
    return { bars, line, maxQ }
  }, [trend])

  const empty = !trend || trend.every((p) => p.questions === 0)

  return (
    <div className="an-card">
      <div className="an-card__head">
        <div>
          <h2 className="an-card__title">Accuracy trend</h2>
          <p className="an-card__sub">7-day rolling accuracy over daily volume</p>
        </div>
      </div>
      {empty ? (
        <div className="an-empty">No questions answered in this period yet.</div>
      ) : (
        <div className="an-chart" role="img" aria-label="Accuracy trend chart">
          <span className="an-chart__ax" style={{ top: 6 }}>100%</span>
          <span className="an-chart__ax" style={{ top: '48%' }}>70%</span>
          <span className="an-chart__ax" style={{ bottom: 6 }}>40%</span>
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
            {bars.map((b) => (
              <rect key={b.date} x={b.x} y={b.y} width={b.w} height={b.h} rx="3" className="an-chart__bar">
                <title>{`${b.date}: ${b.q} questions`}</title>
              </rect>
            ))}
            {line ? <polyline points={line} className="an-chart__line" /> : null}
          </svg>
        </div>
      )}
      <div className="an-legend">
        <span><i className="an-legend__sw an-legend__sw--line" />Accuracy</span>
        <span><i className="an-legend__sw an-legend__sw--bar" />Questions per day (max {maxQ})</span>
      </div>
    </div>
  )
}
