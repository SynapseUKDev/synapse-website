import { Link } from 'react-router-dom'
import Expandable from './Expandable'
import { pct, textbookLink } from '../analyticsFormat'

const SHOW = 6

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function ReadingVsPractice({ data }) {
  const readOnly = data?.read_not_practised || []
  const practisedOnly = data?.practised_not_read || []
  return (
    <div className="an-card">
      <div className="an-card__head">
        <div>
          <h2 className="an-card__title">Reading vs practice</h2>
          <p className="an-card__sub">Topics where you've done one but not the other</p>
        </div>
      </div>
      <Expandable collapsedLabel="Show the topics" openLabel="Hide the topics">
        {(open) => (
          <>
            <div className="an-rv">
              <div><b>{readOnly.length}</b><span>read in the textbook, never practised</span></div>
            </div>
            {open ? (
              <div className="an-rvlist">
                {readOnly.slice(0, SHOW).map((t) => (
                  <Link key={t.topic_id} to={textbookLink(t.slug)} className="an-rvlist__i">{t.name}<span>read {fmtDate(t.last_read_at)}</span></Link>
                ))}
                {readOnly.length > SHOW ? <div className="an-rvlist__i">+ {readOnly.length - SHOW} more</div> : null}
              </div>
            ) : null}
            <div className="an-rv">
              <div><b>{practisedOnly.length}</b><span>practised, never opened in the textbook</span></div>
            </div>
            {open ? (
              <div className="an-rvlist">
                {practisedOnly.slice(0, SHOW).map((t) => (
                  <Link key={t.topic_id} to={textbookLink(t.slug)} className="an-rvlist__i">{t.name}<span>{pct(t.mastery)} · {t.attempts} attempts</span></Link>
                ))}
                {practisedOnly.length > SHOW ? <div className="an-rvlist__i">+ {practisedOnly.length - SHOW} more</div> : null}
              </div>
            ) : null}
            <p className="an-note">A topic you've read but never practised is untested knowledge. A topic you practise without reading is where accuracy tends to stall.</p>
          </>
        )}
      </Expandable>
    </div>
  )
}
