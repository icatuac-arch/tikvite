'use client'

import { useState } from 'react'
import { Mail, User, MessageSquare, Send, Loader2, CheckCircle } from 'lucide-react'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Simulated submission delay (no backend wired yet)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setSubmitted(true)
    setLoading(false)
  }

  return (
    <>
      
      <main className="bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">
              Contact Us
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary">
              Have a question or need help? We are here for you.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 lg:grid-cols-5">
            {/* Contact info */}
            <div className="lg:col-span-2">
              <div className="rounded-xl border border-border bg-white p-6 shadow-sm">
                <h2 className="font-heading text-lg font-semibold text-text">Get in touch</h2>
                <p className="mt-3 text-sm leading-relaxed text-text-secondary">
                  Reach out to us directly or use the form. We typically respond within one business day.
                </p>
                <div className="mt-6 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-50">
                      <Mail className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text">Email</p>
                      <a
                        href="mailto:support@ticvite.com"
                        className="text-sm text-primary hover:text-primary-dark transition-colors"
                      >
                        support@ticvite.com
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact form */}
            <div className="lg:col-span-3">
              <div className="rounded-xl border border-border bg-white p-6 shadow-sm sm:p-8">
                {submitted ? (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-success-light">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div className="text-center">
                      <h2 className="font-heading text-lg font-semibold text-text">
                        Message sent
                      </h2>
                      <p className="mt-2 text-sm text-text-secondary">
                        Thank you for reaching out. We will get back to you as soon as possible.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setSubmitted(false)
                        setName('')
                        setEmail('')
                        setMessage('')
                      }}
                      className="mt-2 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-text">
                        Your name
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                        <input
                          id="name"
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Full name"
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
                      <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-text">
                        Message
                      </label>
                      <div className="relative">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-text-muted" />
                        <textarea
                          id="message"
                          required
                          rows={5}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="How can we help?"
                          className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-text-muted transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
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
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send message
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
      
    </>
  )
}
