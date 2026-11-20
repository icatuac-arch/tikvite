'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, AlertCircle, Loader2, CheckCircle, ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })

      if (resetError) {
        setError(resetError.message)
        setLoading(false)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      
      <main className="min-h-[calc(100vh-160px)] flex items-center justify-center bg-surface-muted px-4 py-16">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-border bg-white p-8 shadow-sm">
            <div className="mb-8 text-center">
              <h1 className="font-heading text-2xl font-bold text-text">
                Reset your password
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Enter your email and we&apos;ll send you a link to reset your password
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div className="text-center">
                  <h2 className="font-heading text-lg font-semibold text-text">
                    Check your email
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    If an account exists for{' '}
                    <span className="font-medium text-text">{email}</span>,
                    you&apos;ll receive a password reset link shortly.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to sign in
                </Link>
              </div>
            ) : (
              <>
                {error && (
                  <div className="mb-6 flex items-start gap-3 rounded-lg border border-danger-light bg-danger-light p-3">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-danger" />
                    <p className="text-sm text-danger">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text">
                      Email address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending link...
                      </>
                    ) : (
                      'Send reset link'
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back to sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </main>
      
    </>
  )
}
