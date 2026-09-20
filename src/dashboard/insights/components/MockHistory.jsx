import { useMemo } from 'react'

/** Bars are drawn to a fixed 572x230 viewBox and scaled by CSS, so the SVG needs no measurement. */
const W = 572
const PLOT_LEFT = 34
const PLOT_RIGHT = 556
const BASELINE = 190
const TOP = 10

function barPath(x, w, y) {
  // Radius has to shrink with the bar: a fixed 4 exceeds half the width on a thin bar and
  // overshoots the baseline on a short one, and the path self-intersects into a bowtie
  // instead of drawing a sliver. A 0% score is a real value, so this is reachable.
  const h = BASELINE - y
  const r = Math.max(0, Math.min(4, w / 2, h))
  if (r === 0) return `M${x},${BASELINE} L${x},${y} L${x + w},${y} L${x + w},${BASELINE} Z`
  return `M${x},${BASELINE} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${BASELINE} Z`
}

export default function MockHistory({ mock }) {
  const attempts = mock?.attempts || []
  const passPct = (mock?.pass_pct ?? 0.5) * 100

  const bars = useMemo(() => {
    if (!attempts.length) return []
    const span = PLOT_RIGHT - PLOT_LEFT
    // Width comes from the slot each bar would get, so bars thin out rather than
    // overlapping as papers accumulate. Position is edge-anchored so the chart stays
    // flush left and right at every count — slot-centring wasted a fifth of the width
    // at two or three attempts, which is where most students are.
    const w = Math.max(2, Math.min(52, (span / attempts.length) * 0.62))
    const step = attempts.length > 1 ? (span - w) / (attempts.length - 1) : 0
    const left = attempts.length > 1 ? PLOT_LEFT : PLOT_LEFT + (span - w) / 2
    const scale = (BASELINE - TOP) / 100
    return attempts.map((a, i) => {
      const h = Math.max(2, a.pct * scale)
      return { ...a, x: left + i * step, w, y: BASELINE - h }
    })
  }, [attempts])

  if (!attempts.length) {
    return (
      <div className="an-card">
        <h2 className="an-card__title">Mock papers</h2>
        <p className="an-card__sub">Your score on each paper you have submitted</p>
        <div className="an-exam__empty">
          <p>Sit a mock paper and your scores will appear here.</p>
          <a className="an-btn" href="/dashboard/mock-exams">Browse mock papers</a>
        </div>
      </div>
    )
  }

  const passY = BASELINE - passPct * ((BASELINE - TOP) / 100)
  const gain = mock.gain_since_first

  return (
    <div className="an-card">
      <h2 className="an-card__title">Mock papers</h2>
      <p className="an-card__sub">Your score on each paper you have submitted</p>
      <div className="an-exam__hero">
        <span className="an-exam__figure">{mock.latest_pct === null ? '—' : `${mock.latest_pct}%`}</span>
        {gain === null ? null : gain === 0 && attempts.length <= 1 ? null : gain === 0 ? (
          <span className="an-exam__delta">level with your first paper</span>
        ) : (
          <span className={`an-exam__delta ${gain > 0 ? 'is-up' : 'is-down'}`}>
            {gain > 0 ? '+' : ''}{gain} points since your first paper
          </span>
        )}
      </div>
      <svg className="an-exam__svg" viewBox={`0 0 ${W} 230`} role="img"
        aria-label={`Scores on ${attempts.length} submitted mock paper${attempts.length === 1 ? '' : 's'}, oldest first. Pass mark ${passPct} per cent. ${attempts.filter((a) => a.passed).length} at or above it.`}>
        <line x1={PLOT_LEFT} y1={BASELINE} x2={PLOT_RIGHT} y2={BASELINE} className="an-exam__axis" />
        {bars.map((b) => (
          <path key={b.attempt_id} d={barPath(b.x, b.w, b.y)} className={b.passed ? 'an-exam__bar--pass' : 'an-exam__bar--fail'} />
        ))}
        <line x1={PLOT_LEFT - 4} y1={passY} x2={PLOT_RIGHT + 4} y2={passY} className="an-exam__passline" />
        <text x={PLOT_RIGHT} y={passY - 4} textAnchor="end" className="an-exam__passlabel">PASS {passPct}%</text>
      </svg>
      <div className="an-exam__legend">
        <span><i className="an-exam__sw an-exam__sw--pass" />At or above pass</span>
        <span><i className="an-exam__sw an-exam__sw--fail" />Below pass</span>
      </div>
    </div>
  )
}
