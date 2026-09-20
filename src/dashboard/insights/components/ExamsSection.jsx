import useStaleJson from '../../../utils/useStaleJson'
import { authHeaders } from '../../../auth/token'
import SectionRule from './SectionRule'
import MockHistory from './MockHistory'
import MockPace from './MockPace'
import OsceDomains from './OsceDomains'
import OsceCalibration from './OsceCalibration'

export default function ExamsSection({ window: win }) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
  const req = useStaleJson(`${API_BASE}/analytics/exams?window=${win}`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 60_000,
    persist: 'session',
    key: `analytics:exams:${win}`,
  })

  const d = req.data

  // Hidden only while we genuinely do not know what to show: still loading, or the
  // request failed. "No exam data yet" is NOT that case — each card has a designed
  // empty state with a call to action, and a student who has never sat a mock paper is
  // exactly who needs to see it. Hiding the section made the feature invisible to the
  // people it exists for.
  if (!d) {
    // A failed request must not masquerade as "you have nothing yet" — that is a lie
    // told in the student's own words. In production it stays silent; locally it says
    // what broke, because an invisible section is indistinguishable from a missing
    // route, an unapplied migration, or an empty account.
    if (req.error && import.meta.env.DEV) {
      return (
        <>
          <SectionRule label="Exams" />
          <div className="an-card an-error">
            Exams data could not be loaded: {String(req.error.message || req.error)}
          </div>
        </>
      )
    }
    return null
  }

  return (
    <>
      <SectionRule label="Exams" />
      <div className="an-row an-row--11">
        <MockHistory mock={d.mock} />
        <MockPace mock={d.mock} />
      </div>
      <div className="an-row an-row--11">
        <OsceDomains osce={d.osce} />
        {/* Still gated, and for a different reason than emptiness: nothing in the app
            writes user_osce_attempts.confidence, so this card cannot fill in no matter
            what a student does. Its empty state would tell them to record something the
            UI never asks for. Ungate this the moment confidence is actually collected. */}
        {d.osce?.calibration?.placed > 0 ? <OsceCalibration osce={d.osce} /> : null}
      </div>
    </>
  )
}
