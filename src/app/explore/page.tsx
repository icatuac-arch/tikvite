'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getShortId } from '@/lib/constants'
import { formatTime } from '@/lib/formatTime'
import { getPriceBadge } from '@/lib/formatPrice'
import { Search, MapPin, Calendar, Clock, SlidersHorizontal, X } from 'lucide-react'
import type { Event } from '@/lib/types'

const CATEGORIES = [
  { key: 'all', label: 'All', emoji: '🎉' },
  { key: 'music', label: 'Music', emoji: '🎵' },
  { key: 'festival', label: 'Festival', emoji: '🪔' },
  { key: 'conference', label: 'Conference', emoji: '🎤' },
  { key: 'workshop', label: 'Workshop', emoji: '🛠️' },
  { key: 'theater', label: 'Theater', emoji: '🎭' },
  { key: 'sports', label: 'Sports', emoji: '🏆' },
  { key: 'community', label: 'Community', emoji: '🤝' },
  { key: 'religious', label: 'Religious', emoji: '🙏' },
  { key: 'fundraiser', label: 'Fundraiser', emoji: '💝' },
  { key: 'dance', label: 'Dance', emoji: '💃' },
  { key: 'standup', label: 'Stand-up', emoji: '😂' },
  { key: 'other', label: 'Other', emoji: '✨' },
]

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function getDateParts(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: date.getDate(),
  }
}

export default function ExplorePage() {
  const supabase = createClient()
  const [events, setEvents] = useState<Event[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')

  useEffect(() => {
    async function fetchEvents() {
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'published')
        .is('deleted_at', null)
        .gte('date', today)
        .order('date', { ascending: true })
        .limit(200)

      setEvents((data as Event[]) || [])
      setLoading(false)
    }
    fetchEvents()
  }, [supabase])

  const filtered = useMemo(() => {
    let result = events

    if (category !== 'all') {
      result = result.filter(
        (e) => e.category?.toLowerCase() === category
      )
    }

    if (search.trim()) {
      const q = search.toLowerCase().trim()
      result = result.filter(
        (e) =>
          e.title?.toLowerCase().includes(q) ||
          e.description?.toLowerCase().includes(q) ||
          e.city?.toLowerCase().includes(q) ||
          e.venue?.toLowerCase().includes(q)
      )
    }

    return result
  }, [events, search, category])

  return (
    <>
      <div className="min-h-screen bg-surface-muted">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary via-primary-dark to-accent pt-24 pb-14 px-4">
          <div className="mx-auto max-w-5xl text-center">
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
              Explore Events
            </h1>
            <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">
              Discover amazing events happening near you. Concerts, festivals, workshops, and more.
            </p>

            {/* Search */}
            <div className="relative max-w-xl mx-auto">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, city, or venue..."
                className="w-full pl-11 pr-10 py-3.5 rounded-2xl bg-white border border-border text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 shadow-lg text-sm"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Categories */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 -mt-6">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-3 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setCategory(cat.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    category === cat.key
                      ? 'bg-primary text-white shadow-md'
                      : 'bg-surface-muted text-text-secondary hover:bg-primary-50 hover:text-primary'
                  }`}
                >
                  <span>{cat.emoji}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          {/* Count */}
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm text-text-secondary">
              {loading
                ? 'Loading events...'
                : `${filtered.length} event${filtered.length !== 1 ? 's' : ''} found`}
            </p>
            {(search || category !== 'all') && (
              <button
                onClick={() => {
                  setSearch('')
                  setCategory('all')
                }}
                className="text-sm text-primary font-medium hover:underline flex items-center gap-1"
              >
                <SlidersHorizontal size={14} />
                Clear filters
              </button>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-border overflow-hidden animate-pulse"
                >
                  <div className="h-48 bg-border-light" />
                  <div className="p-5 space-y-3">
                    <div className="h-5 bg-border-light rounded w-3/4" />
                    <div className="h-4 bg-border-light rounded w-1/2" />
                    <div className="h-4 bg-border-light rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-5">
                <Search className="text-primary" size={32} />
              </div>
              <h3 className="font-heading text-xl font-bold text-text mb-2">
                No events found
              </h3>
              <p className="text-text-secondary max-w-md mx-auto">
                {search || category !== 'all'
                  ? 'Try adjusting your search or filters to find more events.'
                  : 'There are no upcoming events right now. Check back soon!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((event) => {
                const shortId = getShortId(event.id)
                const priceBadge = getPriceBadge(event.price)
                const dp = getDateParts(event.date)

                return (
                  <a
                    key={event.id}
                    href={`/e/${shortId}`}
                    className="group block bg-white rounded-2xl border border-border overflow-hidden hover:border-primary/30 hover:shadow-xl hover:shadow-primary/[0.06] transition-all duration-300 hover:-translate-y-1"
                  >
                    {/* Image */}
                    <div className="relative h-48 bg-surface-muted overflow-hidden">
                      {event.image_url ? (
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent/10">
                          <span className="text-5xl">🎫</span>
                        </div>
                      )}

                      {/* Date badge */}
                      <div className="absolute top-3 left-3">
                        <div className="bg-white/95 backdrop-blur-sm rounded-xl px-2.5 py-1.5 text-center shadow-md min-w-[48px]">
                          <div className="text-[10px] font-bold text-primary tracking-wider">
                            {dp.month}
                          </div>
                          <div className="text-lg font-bold text-text leading-none">
                            {dp.day}
                          </div>
                        </div>
                      </div>

                      {/* Price badge */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md ${
                            priceBadge.isFree
                              ? 'bg-emerald-500 text-white'
                              : 'bg-accent text-white'
                          }`}
                        >
                          {priceBadge.label}
                        </span>
                      </div>

                      {/* Gradient overlay */}
                      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-3">
                      <h3 className="font-heading text-base font-bold text-text line-clamp-2 leading-snug group-hover:text-primary transition-colors min-h-[2.75rem]">
                        {event.title}
                      </h3>

                      {event.category && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium text-primary bg-primary-50 border border-primary/10">
                          {CATEGORIES.find((c) => c.key === event.category?.toLowerCase())
                            ?.emoji || '🎫'}{' '}
                          {event.category}
                        </span>
                      )}

                      <div className="space-y-1.5 text-sm text-text-secondary">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-primary flex-shrink-0" />
                          <span>{formatDate(event.date)}</span>
                          {event.time && (
                            <>
                              <Clock size={14} className="text-primary flex-shrink-0 ml-1" />
                              <span>{formatTime(event.time)}</span>
                            </>
                          )}
                        </div>
                        {event.city && (
                          <div className="flex items-center gap-2">
                            <MapPin size={14} className="text-accent flex-shrink-0" />
                            <span className="truncate">
                              {event.venue ? `${event.venue}, ` : ''}
                              {event.city}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
