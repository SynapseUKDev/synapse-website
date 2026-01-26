import React, { useState, useEffect } from 'react'
import { authHeaders, authenticatedFetch } from '../../auth/token'
import './ActivityHeatmap.css'

export default function ActivityHeatmap() {
  const [activityData, setActivityData] = useState({})
  const [loading, setLoading] = useState(true)
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

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
        // Convert array to object for quick lookup
        const dataMap = {}
        if (data.dates && Array.isArray(data.dates)) {
          data.dates.forEach(item => {
            dataMap[item.date] = item.count || 0
          })
        }
        setActivityData(dataMap)
      }
    } catch (e) {
      console.error('Error loading activity data:', e)
    } finally {
      setLoading(false)
    }
  }

  // Generate dates for 13 weeks (91 days) organized into 4 rows x 13 columns
  const generateDates = () => {
    const dates = []
    const today = new Date()
    const startDate = new Date(today)
    startDate.setDate(today.getDate() - 90) // 13 weeks = ~91 days
    
    const current = new Date(startDate)
    while (current <= today) {
      dates.push(new Date(current))
      current.setDate(current.getDate() + 1)
    }
    return dates
  }

  const getIntensity = (count) => {
    if (count === 0) return 0
    if (count <= 5) return 1
    if (count <= 10) return 2
    if (count <= 20) return 3
    return 4
  }

  const formatDateKey = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const dates = generateDates()
  // Organize into 4 rows (days of week) x 13 columns (weeks)
  // We'll show Monday, Tuesday, Wednesday, Thursday across 13 weeks
  const dayIndices = [1, 2, 3, 4] // Monday=1, Tuesday=2, Wednesday=3, Thursday=4
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu']
  
  // Group dates by day of week
  const dayOfWeekGroups = [[], [], [], []] // 4 rows
  
  dates.forEach((date) => {
    const dayOfWeek = date.getDay() // 0 = Sunday, 1 = Monday, etc.
    const rowIndex = dayIndices.indexOf(dayOfWeek)
    if (rowIndex !== -1) {
      dayOfWeekGroups[rowIndex].push(date)
    }
  })
  
  // Organize into 13 columns (weeks) x 4 rows (days)
  // Each column represents a week, each row represents a day of week
  const maxWeeks = 13
  const weeks = [] // Each week is an array of 4 dates (one per row)
  
  for (let weekIndex = 0; weekIndex < maxWeeks; weekIndex++) {
    const week = []
    dayOfWeekGroups.forEach((dayGroup) => {
      if (dayGroup[weekIndex]) {
        week.push(dayGroup[weekIndex])
      } else {
        week.push(null)
      }
    })
    weeks.push(week)
  }

  if (loading) {
    return <div className="activity-heatmap-loading">Loading activity...</div>
  }

  return (
    <div className="activity-heatmap">
      {/* Week numbers row */}
      <div className="activity-heatmap__day-names">
        {weeks.map((_, weekIndex) => (
          <div key={weekIndex} className="activity-heatmap__week-label">
            {weekIndex + 1}
          </div>
        ))}
      </div>
      {/* Grid: 4 rows x 13 columns */}
      <div className="activity-heatmap__grid">
        {dayNames.map((dayName, rowIndex) => (
          <div key={rowIndex} className="activity-heatmap__row">
            {weeks.map((week, weekIndex) => {
              const date = week[rowIndex]
              if (!date) {
                return <div key={weekIndex} className="activity-heatmap__day activity-heatmap__day--empty" />
              }
              const dateKey = formatDateKey(date)
              const count = activityData[dateKey] || 0
              const intensity = getIntensity(count)
              const isToday = formatDateKey(new Date()) === dateKey
              
              return (
                <div
                  key={weekIndex}
                  className={`activity-heatmap__day activity-heatmap__day--level-${intensity} ${isToday ? 'activity-heatmap__day--today' : ''}`}
                  title={`${date.toLocaleDateString()}: ${count} questions`}
                />
              )
            })}
          </div>
        ))}
      </div>
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
