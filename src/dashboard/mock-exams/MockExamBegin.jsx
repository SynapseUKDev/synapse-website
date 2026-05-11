import React, { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import './MockExams.css'
import { getMockExamById } from './mockExamsData.js'

export default function MockExamBegin() {
  const { examId } = useParams()
  const navigate = useNavigate()
  const exam = getMockExamById(examId)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [examId])

  if (!exam) {
    return (
      <div className="me-begin">
        <div className="me-begin__card">
          <p className="me-begin__text">This mock exam was not found.</p>
          <div className="me-begin__actions">
            <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
              Back to mock exams
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="me-begin">
      <div className="me-begin__card">
        <div className="me-begin__label">{exam.label}</div>
        <h1 className="me-begin__title">{exam.title}</h1>
        <p className="me-begin__text">
          You are about to start a timed session ({exam.question_count} questions · {exam.duration_minutes}{' '}
          minutes). The exam player will load here once questions are wired to the database.
        </p>
        <div className="me-begin__actions">
          <button type="button" className="me-btn me-btn--ghost" onClick={() => navigate('/dashboard/mock-exams')}>
            Back
          </button>
          <button type="button" className="me-btn" disabled title="Coming soon">
            Begin timed exam
          </button>
        </div>
      </div>
    </div>
  )
}
