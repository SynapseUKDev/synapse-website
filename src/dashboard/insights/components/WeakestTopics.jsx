import { Link } from 'react-router-dom'
import Expandable from './Expandable'
import { pct, practiceLink, trendArrow } from '../analyticsFormat'

const FIRST = 5

function TopicRow({ t, i }) {
  const arrow = trendArrow(t.trend)
  return (
    <div className="an-tp">
      <div className="an-tp__rank">{i + 1}</div>
      <div className="an-tp__name">
        <b>{t.name}</b>
        <span>
          {t.attempts} attempts · {t.specialty_name}
          {t.reading_status === null || t.reading_status === 'not_read' ? <em className="an-pill an-pill--unread">not read</em> : null}
        </span>
      </div>
      <span className={`an-pill an-pill--${t.band}`}>{pct(t.mastery)}</span>
      <span
        className={`an-tr an-tr--${arrow.dir}`}
        title={arrow.dir === 'none' ? 'Not enough recent attempts to show a trend' : 'Change vs previous period'}
      >
        {arrow.glyph}
      </span>
      <Link className="an-btn an-btn--ghost an-tp__cta" to={practiceLink(t, 20)}>Practise 20</Link>
    </div>
  )
}

export default function WeakestTopics({ topics }) {
  const list = topics || []
  return (
    <div className="an-card">
      <div className="an-card__head">
        <div>
          <h2 className="an-card__title">Weakest topics</h2>
          <p className="an-card__sub">Lowest mastery with at least 5 attempts</p>
        </div>
      </div>
      {list.length === 0 ? (
        <div className="an-empty">Answer a few more questions and your weak spots will show up here.</div>
      ) : list.length <= FIRST ? (
        list.map((t, i) => <TopicRow key={t.topic_id} t={t} i={i} />)
      ) : (
        <Expandable collapsedLabel={`Show ${list.length - FIRST} more`} openLabel="Show fewer">
          {(open) => (
            <>
              {list.slice(0, open ? list.length : FIRST).map((t, i) => (
                <TopicRow key={t.topic_id} t={t} i={i} />
              ))}
              {open ? <p className="an-note">Mastery shrinks toward your average until a topic has about 10 attempts, so one bad session can't mark a topic weak.</p> : null}
            </>
          )}
        </Expandable>
      )}
    </div>
  )
}
