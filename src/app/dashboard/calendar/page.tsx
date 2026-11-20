'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CalendarDays, Loader2 } from 'lucide-react'

interface EventItem {
  event_id: string
  title: string
  date: string
  city: string
  status: string
  category: string
}

const CATEGORY_COLORS: Record<string, string> = {
  'Cultural': '#4F46E5',
  'Religious': '#7C3AED',
  'Music': '#6A1B9A',
  'Dance': '#D84315',
  'Food': '#2E7D32',
  'Comedy': '#F57F17',
  'Film': '#0277BD',
  'Networking': '#00695C',
  'Sports': '#283593',
  'Education': '#4527A0',
  'Kids': '#E91E63',
  'Community': '#5D4037',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function getMonthGrid(year: number, month: number) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()

  // getDay() returns 0 for Sunday; we want Monday=0
  let startDow = firstDay.getDay() - 1
  if (startDow < 0) startDow = 6

  const cells: (number | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return cells
}

function formatDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CalendarPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/org?period=year`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.events_breakdown) {
          setEvents(data.events_breakdown)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const eventsByDate = useMemo(() => {
    const map: Record<string, EventItem[]> = {}
    for (const ev of events) {
      if (!ev.date) continue
      const key = ev.date
      if (!map[key]) map[key] = []
      map[key].push(ev)
    }
    return map
  }, [events])

  const cells = getMonthGrid(year, month)
  const todayKey = formatDateKey(today.getFullYear(), today.getMonth(), today.getDate())

  const goPrev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1) }
    else setMonth(month - 1)
  }
  const goNext = () => {
    if (month === 11) { setMonth(0); setYear(year + 1) }
    else setMonth(month + 1)
  }
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()) }

  const getCategoryColor = (cat: string) => CATEGORY_COLORS[cat] || '#4F46E5'

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      
      <main className="flex-1 w-full">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: '#EEF2FF' }}
              >
                <CalendarDays size={22} style={{ color: '#4F46E5' }} />
              </div>
              <div>
                <h1
                  className="text-2xl sm:text-3xl font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
                >
                  Event Calendar
                </h1>
                <p className="text-sm mt-0.5" style={{ color: '#94A3B8' }}>
                  All your events at a glance
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              className="text-sm font-medium px-4 py-2 rounded-lg border transition-colors hover:opacity-80"
              style={{ borderColor: '#E2E8F0', color: '#475569' }}
            >
              Back to Dashboard
            </Link>
          </div>

          {/* Month Navigation */}
          <div
            className="rounded-2xl border p-4 sm:p-6 mb-6"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
          >
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={goPrev}
                className="p-2 rounded-lg border transition-colors hover:bg-[#F8FAFC]"
                style={{ borderColor: '#E2E8F0', color: '#4F46E5' }}
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <h2
                  className="text-xl sm:text-2xl font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
                >
                  {MONTH_NAMES[month]} {year}
                </h2>
                <button
                  onClick={goToday}
                  className="text-xs font-medium px-3 py-1 rounded-full border transition-colors hover:bg-[#F8FAFC]"
                  style={{ borderColor: '#E2E8F0', color: '#4F46E5' }}
                >
                  Today
                </button>
              </div>
              <button
                onClick={goNext}
                className="p-2 rounded-lg border transition-colors hover:bg-[#F8FAFC]"
                style={{ borderColor: '#E2E8F0', color: '#4F46E5' }}
              >
                <ChevronRight size={20} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="animate-spin" size={32} style={{ color: '#4F46E5' }} />
              </div>
            ) : (
              <>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-px mb-1">
                  {DAY_NAMES.map((d) => (
                    <div
                      key={d}
                      className="text-center text-xs font-semibold py-2"
                      style={{ color: '#94A3B8' }}
                    >
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div
                  className="grid grid-cols-7 gap-px rounded-xl overflow-hidden"
                  style={{ backgroundColor: '#E2E8F0' }}
                >
                  {cells.map((day, idx) => {
                    const dateKey = day ? formatDateKey(year, month, day) : ''
                    const dayEvents = day ? (eventsByDate[dateKey] || []) : []
                    const isToday = dateKey === todayKey

                    return (
                      <div
                        key={idx}
                        className="min-h-[80px] sm:min-h-[100px] p-1.5 sm:p-2"
                        style={{
                          backgroundColor: day ? (isToday ? '#EEF2FF' : '#FFFFFF') : '#F5F0EA',
                        }}
                      >
                        {day && (
                          <>
                            <div
                              className={`text-xs sm:text-sm font-medium mb-1 ${isToday ? 'inline-flex items-center justify-center w-6 h-6 rounded-full' : ''}`}
                              style={{
                                color: isToday ? '#FFFFFF' : '#334155',
                                backgroundColor: isToday ? '#4F46E5' : 'transparent',
                              }}
                            >
                              {day}
                            </div>
                            <div className="space-y-0.5">
                              {dayEvents.slice(0, 3).map((ev) => (
                                <Link
                                  key={ev.event_id}
                                  href={`/dashboard/event/${ev.event_id}`}
                                  className="block truncate text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-medium transition-opacity hover:opacity-80"
                                  style={{
                                    backgroundColor: getCategoryColor(ev.category) + '18',
                                    color: getCategoryColor(ev.category),
                                    borderLeft: `2px solid ${getCategoryColor(ev.category)}`,
                                  }}
                                  title={ev.title}
                                >
                                  {ev.title}
                                </Link>
                              ))}
                              {dayEvents.length > 3 && (
                                <div
                                  className="text-[10px] font-medium pl-1.5"
                                  style={{ color: '#94A3B8' }}
                                >
                                  +{dayEvents.length - 3} more
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          {/* Event list for current month */}
          {!loading && (
            <div
              className="rounded-2xl border p-4 sm:p-6"
              style={{ backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' }}
            >
              <h3
                className="text-lg font-bold mb-4"
                style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#4F46E5' }}
              >
                Events in {MONTH_NAMES[month]}
              </h3>
              {(() => {
                const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`
                const monthEvents = events
                  .filter((ev) => ev.date?.startsWith(monthPrefix))
                  .sort((a, b) => a.date.localeCompare(b.date))

                if (monthEvents.length === 0) {
                  return (
                    <p className="text-sm py-4 text-center" style={{ color: '#94A3B8' }}>
                      No events scheduled this month.
                    </p>
                  )
                }

                return (
                  <div className="space-y-2">
                    {monthEvents.map((ev) => {
                      const d = new Date(ev.date + 'T00:00:00')
                      const dayStr = d.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })
                      return (
                        <Link
                          key={ev.event_id}
                          href={`/dashboard/event/${ev.event_id}`}
                          className="flex items-center gap-3 p-3 rounded-xl border transition-colors hover:bg-[#F8FAFC]"
                          style={{ borderColor: '#E2E8F0' }}
                        >
                          <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getCategoryColor(ev.category) }}
                          />
                          <div className="flex-1 min-w-0">
                            <div
                              className="text-sm font-medium truncate"
                              style={{ color: '#0F172A' }}
                            >
                              {ev.title}
                            </div>
                            <div className="text-xs" style={{ color: '#94A3B8' }}>
                              {dayStr} {ev.city ? `\u00B7 ${ev.city}` : ''}
                            </div>
                          </div>
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: ev.status === 'published' ? '#D1FAE5' : '#FFF3E0',
                              color: ev.status === 'published' ? '#2E7D32' : '#7C3AED',
                            }}
                          >
                            {ev.status === 'published' ? 'Live' : ev.status}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}
        </div>
      </main>
      
    </div>
  )
}
