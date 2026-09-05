import { LuFlame, LuPercent, LuListChecks, LuCircleCheck } from 'react-icons/lu'
import { delta, pct } from '../analyticsFormat'

function Tile({ icon, tone, label, value, chip, compare }) {
  return (
    <div className="an-card an-kpi">
      <div className={`an-kpi__ico an-kpi__ico--${tone}`}>{icon}</div>
      <div className="an-kpi__body">
        <div className="an-kpi__lbl">{label}</div>
        <div className="an-kpi__val">
          {value}
          {chip ? <span className={`an-chip an-chip--${chip.dir}`}>{chip.text}</span> : null}
        </div>
        {compare ? <div className="an-kpi__cmp">{compare}</div> : null}
      </div>
    </div>
  )
}

export default function KpiDeck({ kpis, allTime }) {
  if (!kpis) return null
  const cmp = allTime ? null : 'vs previous period'
  return (
    <div className="an-row an-row--4">
      <Tile icon={<LuPercent />} tone="cyan" label="Accuracy" value={pct(kpis.accuracy.value)} chip={delta(kpis.accuracy.value, kpis.accuracy.previous, 'ratio')} compare={cmp} />
      <Tile icon={<LuListChecks />} tone="blue" label="Questions" value={kpis.questions.value} chip={delta(kpis.questions.value, kpis.questions.previous, 'count')} compare={cmp} />
      <Tile
        icon={<LuCircleCheck />}
        tone="mint"
        label="Topics covered"
        value={<>{kpis.topics_covered.value} <small>/ {kpis.topics_covered.total}</small></>}
        compare="5+ attempts each"
      />
      <Tile
        icon={<LuFlame />}
        tone="gold"
        label="Streak"
        value={<>{kpis.streak_days} <small>days</small></>}
        compare={`today ${kpis.today.questions} / ${kpis.today.target} questions`}
      />
    </div>
  )
}
