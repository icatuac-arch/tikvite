'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { User, Save } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  id: string
  name: string
  bio: string
  slug: string
  role: string
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [slug, setSlug] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        setError('Failed to load profile')
        setLoading(false)
        return
      }

      setProfile(data)
      setName(data.name || '')
      setBio(data.bio || '')
      setSlug(data.slug || '')
      setRole(data.role || '')
      setLoading(false)
    }

    loadProfile()
  }, [router])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSaving(true)

    const supabase = createClient()

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ name, bio, slug })
      .eq('id', profile?.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSuccess('Profile updated successfully')
    setSaving(false)

    setTimeout(() => setSuccess(''), 3000)
  }

  const inputClass = "w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-1 transition-colors"
  const inputStyle = {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    color: '#334155',
    outlineColor: '#4F46E5',
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
        
        <main className="flex-1 flex items-center justify-center">
          <div style={{ color: '#475569' }}>Loading...</div>
        </main>
        
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8FAFC' }}>
      

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-lg">
          <div className="rounded-2xl p-8 shadow-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-3 mb-8">
              <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(123,31,31,0.1)' }}>
                <User className="h-5 w-5" style={{ color: '#4F46E5' }} />
              </div>
              <div>
                <h1
                  className="text-2xl font-bold"
                  style={{ fontFamily: 'Plus Jakarta Sans, serif', color: '#0F172A' }}
                >
                  Profile Settings
                </h1>
                <p className="text-sm" style={{ fontFamily: 'Inter, sans-serif', color: '#475569' }}>
                  Manage your publisher profile
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {success && (
              <div className="mb-6 rounded-lg bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-700">
                {success}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-5" style={{ fontFamily: 'Inter, sans-serif' }}>
              <div>
                <label htmlFor="role" className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>
                  Role
                </label>
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-medium capitalize"
                  style={{ backgroundColor: 'rgba(123,31,31,0.08)', border: '1px solid rgba(123,31,31,0.2)', color: '#4F46E5' }}
                >
                  {role}
                </span>
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your display name"
                  className={inputClass}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>
                  Bio
                </label>
                <textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  placeholder="Tell us about yourself or your organization"
                  className={`${inputClass} resize-none`}
                  style={inputStyle}
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium mb-1.5" style={{ color: '#475569' }}>
                  Slug
                </label>
                <input
                  id="slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="your-public-url"
                  className={inputClass}
                  style={inputStyle}
                />
                <p className="mt-1 text-xs" style={{ color: '#475569' }}>
                  This will be your public publisher URL
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:opacity-90"
                style={{ backgroundColor: '#4F46E5', color: '#F8FAFC' }}
              >
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      </main>

      
    </div>
  )
}
