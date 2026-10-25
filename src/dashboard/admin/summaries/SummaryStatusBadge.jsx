import React from 'react'
import { LuArchive, LuCircleCheck, LuPencilLine } from 'react-icons/lu'
import './AdminSummaries.css'

const STATUS = {
  published: { label: 'Published', Icon: LuCircleCheck },
  draft: { label: 'Draft', Icon: LuPencilLine },
  archived: { label: 'Withdrawn', Icon: LuArchive },
}

/** Summary status conveyed by text and icon as well as colour. */
export default function SummaryStatusBadge({ status }) {
  const { label, Icon } = STATUS[status] || { label: status, Icon: LuPencilLine }
  return (
    <span className={`asum-status asum-status--${status}`}>
      <Icon aria-hidden />
      {label}
    </span>
  )
}

const VALIDATION = { passed: 'Passed', needs_review: 'Needs review', failed: 'Failed' }

/** Validation result of a version, as text plus colour. */
export function ValidationBadge({ status, prefix = '' }) {
  return (
    <span className={`asum-badge asum-badge--${VALIDATION[status] ? status : 'neutral'}`}>
      {prefix}{VALIDATION[status] || status}
    </span>
  )
}
