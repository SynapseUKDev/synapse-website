import React, { useState, useEffect, useRef } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import { levelFor, DEFAULT_DAILY_TARGET, describeDay } from './activityLevel'
import './ActivityHeatmap.css'

const MONTHS_SHOWN = 3

export default function ActivityHeatmap() {
  const [activityData, setActivityData] = useState({})
  const [dailyTarget, setDailyTarget] = useState(DEFAULT_DAILY_TARGET)
  const [loading, setLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const containerRef = useRef(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  useEffect(() => {
    loadActivityData()
  }, [])

  const loadActivityData = async () => {
    try {
      const tz = typeof Intl !== 'undefined' && Intl.DateTimeFormat
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : 'UTC'
      const res = await authenticatedFetch(
        `${API_BASE}/analytics/activity/daily?timezone=${encodeURIComponent(tz)}&days=95`,
        { credentials: 'include', headers: authHeaders() }
      )
      if (res.ok) {
        const data = await res.json()
        const dataMap = {}
        if (data.dates && Array.isArray(data.dates)) {
          data.dates.forEach((item) => {
            dataMap[item.date] = { count: item.count || 0, byKind: item.by_kind || null }
          })
        }
        setActivityData(dataMap)
        if (data.daily_target > 0) setDailyTarget(data.daily_target)
      }
    } catch (e) {
      console.error('Error loading activity data:', e)
    } finally {
      setLoading(false)
    }
  }

  const getMonthStarts = () => {
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth() - (MONTHS_SHOWN - 1), 1)
    const end = new Date(today.getFullYear(), today.getMonth(), 1)

    const out = []
    const cur = new Date(start)
    while (cur <= end) {
      out.push(new Date(cur))
      cur.setMonth(cur.getMonth() + 1)
    }
    return out
  }

  const startOfMondayWeek = (d) => {
    const x = new Date(d)
    const day = x.getDay() === 0 ? 7 : x.getDay()
    x.setDate(x.getDate() - (day - 1))
    x.setHours(0, 0, 0, 0)
    return x
  }

  const endOfSundayWeek = (d) => {
    const x = new Date(d)
    const day = x.getDay() === 0 ? 7 : x.getDay()
    x.setDate(x.getDate() + (7 - day))
    x.setHours(0, 0, 0, 0)
    return x
  }

  const buildMonthWeeks = (monthStart) => {
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const gridStart = startOfMondayWeek(monthStart)
    const gridEnd = endOfSundayWeek(monthEnd)

    const weeks = []
    const cur = new Date(gridStart)

    while (cur <= gridEnd) {
      const week = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cur))
        cur.setDate(cur.getDate() + 1)
      }
      weeks.push(week)
    }

    return weeks
  }

  const formatDateKey = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  }

  const handleMouseEnter = (e, date, entry) => {
    setTooltipPos({
      x: e.clientX,
      y: e.clientY - 12,
    })
    setHoveredDay({ date, entry })
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
  }

  const today = new Date()
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const monthStarts = getMonthStarts()

  if (loading) {
    return (
      <div className="activity-heatmap">
        <div className="activity-heatmap-loading">
          <div className="activity-heatmap-loading__spinner" />
        </div>
      </div>
    )
  }

  return (
    <div className="activity-heatmap" ref={containerRef}>
      <div className="activity-heatmap__wrapper">
        <div className="activity-heatmap__day-labels">
          {dayNames.map((dayName, i) => (
            <div key={i} className="activity-heatmap__day-label">
              {dayName}
            </div>
          ))}
        </div>

        <div className="activity-heatmap__content">
          <div className="activity-heatmap__months">
            {monthStarts.map((monthStart) => {
              const monthWeeks = buildMonthWeeks(monthStart)
              const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'short' })
              const monthIndex = monthStart.getMonth()
              const monthYear = monthStart.getFullYear()

              return (
                <div key={`${monthYear}-${monthIndex}`} className="activity-heatmap__month">
                  <div className="activity-heatmap__month-header">{monthLabel}</div>

                  <div className="activity-heatmap__grid">
                    {dayNames.map((_, dayIndex) => (
                      <div key={dayIndex} className="activity-heatmap__row">
                        {monthWeeks.map((week, weekIndex) => {
                          const date = week[dayIndex]

                          const isInMonth =
                            date.getFullYear() === monthYear && date.getMonth() === monthIndex

                          if (!isInMonth) {
                            return (
                              <div
                                key={weekIndex}
                                className="activity-heatmap__day activity-heatmap__day--empty"
                              />
                            )
                          }

                          const dateKey = formatDateKey(date)
                          const entry = activityData[dateKey]
                          const count = entry?.count || 0
                          const intensity = levelFor(count, dailyTarget)
                          const isToday = formatDateKey(today) === dateKey
                          const d0 = new Date(date.getFullYear(), date.getMonth(), date.getDate())
                          const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
                          const isFuture = d0 > t0

                          if (isFuture) {
                            return (
                              <div
                                key={weekIndex}
                                className="activity-heatmap__day activity-heatmap__day--future"
                              />
                            )
                          }

                          return (
                            <div
                              key={weekIndex}
                              className={`activity-heatmap__day activity-heatmap__day--level-${intensity} ${
                                isToday ? 'activity-heatmap__day--today' : ''
                              }`}
                              onMouseEnter={(e) => handleMouseEnter(e, date, entry)}
                              onMouseLeave={handleMouseLeave}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {hoveredDay && (
        <div
          className="activity-heatmap__tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y,
          }}
        >
          <div className="activity-heatmap__tooltip-count">
            {describeDay(hoveredDay.entry)}
          </div>
          <div className="activity-heatmap__tooltip-date">
            {formatDisplayDate(hoveredDay.date)}
          </div>
        </div>
      )}

      <div className="activity-heatmap__legend">
        <span className="activity-heatmap__legend-label">Less</span>
        <div className="activity-heatmap__legend-squares">
          <div className="activity-heatmap__legend-square activity-heatmap__day--level-0" />
          <div className="activity-heatmap__legend-square activity-heatmap__day--level-1" />
          <div className="activity-heatmap__legend-square activity-heatmap__day--level-2" />
          <div className="activity-heatmap__legend-square activity-heatmap__day--level-3" />
          <div className="activity-heatmap__legend-square activity-heatmap__day--level-4" />
        </div>
        <span className="activity-heatmap__legend-label">More</span>
      </div>
    </div>
  )
}
