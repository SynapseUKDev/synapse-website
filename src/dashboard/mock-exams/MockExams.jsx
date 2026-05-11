import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LuClock, LuClipboardList, LuGraduationCap, LuStar } from 'react-icons/lu'
import './MockExams.css'
import { MOCK_EXAMS } from './mockExamsData.js'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'attempted', label: 'Attempted' },
  { id: 'completed', label: 'Completed' },
]

function MockExamRow({ exam }) {
  const navigate = useNavigate()
  const tint = exam.thumb_tint || 'violet'

  return (
    <article className="me-row">
      <div className={`me-row__thumb me-row__thumb--${tint}`} aria-hidden>
        <LuGraduationCap size={40} strokeWidth={1.5} />
      </div>
      <div className="me-row__main">
        <div className="me-row__head">
          <div className="me-row__titles">
            <span className="me-row__pill">{exam.label}</span>
            <h2 className="me-row__title">{exam.title}</h2>
          </div>
          <div className="me-row__rating" title={exam.last_score_pct != null ? 'Last score' : 'Not attempted yet'}>
            <LuStar size={16} strokeWidth={2.5} className="me-row__star" aria-hidden />
            {exam.last_score_pct != null ? (
              <span className="me-row__score">{exam.last_score_pct}%</span>
            ) : (
              <span className="me-row__score me-row__score--muted">—</span>
            )}
          </div>
        </div>
        <p className="me-row__summary">{exam.summary}</p>
        <div className="me-row__tags">
          {exam.tags.map((tag) => (
            <span key={tag} className="me-row__tag">
              {tag}
            </span>
          ))}
        </div>
        <div className="me-row__footer">
          <div className="me-row__info">
            <span className="me-row__info-line">
              <LuClipboardList size={16} aria-hidden />
              {exam.question_count} questions
            </span>
            <span className="me-row__info-dot" aria-hidden>
              ·
            </span>
            <span className="me-row__info-line">
              <LuClock size={16} aria-hidden />
              {exam.duration_minutes} min timed
            </span>
          </div>
          <button type="button" className="me-row__cta" onClick={() => navigate(`/dashboard/mock-exams/${exam.id}`)}>
            {exam.status === 'completed' ? 'Review' : exam.status === 'attempted' ? 'Continue' : 'Start exam'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function MockExams() {
  const [tab, setTab] = useState('all')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const filtered = useMemo(() => {
    if (tab === 'all') return MOCK_EXAMS
    return MOCK_EXAMS.filter((e) => e.status === tab)
  }, [tab])

  return (
    <div className="me">
      <header className="me__header">
        <h1 className="me__title">Mock exams</h1>
        <p className="me__subtitle">
          Timed papers in the same style as the question bank — everyone gets the same three mocks. Filter by
          progress, then open one to begin.
        </p>
      </header>

      <div className="me__tabs" role="tablist" aria-label="Filter mock exams">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`me__tab ${tab === t.id ? 'is-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className="me__dev-note">
        Timed delivery and scores from the database are coming soon — navigation and layout are ready.
      </p>

      <div className="me__list">
        {filtered.length === 0 ? (
          <div className="me__empty">No mock exams in this category yet.</div>
        ) : (
          filtered.map((exam) => <MockExamRow key={exam.id} exam={exam} />)
        )}
      </div>
    </div>
  )
}
