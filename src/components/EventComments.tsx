'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  MessageCircle,
  Heart,
  Reply,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pin,
  Send,
  User,
} from 'lucide-react'

interface Comment {
  id: string
  event_id: string
  parent_id: string | null
  author_name: string
  author_email: string
  body: string
  likes_count: number
  pinned: boolean
  created_at: string
  replies?: Comment[]
}

interface Props {
  eventId: string
  organizerEmail?: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const AVATAR_COLORS = [
  'bg-purple-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-blue-500',
  'bg-teal-500',
  'bg-orange-500',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

/* ── Inline comment form ─────────────────────────────────────────────── */
interface CommentFormProps {
  eventId: string
  parentId?: string
  onSuccess: (comment: Comment) => void
  onCancel?: () => void
  compact?: boolean
  savedName: string
  savedEmail: string
  onSaveUser: (name: string, email: string) => void
}

function CommentForm({
  eventId,
  parentId,
  onSuccess,
  onCancel,
  compact = false,
  savedName,
  savedEmail,
  onSaveUser,
}: CommentFormProps) {
  const [name, setName] = useState(savedName)
  const [email, setEmail] = useState(savedEmail)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (compact && textareaRef.current) textareaRef.current.focus()
  }, [compact])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !body.trim()) {
      setError('Please fill in all fields.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: eventId,
          parent_id: parentId ?? null,
          author_name: name.trim(),
          author_email: email.trim(),
          body: body.trim(),
        }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      onSaveUser(name.trim(), email.trim())
      setBody('')
      onSuccess({ ...json.comment, replies: [] })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post comment.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={compact ? 'mt-2' : 'mb-6'}>
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
            <label className="block text-xs font-medium text-gray-500 mb-1">Email (not shown)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane@example.com"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
        </div>
      )}
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={compact ? 'Write a reply…' : 'Share your thoughts about this event…'}
          rows={compact ? 2 : 3}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-white"
        />
        <button
          type="submit"
          disabled={submitting}
          className="absolute right-2 bottom-2 p-1.5 rounded-md bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-50 transition-colors"
        >
          {submitting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} />
          )}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      {compact && (
        <div className="flex items-center gap-2 mt-2">
          <div className="grid grid-cols-2 gap-2 flex-1">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            />
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </form>
  )
}

/* ── Single comment card ──────────────────────────────────────────────── */
interface CommentCardProps {
  comment: Comment
  organizerEmail?: string
  eventId: string
  savedName: string
  savedEmail: string
  onSaveUser: (name: string, email: string) => void
  onLike: (commentId: string) => void
  onReplyAdded: (parentId: string, reply: Comment) => void
  depth?: number
}

function CommentCard({
  comment,
  organizerEmail,
  eventId,
  savedName,
  savedEmail,
  onSaveUser,
  onLike,
  onReplyAdded,
  depth = 0,
}: CommentCardProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [showReplies, setShowReplies] = useState(true)
  const isOrganizer = organizerEmail && comment.author_email === organizerEmail
  const hasReplies = (comment.replies?.length ?? 0) > 0

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-indigo-100 pl-4' : ''}>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ${avatarColor(comment.author_name)}`}
          >
            {getInitials(comment.author_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-1.5">
              <span className="text-sm font-semibold text-gray-800">{comment.author_name}</span>
              {isOrganizer && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
                  <User size={10} />
                  Organizer
                </span>
              )}
              {comment.pinned && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                  <Pin size={10} />
                  Pinned
                </span>
              )}
              <span className="text-xs text-gray-400 ml-auto">{timeAgo(comment.created_at)}</span>
            </div>
            <p className="mt-1 text-sm text-gray-700 leading-relaxed">{comment.body}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-3 pl-11">
          <button
            onClick={() => onLike(comment.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-rose-500 transition-colors group"
          >
            <Heart size={13} className="group-hover:fill-rose-100 transition-colors" />
            <span>{comment.likes_count > 0 ? comment.likes_count : ''}</span>
          </button>
          {depth === 0 && (
            <button
              onClick={() => setShowReplyForm((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 transition-colors"
            >
              <Reply size={13} />
              Reply
            </button>
          )}
          {hasReplies && depth === 0 && (
            <button
              onClick={() => setShowReplies((v) => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto"
            >
              {showReplies ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              {comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>

        {/* Reply form */}
        {showReplyForm && (
          <div className="mt-3 pl-11">
            <CommentForm
              eventId={eventId}
              parentId={comment.id}
              compact
              savedName={savedName}
              savedEmail={savedEmail}
              onSaveUser={onSaveUser}
              onSuccess={(reply) => {
                onReplyAdded(comment.id, reply)
                setShowReplyForm(false)
              }}
              onCancel={() => setShowReplyForm(false)}
            />
          </div>
        )}
      </div>

      {/* Replies */}
      {hasReplies && showReplies && depth === 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies!.map((reply) => (
            <CommentCard
              key={reply.id}
              comment={reply}
              organizerEmail={organizerEmail}
              eventId={eventId}
              savedName={savedName}
              savedEmail={savedEmail}
              onSaveUser={onSaveUser}
              onLike={onLike}
              onReplyAdded={onReplyAdded}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main component ───────────────────────────────────────────────────── */
export default function EventComments({ eventId, organizerEmail }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savedName, setSavedName] = useState('')
  const [savedEmail, setSavedEmail] = useState('')

  useEffect(() => {
    setSavedName(localStorage.getItem('comment_name') ?? '')
    setSavedEmail(localStorage.getItem('comment_email') ?? '')
  }, [])

  function handleSaveUser(name: string, email: string) {
    setSavedName(name)
    setSavedEmail(email)
    localStorage.setItem('comment_name', name)
    localStorage.setItem('comment_email', email)
  }

  const fetchComments = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/events/${eventId}/comments`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setComments(json.comments)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load comments.')
    } finally {
      setLoading(false)
    }
  }, [eventId])

  useEffect(() => {
    fetchComments()
  }, [fetchComments])

  async function handleLike(commentId: string) {
    const email = savedEmail || localStorage.getItem('comment_email')
    if (!email) return
    try {
      const res = await fetch(`/api/events/${eventId}/comments/${commentId}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liker_email: email }),
      })
      const json = await res.json()
      if (!json.ok) return
      setComments((prev) =>
        prev.map((c) => {
          if (c.id === commentId) return { ...c, likes_count: json.likes_count }
          return {
            ...c,
            replies: c.replies?.map((r) =>
              r.id === commentId ? { ...r, likes_count: json.likes_count } : r,
            ),
          }
        }),
      )
    } catch {
      // silent
    }
  }

  function handleNewComment(comment: Comment) {
    setComments((prev) => [comment, ...prev])
  }

  function handleReplyAdded(parentId: string, reply: Comment) {
    setComments((prev) =>
      prev.map((c) =>
        c.id === parentId ? { ...c, replies: [...(c.replies ?? []), reply] } : c,
      ),
    )
  }

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2 mb-5">
        <MessageCircle size={20} className="text-indigo-500" />
        <h2 className="text-lg font-bold text-gray-800">
          Comments{comments.length > 0 ? ` (${comments.length})` : ''}
        </h2>
      </div>

      {/* Add comment form */}
      <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-6">
        <p className="text-sm font-medium text-gray-700 mb-3">Add a comment</p>
        <CommentForm
          eventId={eventId}
          savedName={savedName}
          savedEmail={savedEmail}
          onSaveUser={handleSaveUser}
          onSuccess={handleNewComment}
        />
      </div>

      {/* Comment list */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading comments…
        </div>
      ) : error ? (
        <div className="text-center py-8 text-sm text-red-500">{error}</div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10">
          <MessageCircle size={36} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No comments yet. Be the first to share your thoughts!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              organizerEmail={organizerEmail}
              eventId={eventId}
              savedName={savedName}
              savedEmail={savedEmail}
              onSaveUser={handleSaveUser}
              onLike={handleLike}
              onReplyAdded={handleReplyAdded}
            />
          ))}
        </div>
      )}
    </section>
  )
}
