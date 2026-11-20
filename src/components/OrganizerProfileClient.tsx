'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Globe,
  Users,
  CalendarDays,
  MapPin,
  Bell,
  X,
  Loader2,
  ChevronRight,
} from 'lucide-react'

// Social brand icons as simple SVG components (lucide-react v1.58 removed Instagram/Twitter)
function InstagramIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <circle cx="12" cy="12" r="4"/>
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none"/>
    </svg>
  )
}
function TwitterIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
}
import Link from 'next/link'
import { getShortId } from '@/lib/constants'

interface OrganizerProfile {
  id: string
  user_id: string
  slug: string
  display_name: string
  bio: string
  avatar_url: string
  cover_image_url: string
  website: string
  instagram: string
  twitter: string
  followers_count: number
  events_count: number
  is_verified: boolean
}

interface Event {
  id: string
  title: string
  date: string
  time: string
  venue: string
  city: string
  image_url: string
  category: string
  price: string
  rsvp_enabled: boolean
}

interface Props {
  profile: OrganizerProfile
  events: Event[]
  slug: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Gradient fallback for cover image
const GRADIENT_FALLBACKS = [
  'from-indigo-600 to-purple-700',
  'from-violet-600 to-fuchsia-700',
  'from-purple-600 to-indigo-700',
  'from-blue-600 to-indigo-700',
]

function getGradient(slug: string) {
  const idx = slug.charCodeAt(0) % GRADIENT_FALLBACKS.length
  return GRADIENT_FALLBACKS[idx]
}

function FollowPopover({
  slug,
  onClose,
}: {
  slug: string
  onClose: (didFollow: boolean) => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [notify, setNotify] = useState(true)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!email.trim()) { setErr('Email is required'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr('Enter a valid email'); return }
    setLoading(true)
    setErr('')
    try {
      const res = await fetch(`/api/organizer/${slug}/follow`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follower_email: email, follower_name: name, notify_new_events: notify }),
      })
      const d = await res.json()
      if (d.ok) {
        setDone(true)
        setTimeout(() => onClose(true), 1500)
      } else {
        setErr(d.message || 'Failed to follow')
      }
    } catch {
      setErr('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute top-full right-0 mt-2 z-30 bg-white rounded-2xl border border-slate-200 shadow-xl p-5 w-72">
      <div className="flex items-center justify-between mb-4">
        <p className="font-semibold text-slate-800 text-sm">Follow organizer</p>
        <button onClick={() => onClose(false)} className="text-slate-400 hover:text-slate-600">
          <X size={16} />
        </button>
      </div>

      {done ? (
        <div className="flex flex-col items-center gap-2 py-3">
          <CheckCircle2 size={32} className="text-emerald-500" />
          <p className="text-sm text-slate-700 font-medium">You're following!</p>
          <p className="text-xs text-slate-400 text-center">We'll notify you about new events.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <input
              type="email"
              placeholder="Your email *"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErr('') }}
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 ${err ? 'border-red-400' : 'border-slate-200'}`}
            />
            {err && <p className="text-xs text-red-500">{err}</p>}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={notify}
                onChange={(e) => setNotify(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span className="text-xs text-slate-600">Notify me about new events</span>
            </label>
          </div>
          <button
            onClick={submit}
            disabled={loading}
            className="mt-4 w-full py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {loading ? 'Following…' : 'Follow'}
          </button>
        </>
      )}
    </div>
  )
}

export default function OrganizerProfileClient({ profile, events, slug }: Props) {
  const [showFollowPopover, setShowFollowPopover] = useState(false)
  const [followersCount, setFollowersCount] = useState(profile.followers_count)

  const gradient = getGradient(slug)

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Cover */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden">
        {profile.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.cover_image_url}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* Profile card */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-16 sm:-mt-20">
          {/* Avatar */}
          <div className="relative inline-block">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt={profile.display_name}
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div
                className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl border-4 border-white shadow-lg flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-3xl font-bold`}
              >
                {profile.display_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Name + actions */}
        <div className="mt-3 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{profile.display_name}</h1>
              {profile.is_verified && (
                <span title="Verified organizer">
                  <CheckCircle2 size={20} className="text-indigo-500 flex-shrink-0" />
                </span>
              )}
            </div>
            <p className="text-slate-500 text-sm mt-0.5">@{profile.slug}</p>
          </div>

          {/* Follow button */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowFollowPopover((v) => !v)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Bell size={15} />
              Follow
            </button>
            <AnimatePresence>
              {showFollowPopover && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <FollowPopover
                    slug={slug}
                    onClose={(didFollow) => {
                      setShowFollowPopover(false)
                      if (didFollow) setFollowersCount((c) => c + 1)
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Bio */}
        {profile.bio && (
          <p className="mt-4 text-slate-600 text-sm leading-relaxed max-w-xl">{profile.bio}</p>
        )}

        {/* Stats */}
        <div className="mt-5 flex items-center gap-5 text-sm text-slate-500">
          <div className="flex items-center gap-1.5">
            <CalendarDays size={15} className="text-indigo-400" />
            <span>
              <span className="font-semibold text-slate-800">{events.length}</span> upcoming events
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users size={15} className="text-indigo-400" />
            <span>
              <span className="font-semibold text-slate-800">{followersCount.toLocaleString()}</span> followers
            </span>
          </div>
        </div>

        {/* Social links */}
        {(profile.website || profile.instagram || profile.twitter) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {profile.website && (
              <a
                href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <Globe size={13} />
                {profile.website.replace(/^https?:\/\//, '')}
              </a>
            )}
            {profile.instagram && (
              <a
                href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-pink-600 transition-colors"
              >
                <InstagramIcon size={13} />
                @{profile.instagram.replace('@', '')}
              </a>
            )}
            {profile.twitter && (
              <a
                href={`https://x.com/${profile.twitter.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-sky-600 transition-colors"
              >
                <TwitterIcon size={13} />
                @{profile.twitter.replace('@', '')}
              </a>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 mt-8 mb-8" />

        {/* Upcoming Events */}
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-5">Upcoming Events</h2>
          {events.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-slate-400 text-sm">
              No upcoming events right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-16">
              {events.map((event, i) => {
                const shortId = getShortId(event.id)
                return (
                  <motion.a
                    key={event.id}
                    href={`/e/${shortId}`}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="group block rounded-2xl border border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                  >
                    {/* Poster */}
                    <div className="relative h-40 w-full bg-slate-100 overflow-hidden">
                      {event.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={event.image_url}
                          alt={event.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${gradient} opacity-60`} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="p-4">
                      <p className="font-semibold text-slate-800 text-sm line-clamp-2 leading-snug group-hover:text-indigo-700 transition-colors">
                        {event.title}
                      </p>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <CalendarDays size={12} className="text-indigo-400 flex-shrink-0" />
                          {formatDate(event.date)}
                          {event.time && ` · ${event.time}`}
                        </div>
                        {(event.venue || event.city) && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin size={12} className="text-indigo-400 flex-shrink-0" />
                            <span className="truncate">
                              {[event.venue, event.city].filter(Boolean).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span
                          className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            event.rsvp_enabled
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {event.rsvp_enabled ? 'RSVP Open' : 'View'}
                        </span>
                        <ChevronRight size={14} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                      </div>
                    </div>
                  </motion.a>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
