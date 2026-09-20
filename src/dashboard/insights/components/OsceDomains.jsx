export default function OsceDomains({ osce }) {
  const domains = osce?.domains || []

  if (!domains.length) {
    return (
      <div className="an-card">
        <h2 className="an-card__title">OSCE domains</h2>
        <p className="an-card__sub">Marks awarded as a share of marks available, weakest first</p>
        <div className="an-exam__empty">
          <p>Practise an OSCE station and your domain profile will appear here.</p>
          <a className="an-btn" href="/dashboard/osce">Browse stations</a>
        </div>
      </div>
    )
  }

  return (
    <div className="an-card">
      <h2 className="an-card__title">OSCE domains</h2>
      <p className="an-card__sub">Marks awarded as a share of marks available, weakest first</p>
      <ul className="an-dom">
        {domains.map((d) => (
          <li key={d.title} className="an-dom__row">
            <span className="an-dom__name">{d.title}</span>
            <span className="an-dom__track"><i style={{ width: `${d.pct}%` }} /></span>
            <span className="an-dom__pct">{d.pct}%</span>
            <span className={`an-dom__n ${d.thin_evidence ? 'is-thin' : ''}`}>
              {d.station_count} station{d.station_count === 1 ? '' : 's'}
            </span>
          </li>
        ))}
      </ul>
      <p className="an-card__sub">Station count is how much evidence sits behind each figure. One station is a single examiner's view, not a pattern.</p>
    </div>
  )
}
