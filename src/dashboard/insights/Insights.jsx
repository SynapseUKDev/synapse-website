import React, { useEffect, useId, useMemo, useState } from 'react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import '../Dashboard.css'
import '../question-bank/QuestionBank.css'
import './Insights.css'
import { authHeaders } from '../../auth/token'
import { LuFlame, LuTimer, LuTarget, LuArrowLeft, LuTrendingUp, LuPercent, LuBookOpen, LuUsers } from 'react-icons/lu'
import LoadingScreen from '../../components/loading/LoadingScreen'
import useStaleJson from '../../utils/useStaleJson'
import {
  buildDemoTrend,
  aggregateTrendByWeekday,
  aggregateTrendByWeekdayForAccuracy,
  aggregateTrendByWeekdayForTime,
  renderQuestionsChart,
  renderAccuracyChartByWeekday,
  renderTimeChartByWeekday,
  renderQuestionsOverTime,
  renderAccuracyChart,
  renderTimeChart,
  renderAccuracyChartByTopic,
  renderTimeChartByTopic,
  dayOfWeek,
} from './dashboardAnalyticsCharts.jsx'

function formatDeltaPct(current, previous) {
  if (previous == null || previous <= 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  if (!Number.isFinite(pct)) return null
  return pct
}

function formatShortDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
  } catch {
    return '—'
  }
}

export default function Analytics() {
  const navigate = useNavigate()
  const { user } = useOutletContext() || {}
  const rawId = useId()
  const idP = `${rawId.replace(/:/g, '')}-`

  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const summaryReq = useStaleJson(`${API_BASE}/dashboard/summary`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 60_000,
    persist: 'session',
    key: 'dashboard:summary',
  })

  const trendReq = useStaleJson(`${API_BASE}/qbank/performance/trend`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'dashboard:trend',
    transform: (t) => ({
      days: Array.isArray(t.days)
        ? t.days.map((d) => ({
          date: d.date,
          questions_answered: d.questions_answered ?? 0,
          accuracy_pct: d.accuracy_pct ?? null,
          avg_time_ms: d.avg_time_ms ?? null,
        }))
        : buildDemoTrend(),
    }),
  })

  const topicsReq = useStaleJson(`${API_BASE}/qbank/topics?limit=50`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 5 * 60_000,
    persist: 'session',
    key: 'dashboard:topics',
    transform: (t) => ({ topics: Array.isArray(t?.topics) ? t.topics : [] }),
  })

  const insightsReq = useStaleJson(`${API_BASE}/dashboard/analytics-insights`, {
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    staleMs: 60_000,
    persist: 'session',
    key: 'dashboard:analytics-insights',
    transform: (j) => ({
      reading: {
        topic_progress: j?.reading?.topic_progress || { not_read: 0, in_progress: 0, completed: 0, total: 0 },
        subtopic_progress: j?.reading?.subtopic_progress || { not_read: 0, in_progress: 0, completed: 0, total: 0 },
        recent_topics: Array.isArray(j?.reading?.recent_topics) ? j.reading.recent_topics : [],
      },
      group_quiz: {
        sessions_joined: j?.group_quiz?.sessions_joined ?? 0,
        top_partners: Array.isArray(j?.group_quiz?.top_partners) ? j.group_quiz.top_partners : [],
      },
    }),
  })

  const summary = summaryReq.data || {
    study_streak_days: 0,
    time_today_minutes: 0,
    questions_today: 0,
    targets: { time_minutes: 180, questions: 30 },
  }
  const trend = trendReq.data?.days ?? buildDemoTrend()
  const trendLoading = trendReq.loading && !trendReq.data

  const topicCards = topicsReq.data?.topics ?? []

  const periodStats = useMemo(() => {
    const withAttempts = topicCards
      .filter((t) => (t.attempted_questions ?? 0) > 0)
      .sort((a, b) => (b.attempted_questions ?? 0) - (a.attempted_questions ?? 0))
    const topTopic = withAttempts[0]
    const days = trend || []
    const totalQuestions = days.reduce((s, d) => s + (d.questions_answered ?? 0), 0)
    const accDays = days.filter((d) => d.accuracy_pct != null)
    const avgAcc =
      accDays.length > 0
        ? Math.round(accDays.reduce((s, d) => s + Number(d.accuracy_pct), 0) / accDays.length)
        : null
    const n = days.length
    const half = Math.floor(n / 2)
    const firstHalf = days.slice(0, half)
    const secondHalf = days.slice(half)
    const sumQ = (arr) => arr.reduce((s, d) => s + (d.questions_answered ?? 0), 0)
    const qDelta = formatDeltaPct(sumQ(secondHalf), sumQ(firstHalf))
    const last7 = days.slice(-7)
    const prev7 = days.length >= 14 ? days.slice(-14, -7) : []
    const last7q = sumQ(last7)
    const prev7q = prev7.length ? sumQ(prev7) : null
    const weekDelta = prev7q != null && prev7q > 0 ? formatDeltaPct(last7q, prev7q) : null
    return {
      totalQuestions,
      avgAcc,
      qDelta,
      weekDelta,
      last7Days: last7,
      topTopicName: topTopic?.topic_name ?? null,
      topTopicAcc: topTopic?.accuracy_pct ?? null,
    }
  }, [trend, topicCards])

  const topicCardsWithAttempts = topicCards
    .filter((t) => (t.attempted_questions ?? 0) > 0)
    .sort((a, b) => (b.attempted_questions ?? 0) - (a.attempted_questions ?? 0))
    .slice(0, 12)
  const topicsLoading = topicsReq.loading && !topicsReq.data
  const insights = insightsReq.data
  const insightsLoading = insightsReq.loading && !insightsReq.data

  const displayName = user?.username || user?.email?.split('@')[0] || 'there'

  const [weekdayTab, setWeekdayTab] = useState('questions')
  const [dailyTab, setDailyTab] = useState('questions')
  const [topicTab, setTopicTab] = useState('accuracy')

  const weekdayPanelCopy = useMemo(() => {
    if (weekdayTab === 'accuracy') {
      return {
        subtitle: 'Average accuracy per weekday',
        detail:
          'Each point is the mean accuracy on calendar days in your trend that fall on that weekday (Sat–Fri). Only days where you had attempts and accuracy was recorded are included.',
      }
    }
    if (weekdayTab === 'time') {
      return {
        subtitle: 'Average time per question per weekday',
        detail:
          'Each point is the mean time per question (seconds) on trend days that fall on that weekday, using only days with timing. Higher values mean you typically spent longer per question.',
      }
    }
    return {
      subtitle: 'Average questions answered per weekday',
      detail:
        'Each point averages question counts from every day in your trend window on that weekday (Sat–Fri). If you studied multiple Mondays in the period, those days are averaged together.',
    }
  }, [weekdayTab])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const loading = summaryReq.loading && !summaryReq.data

  const maxBar = Math.max(1, ...periodStats.last7Days.map((d) => d.questions_answered ?? 0))
  const qTarget = summary?.targets?.questions || 30
  const qProgress = Math.min(100, Math.round(((summary?.questions_today ?? 0) / qTarget) * 100))
  const timeTarget = summary?.targets?.time_minutes || 180
  const timeProgress = Math.min(100, Math.round(((summary?.time_today_minutes ?? 0) / timeTarget) * 100))

  if (loading) {
    return (
      <div className="qb">
        <LoadingScreen message="Loading analytics…" inline />
      </div>
    )
  }

  return (
    <div className="qb analytics-shell">
      <header className="analytics-hero">
        <div className="analytics-hero__row">
          <button type="button" className="analytics-hero__back" onClick={() => navigate('/dashboard')}>
            <LuArrowLeft size={18} aria-hidden />
            <span>Dashboard</span>
          </button>
        </div>
        <div className="analytics-hero__row analytics-hero__row--main">
          <div className="analytics-hero__copy">
            <p className="analytics-hero__eyebrow">Your progress</p>
            <h1 className="analytics-hero__title">Welcome back{displayName === 'there' ? '' : `, ${displayName}`}</h1>
            <p className="analytics-hero__date">
              {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="analytics-kpi-deck" role="list">
          <div className="analytics-kpi analytics-kpi--flame" role="listitem">
            <div className="analytics-kpi__icon" aria-hidden>
              <LuFlame size={20} />
            </div>
            <div className="analytics-kpi__body">
              <span className="analytics-kpi__label">Streak</span>
              <span className="analytics-kpi__value">
                {summary?.study_streak_days ?? 0}{' '}
                <span className="analytics-kpi__unit">{summary?.study_streak_days === 1 ? 'day' : 'days'}</span>
              </span>
            </div>
          </div>
          <div className="analytics-kpi" role="listitem">
            <div className="analytics-kpi__icon analytics-kpi__icon--cyan" aria-hidden>
              <LuTarget size={20} />
            </div>
            <div className="analytics-kpi__body">
              <span className="analytics-kpi__label">Today · Questions</span>
              <span className="analytics-kpi__value">
                {summary?.questions_today ?? 0}
                <span className="analytics-kpi__unit"> / {qTarget}</span>
              </span>
              {periodStats.weekDelta != null && (
                <span className={`analytics-kpi__delta ${periodStats.weekDelta >= 0 ? 'is-up' : 'is-down'}`}>
                  {periodStats.weekDelta >= 0 ? '+' : ''}
                  {periodStats.weekDelta}% vs prior week
                </span>
              )}
            </div>
          </div>
          <div className="analytics-kpi" role="listitem">
            <div className="analytics-kpi__icon analytics-kpi__icon--mint" aria-hidden>
              <LuTimer size={20} />
            </div>
            <div className="analytics-kpi__body">
              <span className="analytics-kpi__label">Today · Study time</span>
              <span className="analytics-kpi__value">
                {summary?.time_today_minutes ?? 0}
                <span className="analytics-kpi__unit"> min</span>
              </span>
            </div>
          </div>
          <div className="analytics-kpi" role="listitem">
            <div className="analytics-kpi__icon analytics-kpi__icon--blue" aria-hidden>
              <LuPercent size={20} />
            </div>
            <div className="analytics-kpi__body">
              <span className="analytics-kpi__label">Period avg accuracy</span>
              <span className="analytics-kpi__value">
                {periodStats.avgAcc != null ? `${periodStats.avgAcc}%` : '—'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <div className="analytics-bento">
        <article className="analytics-card analytics-card--span-8 analytics-card--volume" aria-labelledby="analytics-volume-title">
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-volume-title" className="analytics-card__title">
                Practice volume
              </h2>
              <p className="analytics-card__sub">Questions answered across the days in your current trend window</p>
            </div>
            {periodStats.qDelta != null && (
              <span className={`analytics-pill ${periodStats.qDelta >= 0 ? 'analytics-pill--up' : 'analytics-pill--down'}`}>
                <LuTrendingUp size={14} aria-hidden />
                {periodStats.qDelta >= 0 ? '+' : ''}
                {periodStats.qDelta}% vs first half of period
              </span>
            )}
          </div>
          <div className="analytics-volume__big">
            <span className="analytics-volume__num">{periodStats.totalQuestions.toLocaleString()}</span>
            <span className="analytics-volume__suffix">questions</span>
          </div>
          <div className="analytics-bar-strip" role="img" aria-label="Last seven days question counts">
            {periodStats.last7Days.map((d) => {
              const q = d.questions_answered ?? 0
              const pct = maxBar > 0 ? (q / maxBar) * 100 : 0
              return (
                <div key={d.date} className="analytics-bar-strip__col" title={`${q} on ${d.date}`}>
                  <div className="analytics-bar-strip__bar-wrap">
                    <span className="analytics-bar-strip__value">{q.toLocaleString()}</span>
                    <div className="analytics-bar-strip__track">
                      <div
                        className="analytics-bar-strip__bar"
                        style={{
                          height: `${pct}%`,
                          minHeight: q > 0 ? 8 : 0,
                        }}
                      />
                    </div>
                  </div>
                  <span className="analytics-bar-strip__label">{dayOfWeek(d.date) || '—'}</span>
                </div>
              )
            })}
          </div>
        </article>

        <article className="analytics-card analytics-card--span-4 analytics-card--insight" aria-labelledby="analytics-insight-title">
          <p id="analytics-insight-title" className="analytics-insight__eyebrow">
            Snapshot
          </p>
          <h2 className="analytics-insight__title">Keep the rhythm</h2>
          <p className="analytics-insight__text">
            {periodStats.topTopicName
              ? `Strongest recent focus: ${periodStats.topTopicName}${
                  periodStats.topTopicAcc != null ? ` (${periodStats.topTopicAcc}% accuracy).` : '.'
                }`
              : 'Answer more questions to unlock topic-level insights here.'}
          </p>
          <div className="analytics-goals">
            <div className="analytics-goals__row">
              <span className="analytics-goals__label">Daily questions</span>
              <span className="analytics-goals__pct">{qProgress}%</span>
            </div>
            <div className="analytics-goals__track">
              <div className="analytics-goals__fill analytics-goals__fill--cyan" style={{ width: `${qProgress}%` }} />
            </div>
            <div className="analytics-goals__row">
              <span className="analytics-goals__label">Study time goal</span>
              <span className="analytics-goals__pct">{timeProgress}%</span>
            </div>
            <div className="analytics-goals__track">
              <div className="analytics-goals__fill analytics-goals__fill--gold" style={{ width: `${timeProgress}%` }} />
            </div>
          </div>
          <button type="button" className="analytics-insight__cta" onClick={() => navigate('/dashboard')}>
            Edit targets on dashboard
          </button>
        </article>

        <article className="analytics-card analytics-card--span-8" aria-labelledby="analytics-daily-title">
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-daily-title" className="analytics-card__title">
                Trend over time
              </h2>
              <p className="analytics-card__sub">Daily performance from your question bank history</p>
            </div>
          </div>
          <div className="analytics-tabs">
            <button
              type="button"
              className={`analytics-tabs__btn ${dailyTab === 'questions' ? 'is-active' : ''}`}
              onClick={() => setDailyTab('questions')}
            >
              Questions
            </button>
            <button
              type="button"
              className={`analytics-tabs__btn ${dailyTab === 'accuracy' ? 'is-active' : ''}`}
              onClick={() => setDailyTab('accuracy')}
            >
              Accuracy
            </button>
            <button
              type="button"
              className={`analytics-tabs__btn ${dailyTab === 'time' ? 'is-active' : ''}`}
              onClick={() => setDailyTab('time')}
            >
              Time
            </button>
          </div>
          <div className="analytics-card__chart analytics-card__chart--tall">
            {trendLoading ? (
              <div className="analytics-chart-loading">Loading…</div>
            ) : (
              <>
                {dailyTab === 'questions' && renderQuestionsOverTime(trend, `${idP}d-q-`)}
                {dailyTab === 'accuracy' && renderAccuracyChart(trend, `${idP}d-a-`)}
                {dailyTab === 'time' && renderTimeChart(trend, `${idP}d-t-`)}
              </>
            )}
          </div>
        </article>

        <article className="analytics-card analytics-card--span-4" aria-labelledby="analytics-weekday-title">
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-weekday-title" className="analytics-card__title">
                By weekday
              </h2>
              <p className="analytics-card__sub">{weekdayPanelCopy.subtitle}</p>
            </div>
          </div>
          <div className="analytics-tabs analytics-tabs--compact" role="group" aria-label="Weekday chart metric">
            <button
              type="button"
              title="Questions: average count per weekday in your trend"
              aria-label="Show average questions per weekday"
              className={`analytics-tabs__btn ${weekdayTab === 'questions' ? 'is-active' : ''}`}
              onClick={() => setWeekdayTab('questions')}
            >
              Q
            </button>
            <button
              type="button"
              title="Accuracy: average percent correct per weekday"
              aria-label="Show average accuracy per weekday"
              className={`analytics-tabs__btn ${weekdayTab === 'accuracy' ? 'is-active' : ''}`}
              onClick={() => setWeekdayTab('accuracy')}
            >
              %
            </button>
            <button
              type="button"
              title="Time: average seconds per question per weekday"
              aria-label="Show average time per question per weekday"
              className={`analytics-tabs__btn ${weekdayTab === 'time' ? 'is-active' : ''}`}
              onClick={() => setWeekdayTab('time')}
            >
              s
            </button>
          </div>
          <p id="analytics-weekday-desc" className="analytics-card__metric-note">
            {weekdayPanelCopy.detail}
          </p>
          <div className="analytics-card__chart" aria-describedby="analytics-weekday-desc">
            {trendLoading ? (
              <div className="analytics-chart-loading">Loading…</div>
            ) : (
              <>
                {weekdayTab === 'questions' &&
                  renderQuestionsChart(aggregateTrendByWeekday(trend), `${idP}wd-q-`)}
                {weekdayTab === 'accuracy' &&
                  renderAccuracyChartByWeekday(aggregateTrendByWeekdayForAccuracy(trend), `${idP}wd-a-`)}
                {weekdayTab === 'time' &&
                  renderTimeChartByWeekday(aggregateTrendByWeekdayForTime(trend), `${idP}wd-t-`)}
              </>
            )}
          </div>
        </article>

        <article className="analytics-card analytics-card--span-12" aria-labelledby="analytics-topics-title">
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-topics-title" className="analytics-card__title">
                Topics you practice
              </h2>
              <p className="analytics-card__sub">Highest attempt counts — hover points for detail</p>
            </div>
          </div>
          <div className="analytics-tabs">
            <button
              type="button"
              className={`analytics-tabs__btn ${topicTab === 'accuracy' ? 'is-active' : ''}`}
              onClick={() => setTopicTab('accuracy')}
            >
              Accuracy
            </button>
            <button
              type="button"
              className={`analytics-tabs__btn ${topicTab === 'time' ? 'is-active' : ''}`}
              onClick={() => setTopicTab('time')}
            >
              Avg time
            </button>
            <button
              type="button"
              className={`analytics-tabs__btn ${topicTab === 'table' ? 'is-active' : ''}`}
              onClick={() => setTopicTab('table')}
            >
              Table
            </button>
          </div>
          {topicTab === 'table' ? (
            topicsLoading ? (
              <div className="analytics-chart-loading analytics-chart-loading--short">Loading topics…</div>
            ) : topicCardsWithAttempts.length === 0 ? (
              <p className="analytics-card__sub analytics-card__sub--solo">
                Answer questions in the bank to see per-topic breakdown.
              </p>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th className="analytics-table__num">Attempted</th>
                      <th className="analytics-table__num">Accuracy</th>
                      <th className="analytics-table__num">Avg time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topicCardsWithAttempts.map((t) => (
                      <tr key={t.topic_id || t.topic_slug}>
                        <td>{t.topic_name || 'Topic'}</td>
                        <td className="analytics-table__num">{t.attempted_questions ?? 0}</td>
                        <td className="analytics-table__num">
                          {t.accuracy_pct != null ? `${t.accuracy_pct}%` : '—'}
                        </td>
                        <td className="analytics-table__num">
                          {t.avg_time_ms != null ? `${Math.round(t.avg_time_ms / 1000)}s` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="analytics-card__chart analytics-card__chart--topics">
              {topicsLoading ? (
                <div className="analytics-chart-loading">Loading…</div>
              ) : topicTab === 'accuracy' ? (
                renderAccuracyChartByTopic(topicCardsWithAttempts, `${idP}tp-a-`)
              ) : (
                renderTimeChartByTopic(topicCardsWithAttempts, `${idP}tp-t-`)
              )}
            </div>
          )}
        </article>

        <article
          className="analytics-card analytics-card--span-6 analytics-card--reading-insights"
          aria-labelledby="analytics-reading-title"
        >
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-reading-title" className="analytics-card__title">
                Textbook reading
              </h2>
              <p className="analytics-card__sub">
                Topic and chapter progress from your UKMLA textbook, plus what you opened most recently.
              </p>
            </div>
            <div className="analytics-kpi__icon analytics-kpi__icon--blue" aria-hidden>
              <LuBookOpen size={20} />
            </div>
          </div>
          {insightsLoading ? (
            <div className="analytics-chart-loading analytics-chart-loading--short">Loading reading…</div>
          ) : (
            <>
              <div className="analytics-mini-stats">
                <div className="analytics-mini-stat">
                  <span className="analytics-mini-stat__label">Topics completed</span>
                  <span className="analytics-mini-stat__value">
                    {insights?.reading?.topic_progress?.completed ?? 0}
                    <span className="analytics-kpi__unit">
                      {' '}
                      / {Math.max(insights?.reading?.topic_progress?.total ?? 0, 0) || '—'}
                    </span>
                  </span>
                  <span className="analytics-mini-stat__meta">Marked complete in textbook</span>
                </div>
                <div className="analytics-mini-stat">
                  <span className="analytics-mini-stat__label">Chapters (subtopics)</span>
                  <span className="analytics-mini-stat__value">
                    {insights?.reading?.subtopic_progress?.completed ?? 0}
                    <span className="analytics-kpi__unit">
                      {' '}
                      / {Math.max(insights?.reading?.subtopic_progress?.total ?? 0, 0) || '—'}
                    </span>
                  </span>
                  <span className="analytics-mini-stat__meta">Completed vs tracked</span>
                </div>
              </div>
              <p className="analytics-card__sub" style={{ marginBottom: 10 }}>
                Recently opened topics
              </p>
              {(!insights?.reading?.recent_topics || insights.reading.recent_topics.length === 0) ? (
                <p className="analytics-card__sub analytics-card__sub--solo">
                  Open topics in the textbook to build your reading list here.
                </p>
              ) : (
                <ul className="analytics-read-list">
                  {insights.reading.recent_topics.map((row) => (
                    <li key={`${row.topic_slug}-${row.last_read_date}`} className="analytics-read-list__item">
                      <button
                        type="button"
                        className="analytics-read-list__link"
                        onClick={() => navigate(`/dashboard/textbook/topic/${row.topic_slug}`)}
                      >
                        <div className="analytics-read-list__row">
                          <div className="analytics-read-list__main">
                            <span className="analytics-read-list__topic">{row.topic_name}</span>
                            {row.specialty_name ? (
                              <span className="analytics-read-list__spec">{row.specialty_name}</span>
                            ) : null}
                          </div>
                          <span className="analytics-read-list__date">{formatShortDate(row.last_read_date)}</span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </article>

        <article
          className="analytics-card analytics-card--span-6 analytics-card--group-insights"
          aria-labelledby="analytics-group-title"
        >
          <div className="analytics-card__head">
            <div>
              <h2 id="analytics-group-title" className="analytics-card__title">
                Group quiz partners
              </h2>
              <p className="analytics-card__sub">
                People you have joined in question-bank group sessions—ranked by how often you study together.
              </p>
            </div>
            <div className="analytics-kpi__icon analytics-kpi__icon--cyan" aria-hidden>
              <LuUsers size={20} />
            </div>
          </div>
          {insightsLoading ? (
            <div className="analytics-chart-loading analytics-chart-loading--short">Loading group study…</div>
          ) : (
            <>
              <div className="analytics-group-badge">
                {insights?.group_quiz?.sessions_joined ?? 0} group{' '}
                {insights?.group_quiz?.sessions_joined === 1 ? 'session' : 'sessions'} joined
              </div>
              {(!insights?.group_quiz?.top_partners || insights.group_quiz.top_partners.length === 0) ? (
                <p className="analytics-card__sub analytics-card__sub--solo">
                  Host or join a group session from the question bank to see study partners here.
                </p>
              ) : (
                <div className="analytics-table-wrap">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>Study partner</th>
                        <th className="analytics-table__num">Sessions together</th>
                      </tr>
                    </thead>
                    <tbody>
                      {insights.group_quiz.top_partners.map((p) => (
                        <tr key={p.user_id}>
                          <td>{p.display_name}</td>
                          <td className="analytics-table__num">{p.sessions_together}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </article>
      </div>
    </div>
  )
}
