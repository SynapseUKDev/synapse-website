import { Link } from 'react-router-dom'
import Expandable from './Expandable'
import { pct, specialtyPracticeLink } from '../analyticsFormat'

/** Mirrors MASTERY.MIN_ATTEMPTS_TESTED in the backend's mastery/masteryBands.ts.
 *  Below this, a specialty has no meaningful mastery score. */
const MIN_ATTEMPTS_TESTED = 5

/** A specialty under the attempt threshold must not present a mastery figure:
 *  one lucky question would otherwise render as a confident percentage while
 *  the tile is styled and legended as untested. */
function tileFigures(s) {
  if (s.band !== 'untested') {
    return { value: pct(s.mastery), note: `${s.attempts} answered` }
  }
  if (s.attempts > 0) {
    return { value: `${s.attempts} / ${MIN_ATTEMPTS_TESTED}`, note: 'to unlock mastery' }
  }
  return { value: 'Not started', note: `${s.questions_available} questions` }
}

export default function SpecialtyMap({ specialties, perRow = 6 }) {
  const list = specialties || []
  if (!list.length) return null
  const hidden = Math.max(0, list.length - perRow)
  return (
    <div className="an-card">
      <div className="an-card__head">
        <div>
          <h2 className="an-card__title">Specialty map</h2>
          <p className="an-card__sub">Mastery per specialty, weakest first · open one to practise its topics</p>
        </div>
      </div>
      <Expandable collapsedLabel={`Show all ${list.length} specialties`} openLabel="Show fewer">
        {(open) => (
          <div className="an-map">
            {list.slice(0, open ? list.length : perRow).map((s) => {
              const fig = tileFigures(s)
              return (
                <Link key={s.specialty_id} to={specialtyPracticeLink(s)} className={`an-sp an-sp--${s.band}`}>
                  <div className="an-sp__n">{s.name}</div>
                  <div className="an-sp__m">{fig.value}</div>
                  <div className="an-sp__c">{fig.note}</div>
                </Link>
              )
            })}
          </div>
        )}
      </Expandable>
      {hidden === 0 ? null : (
        <div className="an-keys">
          <span><i className="an-keys__sw an-keys__sw--weak" />Weak &lt;60%</span>
          <span><i className="an-keys__sw an-keys__sw--developing" />Developing 60–75%</span>
          <span><i className="an-keys__sw an-keys__sw--strong" />Strong ≥75%</span>
          <span><i className="an-keys__sw an-keys__sw--untested" />Untested</span>
        </div>
      )}
    </div>
  )
}
