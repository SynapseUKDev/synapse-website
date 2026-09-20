const CONF_RANK = { low: 0, moderate: 0.5, high: 1 }
const LABELS = { high: 'Felt high', moderate: 'Felt moderate', low: 'Felt low' }
const FALLBACK_RATINGS = ['fail', 'borderline', 'pass', 'good', 'excellent']

/** > 0 overconfident, < 0 underconfident, 0 calibrated. Mapped to a diverging step. */
function tintClass(confidence, ratingIndex, ratingCount) {
  const gap = CONF_RANK[confidence] - ratingIndex / (ratingCount - 1)
  if (gap >= 0.8) return 'is-over-3'
  if (gap >= 0.5) return 'is-over-2'
  if (gap >= 0.2) return 'is-over-1'
  if (gap <= -0.8) return 'is-under-3'
  if (gap <= -0.5) return 'is-under-2'
  if (gap <= -0.2) return 'is-under-1'
  return 'is-even'
}

export default function OsceCalibration({ osce }) {
  const cal = osce?.calibration
  const placed = cal?.placed || 0

  if (!cal || (placed === 0 && !cal.unplaceable)) {
    return (
      <div className="an-card">
        <h2 className="an-card__title">How well you judge yourself</h2>
        <p className="an-card__sub">The confidence you recorded against the rating you were given</p>
        <div className="an-exam__empty">
          <p>Record how confident you felt at the end of a station to fill this in.</p>
        </div>
      </div>
    )
  }

  const ratings = cal.ratings?.length ? cal.ratings : FALLBACK_RATINGS
  const confidenceLevels = cal.confidence_levels?.length ? cal.confidence_levels : ['high', 'moderate', 'low']

  return (
    <div className="an-card">
      <h2 className="an-card__title">How well you judge yourself</h2>
      <p className="an-card__sub">The confidence you recorded against the rating you were given</p>
      {cal.overconfident > 0 ? (
        <p className="an-exam__delta is-down">
          {cal.overconfident} station{cal.overconfident === 1 ? '' : 's'} where you felt confident and scored borderline or below.
        </p>
      ) : null}
      <table className="an-cal">
        <thead>
          <tr>
            <th scope="col"><span className="an-cal__hide">Confidence</span></th>
            {ratings.map((r) => <th key={r} scope="col">{r}</th>)}
          </tr>
        </thead>
        <tbody>
          {confidenceLevels.map((c) => (
            <tr key={c}>
              <th scope="row">{LABELS[c]}</th>
              {ratings.map((r, ri) => (
                <td key={r} className={`an-cal__cell ${tintClass(c, ri, ratings.length)}`}>
                  {cal.cells?.[c]?.[r] ?? 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="an-cal__key">
        <span>Overconfident</span><i /><span>Underconfident</span>
      </div>
      {cal.unplaceable > 0 ? (
        <p className="an-card__sub">{cal.unplaceable} station{cal.unplaceable === 1 ? '' : 's'} could not be placed because confidence or rating was not recorded.</p>
      ) : null}
    </div>
  )
}
