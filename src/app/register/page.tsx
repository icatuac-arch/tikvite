'use client'

import { useState } from 'react'
import Link from 'next/link'
import { User, Mail, Lock, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      setLoading(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
          },
        },
      })

      if (authError) {
        setError(authError.message)
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
                Create your account
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Start creating events on Ticvite for free
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
                    We&apos;ve sent a confirmation link to{' '}
                    <span className="font-medium text-text">{email}</span>.
                    Please check your inbox and click the link to activate your account.
                  </p>
                </div>
                <Link
                  href="/login"
                  className="mt-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                >
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
                    <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-text">
                      Full name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        id="name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your full name"
                        className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  </div>

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

                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        id="password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        minLength={6}
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
                        Creating account...
                      </>
                    ) : (
                      'Create account'
                    )}
                  </button>
                </form>

                <p className="mt-6 text-center text-sm text-text-secondary">
                  Already have an account?{' '}
                  <Link
                    href="/login"
                    className="font-medium text-primary hover:text-primary-dark transition-colors"
                  >
                    Sign in
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
