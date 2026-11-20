'use client'

import { motion } from 'framer-motion'
import { MapPin, Calendar, Clock } from 'lucide-react'
import { getCategoryMeta, getShortId } from '@/lib/constants'
import { formatTime } from '@/lib/formatTime'
import { getPriceBadge } from '@/lib/formatPrice'
import type { Event } from '@/lib/types'

interface EventCardProps {
  event: Event
  index?: number
  /** Additional dates for the same recurring event; when set, the card
      shows a small "+N more dates" chip next to the primary date. */
  extraDates?: string[]
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getDateParts(dateStr: string) {
  const date = new Date(dateStr + 'T00:00:00')
  return {
    month: date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase(),
    day: date.getDate(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
  }
}

export default function EventCard({ event, index = 0, extraDates = [] }: EventCardProps) {
  const category = getCategoryMeta(event.category)
  const shortId = getShortId(event.id)
  const nExtra = extraDates.length
  const dateParts = getDateParts(event.date)

  return (
    <motion.a
      href={`/e/${shortId}`}
      className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#F8FAFC] rounded-2xl"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1],
        delay: Math.min(index * 0.04, 0.32),
      }}
      whileHover={{ y: -6 }}
    >
      <div
        className="relative h-full flex flex-col rounded-2xl overflow-hidden border bg-white border-[#E2E8F0] transition-[border-color,box-shadow] duration-300 group-hover:border-[#4F46E5]/30 shadow-[0_1px_3px_rgba(0,0,0,0.06)] group-hover:shadow-[0_18px_40px_-12px_rgba(123,31,31,0.15)]"
      >
        {/* Image area — fixed height so cards stay uniform. */}
        <div className="relative h-48 w-full overflow-hidden bg-[#FAF0E0] flex-shrink-0">
          {event.image_url ? (
            <img
              src={event.image_url}
              alt={event.title}
              className="w-full h-full object-contain transition-transform duration-[600ms] ease-out group-hover:scale-[1.04]"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center relative">
              <div className={`absolute inset-0 bg-gradient-to-br ${category.gradient} opacity-15`} />
              <span className="text-5xl relative z-10">{category.emoji}</span>
              <span
                className="text-xs text-gray-500 mt-2 relative z-10"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                {category.label}
              </span>
            </div>
          )}

          {/* Bottom-of-image gradient — keeps badges legible over busy posters */}
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 via-black/10 to-transparent pointer-events-none" />

          {/* Date badge — top-left maroon badge */}
          <div className="absolute top-3 left-3 z-20">
            <div className="date-badge flex flex-col items-center min-w-[48px]">
              <span className="text-[10px] font-bold tracking-wider opacity-90">{dateParts.month}</span>
              <span className="text-xl font-bold leading-none">{dateParts.day}</span>
              <span className="text-[9px] font-medium opacity-80 mt-0.5">{dateParts.weekday}</span>
            </div>
          </div>

          {/* Price badge */}
          <div className="absolute top-3 right-3 z-20">
            {(() => {
              const pb = getPriceBadge(event.price)
              return (
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold shadow-md shadow-black/20 ${
                    pb.isFree ? 'bg-emerald-500 text-white' : 'bg-[#7C3AED] text-white'
                  }`}
                  style={{ fontFamily: 'Inter, sans-serif' }}
                >
                  {pb.label}
                </span>
              )
            })()}
          </div>
        </div>

        {/* Content — flex-1 so short titles don't collapse the card. */}
        <div className="p-4 space-y-3 flex-1 flex flex-col">
          <h3
            className="text-lg font-semibold text-[#0F172A] line-clamp-2 leading-snug transition-colors duration-200 group-hover:text-[#4F46E5] min-h-[3.25rem]"
            style={{ fontFamily: 'Plus Jakarta Sans, serif' }}
          >
            {event.title}
          </h3>

          {/* Category tag */}
          <div>
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium text-[#4F46E5] bg-[#FFF5F5] border border-[#F0D8D8]"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {category.emoji} {category.label}
            </span>
          </div>

          <div
            className="space-y-1.5 text-sm text-gray-600"
            style={{ fontFamily: 'Inter, sans-serif' }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={14} className="text-[#7C3AED] flex-shrink-0" />
              <span>{formatDate(event.date)}</span>
              {nExtra > 0 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-[#E2E8F0] text-[#7C3AED] bg-[#FFF8ED]"
                  title={extraDates.map(formatDate).join(' · ')}
                >
                  +{nExtra} more {nExtra === 1 ? 'date' : 'dates'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#7C3AED] flex-shrink-0" />
              <span>{formatTime(event.time)}</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-[#4F46E5] flex-shrink-0" />
              <span className="truncate">
                {event.venue}
                {event.venue && event.city ? ', ' : ''}
                {event.city}
              </span>
            </div>
          </div>

          {/* View Details button */}
          <div className="mt-auto pt-3">
            <span
              className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors duration-200"
              style={{ backgroundColor: '#4F46E5' }}
            >
              View Details
            </span>
          </div>
        </div>

        {/* Hover accent underline — slides in from the left */}
        <div className="absolute left-0 right-0 bottom-0 h-[2px] bg-gradient-to-r from-[#4F46E5] via-[#7C3AED] to-[#4F46E5] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
      </div>
    </motion.a>
  )
}
