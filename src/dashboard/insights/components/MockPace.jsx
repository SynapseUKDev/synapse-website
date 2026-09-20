const W = 572
const PLOT_LEFT = 34
const BASELINE = 170
const TOP = 20
const BAR_W = 40
const STEP = 52

function barPath(x, y) {
  // Radius has to shrink with the bar: a fixed 4 exceeds half the width on a thin bar and
  // overshoots the baseline on a short one, and the path self-intersects into a bowtie
  // instead of drawing a sliver. A 0% share is a real value, so this is reachable.
  const h = BASELINE - y
  const r = Math.max(0, Math.min(4, BAR_W / 2, h))
  if (r === 0) return `M${x},${BASELINE} L${x},${y} L${x + BAR_W},${y} L${x + BAR_W},${BASELINE} Z`
  return `M${x},${BASELINE} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + BAR_W - r},${y} Q${x + BAR_W},${y} ${x + BAR_W},${y + r} L${x + BAR_W},${BASELINE} Z`
}

export default function MockPace({ mock }) {
  const pace = mock?.pace || []
  const total = pace.reduce((s, b) => s + b.answers, 0)

  if (!total) {
    return (
      <div className="an-card">
        <h2 className="an-card__title">Pace</h2>
        <p className="an-card__sub">When you answer across a paper, in tenths of the time allowed</p>
        <div className="an-exam__empty">
          <p>Once you have submitted a paper, your pacing will appear here.</p>
        </div>
      </div>
    )
  }

  const maxShare = Math.max(...pace.map((b) => b.share_pct), 10)
  const scale = (BASELINE - TOP) / Math.max(maxShare, 1)
  const evenY = BASELINE - 10 * scale

  return (
    <div className="an-card">
      <h2 className="an-card__title">Pace</h2>
      <p className="an-card__sub">When you answer across a paper, in tenths of the time allowed</p>
      <div className="an-exam__hero">
        <span className="an-exam__figure">{mock.late_share_pct}%</span>
        <span className={mock.pace.some((b) => b.flagged) ? 'an-exam__delta is-warn' : 'an-exam__delta'}>of your answers land in the last fifth</span>
      </div>
      <svg className="an-exam__svg" viewBox={`0 0 ${W} 210`} role="img"
        aria-label={`Share of answers in each tenth of the paper. ${mock.late_share_pct} per cent fall in the last fifth.`}>
        <line x1={PLOT_LEFT} y1={BASELINE} x2={PLOT_LEFT + 9 * STEP + BAR_W} y2={BASELINE} className="an-exam__axis" />
        {pace.map((b) => {
          const h = Math.max(2, b.share_pct * scale)
          return <path key={b.bucket} d={barPath(PLOT_LEFT + b.bucket * STEP, BASELINE - h)} className={b.flagged ? 'an-exam__bar--warn' : 'an-exam__bar--pace'} />
        })}
        <line x1={PLOT_LEFT - 4} y1={evenY} x2={PLOT_LEFT + 9 * STEP + BAR_W + 4} y2={evenY} className="an-exam__passline" />
        <text x={PLOT_LEFT + 9 * STEP + BAR_W} y={evenY - 4} textAnchor="end" className="an-exam__passlabel">EVEN PACE</text>
        <text x={PLOT_LEFT} y={190} className="an-exam__axislabel">Start of paper</text>
        <text x={PLOT_LEFT + 9 * STEP + BAR_W} y={190} textAnchor="end" className="an-exam__axislabel">Time runs out</text>
      </svg>
      <div className="an-exam__legend">
        <span><i className="an-exam__sw an-exam__sw--pace" />Answers in each tenth</span>
        <span><i className="an-exam__sw an-exam__sw--warn" />Late rush</span>
      </div>
      <p className="an-card__sub">A late rush usually means time lost earlier in the paper, not speed at the end.</p>
    </div>
  )
}
