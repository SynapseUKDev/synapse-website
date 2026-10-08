import { useId } from 'react'
import { REVIEW_STATUSES, filterTopics } from './reviewModel'

function countsText(c = {}) {
  return [
    `${c.active ?? 0} active`,
    `${c.validated ?? 0} validated`,
    `${c.needsAttention ?? 0} needs attention`,
    `${c.mediaPending ?? 0} awaiting image`,
    `${c.draft ?? 0} draft`,
    `${c.published ?? 0} published`,
    `${c.legacyActive ?? 0} legacy`,
  ].join(' · ')
}

export default function TopicList({ topics, query, status, onQuery, onStatus, selectedId, onSelect }) {
  const searchId = useId()
  const statusId = useId()
  const visible = filterTopics(topics, { query, status })
  return (
    <div className="fcv2a-topics">
      <div className="fcv2a-topics__filters">
        <label htmlFor={searchId} className="fcv2a-label">
          Search topics
        </label>
        <input id={searchId} type="search" value={query} onChange={(e) => onQuery(e.target.value)} />
        <label htmlFor={statusId} className="fcv2a-label">
          Review status
        </label>
        <select id={statusId} value={status} onChange={(e) => onStatus(e.target.value)}>
          <option value="">All</option>
          {REVIEW_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value="none">No review</option>
        </select>
      </div>
      <p className="fcv2a-muted" aria-live="polite">{`${visible.length} of ${topics.length} topics`}</p>
      <ul aria-label="Flashcard topics" className="fcv2a-topics__list">
        {visible.map((t) => (
          <li key={t.topicId}>
            <button
              type="button"
              className={`fcv2a-topic${t.topicId === selectedId ? ' is-active' : ''}`}
              aria-pressed={t.topicId === selectedId}
              onClick={() => onSelect(t)}
            >
              <span className="fcv2a-topic__name">{t.topicName || t.topicId}</span>
              <span className="fcv2a-topic__meta">
                {t.specialtyName} · <code>{t.reviewStatus ?? 'no review'}</code>
              </span>
              <span className="fcv2a-topic__counts">{countsText(t.counts)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
