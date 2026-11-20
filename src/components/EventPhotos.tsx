'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Camera,
  X,
  ChevronLeft,
  ChevronRight,
  Upload,
  Loader2,
  Heart,
  ImageIcon,
  Plus,
} from 'lucide-react'

interface Photo {
  id: string
  event_id: string
  url: string
  caption: string | null
  uploader_name: string
  uploader_email: string
  likes_count: number
  created_at: string
}

interface Props {
  eventId: string
}

/* ── Upload modal ─────────────────────────────────────────────────────── */
interface UploadModalProps {
  eventId: string
  onClose: () => void
  onUploaded: (photo: Photo) => void
}

function UploadModal({ eventId, onClose, onUploaded }: UploadModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [caption, setCaption] = useState('')
  const [name, setName] = useState(() => localStorage.getItem('comment_name') ?? '')
  const [email, setEmail] = useState(() => localStorage.getItem('comment_email') ?? '')
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function selectFile(f: File) {
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) selectFile(f)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Please select a photo.'); return }
    if (!name.trim()) { setError('Please enter your name.'); return }
    if (!email.trim()) { setError('Please enter your email.'); return }

    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('uploader_name', name.trim())
      fd.append('uploader_email', email.trim())
      fd.append('caption', caption.trim())

      const res = await fetch(`/api/events/${eventId}/photos`, { method: 'POST', body: fd })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)

      localStorage.setItem('comment_name', name.trim())
      localStorage.setItem('comment_email', email.trim())
      onUploaded(json.photo)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <Camera size={16} className="text-indigo-500" />
            Add a Photo
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleUpload} className="p-5 space-y-4">
          {/* Drop zone / preview */}
          {preview ? (
            <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setFile(null); setPreview(null) }}
                className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
            >
              <Upload size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500 font-medium">Drag & drop or click to select</p>
              <p className="text-xs text-gray-400 mt-1">JPG, PNG, GIF up to 10MB</p>
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) selectFile(f) }}
              />
            </div>
          )}

          {/* Caption */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Caption (optional)</label>
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>

          {/* Name & email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Your name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
              />
            </div>
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={uploading}
            className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
            {uploading ? 'Uploading…' : 'Upload Photo'}
          </button>
        </form>
      </div>
    </div>
  )
}

/* ── Lightbox ──────────────────────────────────────────────────────────── */
interface LightboxProps {
  photos: Photo[]
  index: number
  onClose: () => void
  onNav: (idx: number) => void
}

function Lightbox({ photos, index, onClose, onNav }: LightboxProps) {
  const photo = photos[index]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') onNav(Math.min(index + 1, photos.length - 1))
      if (e.key === 'ArrowLeft') onNav(Math.max(index - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onClose, onNav])

  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Close */}
      <button
        className="absolute top-4 right-4 text-white/70 hover:text-white transition-colors z-10"
        onClick={onClose}
      >
        <X size={28} />
      </button>

      {/* Prev */}
      {index > 0 && (
        <button
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 rounded-full p-2 transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); onNav(index - 1) }}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Next */}
      {index < photos.length - 1 && (
        <button
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white bg-black/30 rounded-full p-2 transition-colors z-10"
          onClick={(e) => { e.stopPropagation(); onNav(index + 1) }}
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* Image */}
      <div
        className="max-w-5xl max-h-[85vh] flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={photo.caption ?? 'Event photo'}
          className="max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl"
        />
        {(photo.caption || photo.uploader_name) && (
          <div className="mt-3 text-center">
            {photo.caption && (
              <p className="text-white text-sm">{photo.caption}</p>
            )}
            <p className="text-white/50 text-xs mt-1">
              Uploaded by {photo.uploader_name} · {index + 1} / {photos.length}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Photo card ────────────────────────────────────────────────────────── */
interface PhotoCardProps {
  photo: Photo
  onClick: () => void
  onLike: (id: string) => void
}

function PhotoCard({ photo, onClick, onLike }: PhotoCardProps) {
  return (
    <div
      className="group relative rounded-xl overflow-hidden bg-gray-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer aspect-square"
      onClick={onClick}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption ?? 'Event photo'}
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="absolute bottom-2 left-2 right-2">
          {photo.caption && (
            <p className="text-white text-xs font-medium truncate">{photo.caption}</p>
          )}
          <p className="text-white/70 text-xs">{photo.uploader_name}</p>
        </div>
      </div>
      {/* Like button */}
      <button
        className="absolute top-2 right-2 flex items-center gap-1 bg-white/90 hover:bg-white text-gray-700 rounded-full px-2 py-1 text-xs font-medium shadow transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => { e.stopPropagation(); onLike(photo.id) }}
      >
        <Heart size={11} className="text-rose-400" />
        {photo.likes_count > 0 && photo.likes_count}
      </button>
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function EventPhotos({ eventId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  const fetchPhotos = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/photos`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setPhotos(json.photos)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load photos.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => { fetchPhotos() }, [fetchPhotos])

  async function handleLike(photoId: string) {
    const email = localStorage.getItem('comment_email')
    if (!email) return
    try {
      const res = await fetch(`/api/events/${eventId}/photos/${photoId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liker_email: email }),
      })
      const json = await res.json()
      if (!json.ok) return
      setPhotos((prev) =>
        prev.map((p) => (p.id === photoId ? { ...p, likes_count: json.likes_count } : p)),
      )
    } catch {
      // silent
    }
  }

  function handleUploaded(photo: Photo) {
    setPhotos((prev) => [photo, ...prev])
  }

  return (
    <section className="mt-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Camera size={20} className="text-indigo-500" />
          <h2 className="text-lg font-bold text-gray-800">
            Photos{photos.length > 0 ? ` (${photos.length})` : ''}
          </h2>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={14} />
          Add Photos
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading photos…
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-red-500">{error}</div>
      ) : photos.length === 0 ? (
        <div
          className="border-2 border-dashed border-gray-200 rounded-2xl py-14 text-center cursor-pointer hover:border-indigo-300 hover:bg-gray-50 transition-colors"
          onClick={() => setShowUpload(true)}
        >
          <ImageIcon size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No photos yet.</p>
          <p className="text-xs text-indigo-500 mt-1 font-medium">Be the first to share a photo!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {photos.map((photo, idx) => (
            <PhotoCard
              key={photo.id}
              photo={photo}
              onClick={() => setLightboxIdx(idx)}
              onLike={handleLike}
            />
          ))}
        </div>
      )}

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          eventId={eventId}
          onClose={() => setShowUpload(false)}
          onUploaded={handleUploaded}
        />
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNav={setLightboxIdx}
        />
      )}
    </section>
  )
}
