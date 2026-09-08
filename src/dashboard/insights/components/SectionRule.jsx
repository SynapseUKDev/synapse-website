/** Labelled hairline that separates the page into bands. Presentational only. */
export default function SectionRule({ label }) {
  return (
    <div className="an-sec">
      <span className="an-sec__t">{label}</span>
      <i className="an-sec__r" />
    </div>
  )
}
