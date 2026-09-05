import { Link } from 'react-router-dom'

/**
 * report: null | { id, period_start, headline, plan_done, plan_total }
 * eligibility: { eligible, reason, min_attempts } from the overview's report_eligibility
 *   reason 'ok'                    — entitled, a report is simply on its way
 *   reason 'insufficient_activity' — entitled, but answered too few questions last month
 *   reason 'insufficient_coverage' — entitled, but practice was too narrow to plan from
 *   reason 'not_paying'            — not entitled; show the teaser
 */
const COPY = {
  ok: (n) => ({
    title: 'Your first report is on its way',
    body: `On the 1st of each month we look at your answers and write a plan for your weakest topics. Answer at least ${n} questions a month to receive one.`,
  }),
  insufficient_activity: (n) => ({
    title: 'Not enough practice last month',
    body: `Answer at least ${n} questions a month to receive a report.`,
  }),
  insufficient_coverage: () => ({
    title: 'Your practice was too narrow',
    body: 'Spread your practice across more topics to receive a report.',
  }),
  not_paying: () => ({
    title: 'Get a monthly study plan',
    body: 'Subscribers receive an AI-written report each month: weakest topics, what improved, and a checklist to work through.',
  }),
}

export default function ReportCard({ report, eligibility }) {
  if (report) {
    const p = report.plan_total ? Math.round((report.plan_done / report.plan_total) * 100) : 0
    return (
      <div className="an-card an-ai">
        <p className="an-eyebrow an-ai__eyebrow">Monthly AI report</p>
        <h2 className="an-card__title">{report.headline}</h2>
        <p className="an-card__sub an-ai__sub">{report.plan_done} of {report.plan_total} plan steps done</p>
        <div className="an-ai__prog"><i style={{ width: `${p}%` }} /></div>
        <Link className="an-btn an-btn--gold" to={`/dashboard/analytics/report/${report.id}`}>Open full report</Link>
      </div>
    )
  }

  const eligible = !!eligibility?.eligible
  const reason = eligible ? (COPY[eligibility?.reason] ? eligibility.reason : 'ok') : 'not_paying'
  const { title, body } = COPY[reason](eligibility?.min_attempts ?? 30)

  return (
    <div className="an-card an-ai">
      <p className="an-eyebrow an-ai__eyebrow">Monthly AI report</p>
      <h2 className="an-card__title">{title}</h2>
      <p className="an-card__sub an-ai__sub">{body}</p>
      {eligible ? null : <Link className="an-btn an-btn--gold" to="/subscribe">See plans</Link>}
    </div>
  )
}
