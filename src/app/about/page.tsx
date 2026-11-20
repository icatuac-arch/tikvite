import { Ticket, Users, Globe, Heart } from 'lucide-react'

export const metadata = {
  title: 'About - Ticvite',
  description: 'About Ticvite. Our mission is to make event ticketing free and accessible for everyone.',
}

const values = [
  {
    icon: Ticket,
    title: 'Zero Platform Fees',
    description:
      'We believe organizers should keep what they earn. Ticvite charges nothing for creating events or selling tickets.',
  },
  {
    icon: Users,
    title: 'Open to Everyone',
    description:
      'Ticvite is not limited to any community, region, or event type. Anyone can create and manage events on our platform.',
  },
  {
    icon: Globe,
    title: 'Accessible by Design',
    description:
      'A clean, intuitive experience for organizers and attendees alike. No technical expertise required to get started.',
  },
  {
    icon: Heart,
    title: 'Community First',
    description:
      'We are built to support the people who bring communities together. From small meetups to large gatherings, every event matters.',
  },
]

export default function AboutPage() {
  return (
    <>
      
      <main className="bg-surface-muted">
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
          {/* Hero section */}
          <div className="text-center">
            <h1 className="font-heading text-3xl font-bold text-text sm:text-4xl">
              About Ticvite
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary leading-relaxed">
              Making event ticketing free, simple, and accessible for organizers everywhere.
            </p>
          </div>

          {/* Mission */}
          <div className="mt-12 rounded-xl border border-border bg-white p-8 shadow-sm sm:p-12">
            <h2 className="font-heading text-xl font-semibold text-text">Our Mission</h2>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              Ticvite was created with a simple belief: event organizers should not have to pay a platform
              fee to sell tickets. Whether you are hosting a community gathering, a professional conference,
              a cultural celebration, or a neighborhood meetup, you deserve a tool that works for you
              without taking a cut.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary">
              We provide everything you need to create a professional event page, sell tickets, and manage
              check-ins on event day. The only fees involved are Stripe&apos;s standard payment processing
              charges for paid tickets. Free events are completely free to run.
            </p>
          </div>

          {/* Values */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {values.map((value) => (
              <div
                key={value.title}
                className="rounded-xl border border-border bg-white p-6 shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50">
                  <value.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mt-4 font-heading text-base font-semibold text-text">
                  {value.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-text-secondary">
                  {value.description}
                </p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 rounded-xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
            <h2 className="font-heading text-xl font-semibold text-text">Ready to get started?</h2>
            <p className="mt-3 text-sm text-text-secondary">
              Create your first event in minutes. No credit card required.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a
                href="/register"
                className="inline-flex items-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md active:scale-[0.98]"
              >
                Create your free event
              </a>
              <a
                href="/contact"
                className="inline-flex items-center rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text"
              >
                Contact us
              </a>
            </div>
          </div>
        </div>
      </main>
      
    </>
  )
}
