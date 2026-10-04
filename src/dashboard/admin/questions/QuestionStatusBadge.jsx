import React from 'react'
import { LuCircleCheck, LuPencilLine } from 'react-icons/lu'
import './AdminQuestions.css'

/** Status conveyed by text and icon as well as colour. */
export default function QuestionStatusBadge({ active, draftLabel = 'Inactive draft' }) {
  return (
    <span className={`aq-status ${active ? 'aq-status--active' : 'aq-status--draft'}`}>
      {active ? <LuCircleCheck aria-hidden /> : <LuPencilLine aria-hidden />}
      {active ? 'Active' : draftLabel}
    </span>
  )
}
