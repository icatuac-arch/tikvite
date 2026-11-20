'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, AlertCircle, Loader2, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        setLoading(false)
        return
      }

      setSuccess(true)
      setTimeout(() => {
        router.push('/dashboard')
      }, 2000)
    } catch {
      setError('An unexpected error occurred. Please try again.')
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
                Set new password
              </h1>
              <p className="mt-2 text-sm text-text-secondary">
                Enter your new password below
              </p>
            </div>

            {success ? (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div className="text-center">
                  <h2 className="font-heading text-lg font-semibold text-text">
                    Password updated
                  </h2>
                  <p className="mt-2 text-sm text-text-secondary">
                    Your password has been reset successfully. Redirecting you to your dashboard...
                  </p>
                </div>
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
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text">
                      New password
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

                  <div>
                    <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-text">
                      Confirm new password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                      <input
                        id="confirm-password"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter your password"
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
                        Updating password...
                      </>
                    ) : (
                      'Update password'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
      
    </>
  )
}
