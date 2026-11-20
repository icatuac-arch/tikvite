'use client'

import { useState, useEffect, useRef } from 'react'
import {
  User,
  Link2,
  Globe,
  Save,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Image,
  Eye,
  EyeOff,
} from 'lucide-react'

// Social brand icons (lucide-react v1.58 removed Instagram/Twitter)
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

interface OrganizerProfile {
  id?: string
  slug: string
  display_name: string
  bio: string
  avatar_url: string
  cover_image_url: string
  website: string
  instagram: string
  twitter: string
  is_verified?: boolean
  followers_count?: number
}

interface Props {
  initialProfile?: OrganizerProfile | null
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

// Gradient fallback previews
const GRADIENT_FALLBACKS = [
  'from-indigo-600 to-purple-700',
  'from-violet-600 to-fuchsia-700',
  'from-purple-600 to-indigo-700',
  'from-blue-600 to-indigo-700',
]

function getGradient(slug: string) {
  if (!slug) return GRADIENT_FALLBACKS[0]
  const idx = slug.charCodeAt(0) % GRADIENT_FALLBACKS.length
  return GRADIENT_FALLBACKS[idx]
}

function ProfilePreview({ form }: { form: OrganizerProfile }) {
  const gradient = getGradient(form.slug)
  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
      {/* Cover */}
      <div className="relative h-24 w-full overflow-hidden">
        {form.cover_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={form.cover_image_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
        )}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <div className="px-4 pb-4">
        {/* Avatar */}
        <div className="relative -mt-7 mb-2 inline-block">
          {form.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.avatar_url}
              alt=""
              className="w-14 h-14 rounded-xl border-3 border-white shadow-md object-cover"
            />
          ) : (
            <div
              className={`w-14 h-14 rounded-xl border-3 border-white shadow-md flex items-center justify-center bg-gradient-to-br ${gradient} text-white text-xl font-bold`}
            >
              {form.display_name ? form.display_name.charAt(0).toUpperCase() : '?'}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <p className="font-bold text-slate-800 text-sm truncate">
            {form.display_name || 'Display Name'}
          </p>
          {form.is_verified && <CheckCircle2 size={13} className="text-indigo-500 flex-shrink-0" />}
        </div>
        <p className="text-xs text-slate-400">
          {form.slug ? `@${form.slug}` : '@your-slug'}
        </p>
        {form.bio && (
          <p className="mt-2 text-xs text-slate-500 leading-relaxed line-clamp-2">{form.bio}</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
          {form.website && (
            <span className="flex items-center gap-0.5">
              <Globe size={10} />
              {form.website.replace(/^https?:\/\//, '').slice(0, 20)}
            </span>
          )}
          {form.instagram && (
            <span className="flex items-center gap-0.5">
              <InstagramIcon size={10} />
              @{form.instagram.replace('@', '')}
            </span>
          )}
          {form.twitter && (
            <span className="flex items-center gap-0.5">
              <TwitterIcon size={10} />
              @{form.twitter.replace('@', '')}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OrganizerSetup({ initialProfile }: Props) {
  const [form, setForm] = useState<OrganizerProfile>({
    slug: initialProfile?.slug || '',
    display_name: initialProfile?.display_name || '',
    bio: initialProfile?.bio || '',
    avatar_url: initialProfile?.avatar_url || '',
    cover_image_url: initialProfile?.cover_image_url || '',
    website: initialProfile?.website || '',
    instagram: initialProfile?.instagram || '',
    twitter: initialProfile?.twitter || '',
    is_verified: initialProfile?.is_verified || false,
    followers_count: initialProfile?.followers_count || 0,
  })
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(!!initialProfile?.slug)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ text: string; ok: boolean } | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  // Auto-generate slug from display_name unless manually edited
  useEffect(() => {
    if (!slugManuallyEdited && form.display_name) {
      setForm((f) => ({ ...f, slug: slugify(form.display_name) }))
    }
  }, [form.display_name, slugManuallyEdited])

  const set = (key: keyof OrganizerProfile, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const save = async () => {
    if (!form.display_name.trim()) {
      setToast({ text: 'Display name is required', ok: false })
      setTimeout(() => setToast(null), 3000)
      return
    }
    if (!form.slug.trim()) {
      setToast({ text: 'Slug is required', ok: false })
      setTimeout(() => setToast(null), 3000)
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/organizer/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const d = await res.json()
      if (d.ok) {
        setToast({ text: 'Profile saved!', ok: true })
      } else {
        setToast({ text: d.message || 'Failed to save', ok: false })
      }
    } catch {
      setToast({ text: 'Network error', ok: false })
    } finally {
      setSaving(false)
      setTimeout(() => setToast(null), 3500)
    }
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
            toast.ok ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
          }`}
        >
          {toast.ok ? <CheckCircle2 size={14} className="inline mr-1.5" /> : null}
          {toast.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Basic info */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <User size={15} className="text-indigo-500" />
              Basic Info
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Display Name *</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => set('display_name', e.target.value)}
                placeholder="Your organization or name"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Profile URL Slug *
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                <span className="pl-3 pr-1 text-sm text-slate-400 bg-slate-50 py-2.5 border-r border-slate-200 select-none whitespace-nowrap">
                  tikvite.com/o/
                </span>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => {
                    setSlugManuallyEdited(true)
                    set('slug', slugify(e.target.value))
                  }}
                  placeholder="your-slug"
                  className="flex-1 px-3 py-2.5 text-sm text-slate-800 bg-white focus:outline-none"
                />
              </div>
              {form.slug && (
                <a
                  href={`/o/${form.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 mt-1"
                >
                  <ExternalLink size={11} />
                  Preview public profile
                </a>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => set('bio', e.target.value)}
                rows={3}
                placeholder="Tell people about you or your organization…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              />
            </div>
          </div>

          {/* Images */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Image size={15} className="text-indigo-500" />
              Images
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Avatar URL</label>
              <input
                type="url"
                value={form.avatar_url}
                onChange={(e) => set('avatar_url', e.target.value)}
                placeholder="https://…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-slate-400 mt-1">
                Upload to your storage and paste the URL here
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Cover Image URL</label>
              <input
                type="url"
                value={form.cover_image_url}
                onChange={(e) => set('cover_image_url', e.target.value)}
                placeholder="https://…"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <p className="text-xs text-slate-400 mt-1">
                Recommended: 1200×400px or wider
              </p>
            </div>
          </div>

          {/* Social links */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Link2 size={15} className="text-indigo-500" />
              Social & Web
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <Globe size={11} /> Website
              </label>
              <input
                type="url"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <InstagramIcon size={11} /> Instagram handle
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                <span className="pl-3 text-slate-400 text-sm py-2.5">@</span>
                <input
                  type="text"
                  value={form.instagram.replace('@', '')}
                  onChange={(e) => set('instagram', e.target.value.replace('@', ''))}
                  placeholder="handle"
                  className="flex-1 px-2 py-2.5 text-sm text-slate-800 bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 flex items-center gap-1">
                <TwitterIcon size={11} /> X (Twitter) handle
              </label>
              <div className="flex items-center rounded-lg border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-400">
                <span className="pl-3 text-slate-400 text-sm py-2.5">@</span>
                <input
                  type="text"
                  value={form.twitter.replace('@', '')}
                  onChange={(e) => set('twitter', e.target.value.replace('@', ''))}
                  placeholder="handle"
                  className="flex-1 px-2 py-2.5 text-sm text-slate-800 bg-white focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Preview sidebar */}
        <div className="space-y-4">
          <div className="sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Profile Preview</p>
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 lg:hidden"
              >
                {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
                {showPreview ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className={showPreview || true ? 'block' : 'hidden lg:block'}>
              <ProfilePreview form={form} />
            </div>
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save size={16} />
              Save Profile
            </>
          )}
        </button>
      </div>
    </div>
  )
}
