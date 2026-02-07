import React, { useState, useEffect, useRef, useCallback } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import './ActivityHeatmap.css'

export default function ActivityHeatmap() {
  const [activityData, setActivityData] = useState({})
  const [loading, setLoading] = useState(true)
  const [hoveredDay, setHoveredDay] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [numWeeks, setNumWeeks] = useState(26) // default, will be calculated
  const containerRef = useRef(null)
  const gridRef = useRef(null)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Calculate number of weeks based on container width
  const calculateWeeks = useCallback(() => {
    if (!containerRef.current) return
    const containerWidth = containerRef.current.offsetWidth
    const dayLabelWidth = 24 // space for day labels (S, M, T, etc.)
    const wrapperGap = 8 // gap between day labels and grid
    const availableWidth = containerWidth - dayLabelWidth - wrapperGap - 8 // extra padding
    const cellSize = 14 // width of each cell
    const gap = 3 // gap between cells
    const calculatedWeeks = Math.floor(availableWidth / (cellSize + gap))
    // Minimum 12 weeks (3 months), max 52 weeks (1 year)
    setNumWeeks(Math.max(12, Math.min(52, calculatedWeeks)))
  }, [])

  useEffect(() => {
    // Initial calculation with delay to ensure layout is ready
    const timer = setTimeout(calculateWeeks, 50)

    // ResizeObserver for container size changes
    const resizeObserver = new ResizeObserver(() => {
      calculateWeeks()
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(timer)
      resizeObserver.disconnect()
    }
  }, [calculateWeeks])

  useEffect(() => {
    loadActivityData()
  }, [])

  const loadActivityData = async () => {
    try {
      const res = await authenticatedFetch(`${API_BASE}/qbank/activity/daily`, {
        credentials: 'include',
        headers: authHeaders(),
      })
      if (res.ok) {
        const data = await res.json()
        console.log('Heatmap API response:', data)
        const dataMap = {}
        if (data.dates && Array.isArray(data.dates)) {
          data.dates.forEach(item => {
            dataMap[item.date] = item.count || 0
          })
        }
        console.log('Heatmap data map:', dataMap)
        console.log('Today UTC key:', formatDateKeyStatic(new Date()))
        setActivityData(dataMap)
      }
    } catch (e) {
      console.error('Error loading activity data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Static version for logging (before component renders)
  const formatDateKeyStatic = (date) => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Generate dates dynamically based on calculated weeks
  // End date is the Sunday of current week, so today is near the right side
  const generateDates = useCallback(() => {
  const dates = []
  const today = new Date()

  // Start: 1st day of (current month - 4)  => total = 5 months incl current
  const startMonth = new Date(today.getFullYear(), today.getMonth() - 4, 1)

  // End: Sunday of the current week (no future spill)
  const endDate = new Date(today)
  const endDay = endDate.getDay() === 0 ? 7 : endDate.getDay() // Mon=1..Sun=7
  endDate.setDate(endDate.getDate() + (7 - endDay))

  // Align start to Monday
  const startDate = new Date(startMonth)
  const startDay = startDate.getDay() === 0 ? 7 : startDate.getDay()
  startDate.setDate(startDate.getDate() - (startDay - 1))

  const current = new Date(startDate)
  while (current <= endDate) {
    dates.push(new Date(current))
    current.setDate(current.getDate() + 1)
  }

  return dates
}, [numWeeks])

  const getMaxCount = () => {
    const counts = Object.values(activityData)
    return Math.max(...counts, 1)
  }

  const getIntensity = (count) => {
    if (count === 0) return 0
    const max = getMaxCount()
    const ratio = count / max
    if (ratio <= 0.25) return 1
    if (ratio <= 0.5) return 2
    if (ratio <= 0.75) return 3
    return 4
  }

  const formatDateKey = (date) => {
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const handleMouseEnter = (e, date, count) => {
    const rect = e.target.getBoundingClientRect()
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (containerRect) {
      setTooltipPos({
        x: e.clientX,
        y: e.clientY - 12
      })
    }
    setHoveredDay({ date, count })
  }

  const handleMouseLeave = () => {
    setHoveredDay(null)
  }

  const dates = generateDates()
  const today = new Date()
  const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const dayOrder = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun in JS getDay() terms

  // Group dates by week
  const weeks = []
  let currentWeek = []

  dates.forEach((date) => {
    const dayOfWeek = date.getDay()
    if (dayOfWeek === 1 && currentWeek.length > 0) {
      weeks.push(currentWeek)
      currentWeek = []
    }
    currentWeek.push(date)
  })

  if (currentWeek.length > 0) {
    weeks.push(currentWeek)
  }

  // Generate month labels - position at the week column where the 1st of the month appears
  const getMonthLabels = () => {
  const labels = []
  let lastMonth = -1

  weeks.forEach((week, weekIndex) => {
    const weekStart = week[0] // Monday (your weeks start on Monday)
    const month = weekStart.getMonth()

    if (month !== lastMonth) {
      labels.push({
        weekIndex,
        label: weekStart.toLocaleDateString('en-GB', { month: 'short' })
      })
      lastMonth = month
    }
  })

  return labels
}

  const monthLabels = getMonthLabels()

  if (loading) {
    return (
      <div className="activity-heatmap">
        <div className="activity-heatmap-loading">
          <div className="activity-heatmap-loading__spinner"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-heatmap" ref={containerRef}>
      {/* Main heatmap grid */}
      <div className="activity-heatmap__wrapper">
        {/* Day labels on the left */}
        <div className="activity-heatmap__day-labels">
          {dayNames.map((dayName, i) => (
            <div key={i} className="activity-heatmap__day-label">
              {dayName}
            </div>
          ))}
        </div>

        <div className="activity-heatmap__content">
          {/* Month labels row */}
          <div className="activity-heatmap__month-labels">
            {weeks.map((_, weekIndex) => {
              const monthLabel = monthLabels.find(m => m.weekIndex === weekIndex)
              return (
                <div key={weekIndex} className="activity-heatmap__month-label">
                  {monthLabel ? monthLabel.label : ''}
                </div>
              )
            })}
          </div>

          {/* Grid: 7 days x N weeks */}
          <div className="activity-heatmap__grid">
            {dayNames.map((dayName, dayIndex) => (
              <div key={dayIndex} className="activity-heatmap__row">
                {weeks.map((week, weekIndex) => {
                  const isMonthStart =
                  weekIndex === 0 ? true : week[0].getMonth() !== weeks[weekIndex - 1][0].getMonth()
                  const date = week.find(d => d.getDay() === dayOrder[dayIndex])

                  if (!date) {
                    return (
                      <div
                        key={weekIndex}
                        className={`activity-heatmap__day activity-heatmap__day--empty ${isMonthStart ? 'activity-heatmap__day--month-start' : ''}`}
                      />
                    )
                  }

                  const dateKey = formatDateKey(date)
                  const count = activityData[dateKey] || 0
                  const intensity = getIntensity(count)
                  const isToday = formatDateKey(today) === dateKey
                  const isFuture = date > today

                  if (isFuture) {
                    return (
                      <div
                        key={weekIndex}
                        className={`activity-heatmap__day activity-heatmap__day--future ${isMonthStart ? 'activity-heatmap__day--month-start' : ''}`}
                      />
                    )
                  }

                  return (
                    <div
                      key={weekIndex}
                      className={`activity-heatmap__day activity-heatmap__day--level-${intensity} ${isToday ? 'activity-heatmap__day--today' : ''} ${isMonthStart ? 'activity-heatmap__day--month-start' : ''}`}
                      onMouseEnter={(e) => handleMouseEnter(e, date, count)}
                      onMouseLeave={handleMouseLeave}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredDay && (
        <div
          className="activity-heatmap__tooltip"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y
          }}
        >
          <div className="activity-heatmap__tooltip-count">
            {hoveredDay.count} question{hoveredDay.count !== 1 ? 's' : ''}
          </div>
          <div className="activity-heatmap__tooltip-date">
            {formatDisplayDate(hoveredDay.date)}
          </div>
        </div>
      )}

      {/* Legend */}
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
