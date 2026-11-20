import Link from 'next/link'
import { Home, Compass, Ticket } from 'lucide-react'

export default function NotFound() {
  return (
    <>
      <div className="min-h-screen bg-surface-muted flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          {/* 404 number */}
          <div className="relative mb-6">
            <span className="font-heading text-[120px] sm:text-[160px] font-black leading-none bg-gradient-to-br from-primary via-accent to-primary bg-clip-text text-transparent select-none">
              404
            </span>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-primary/5 flex items-center justify-center">
                <Ticket className="text-primary/30" size={36} />
              </div>
            </div>
          </div>

          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text mb-3">
            Page not found
          </h1>
          <p className="text-text-secondary mb-8 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
            Let&apos;s get you back on track.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition shadow-lg shadow-primary/20"
            >
              <Home size={16} />
              Back to Home
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary font-semibold text-sm border border-border hover:border-primary/30 hover:shadow-md transition"
            >
              <Compass size={16} />
              Explore Events
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
