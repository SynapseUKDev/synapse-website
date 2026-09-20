import ActivityYear from './ActivityYear'

export default function ActivityCard() {
  return (
    <div className="an-card">
      <div className="an-card__head">
        <div>
          <h2 className="an-card__title">Activity</h2>
          <p className="an-card__sub">Everything you studied each day · questions, OSCE stations and mock papers</p>
        </div>
      </div>
      <div className="an-activity">
        <ActivityYear />
      </div>
    </div>
  )
}
