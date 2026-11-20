'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  Rocket,
  CalendarPlus,
  CreditCard,
  ScanLine,
  Settings,
  HelpCircle,
  MessageSquare,
} from 'lucide-react'

interface FaqItem {
  q: string
  a: string
}

interface FaqSection {
  title: string
  icon: React.ReactNode
  items: FaqItem[]
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'Getting Started',
    icon: <Rocket size={20} />,
    items: [
      {
        q: 'What is Ticvite?',
        a: 'Ticvite is a free event ticketing and management platform. You can create events, sell tickets, manage check-ins, and view analytics — all with zero platform fees.',
      },
      {
        q: 'How do I create an account?',
        a: 'Click "Get Started" on the homepage or visit the registration page. You can sign up with your email address. Once registered, you can start creating events immediately.',
      },
      {
        q: 'Is Ticvite really free?',
        a: 'Yes! Ticvite charges zero platform fees. For paid events, standard payment processing fees from Stripe apply (typically 2.9% + $0.30 per transaction). For free events, there are no charges at all.',
      },
      {
        q: 'What types of events can I create?',
        a: 'You can create any type of event — concerts, festivals, conferences, workshops, community gatherings, fundraisers, sports events, religious events, and more. Both free and paid ticketing are supported.',
      },
      {
        q: 'Do I need technical skills to use Ticvite?',
        a: 'Not at all! Ticvite is designed to be intuitive and easy to use. Our step-by-step event creation wizard guides you through the entire process. If you can fill out a form, you can create an event.',
      },
    ],
  },
  {
    title: 'Creating Events',
    icon: <CalendarPlus size={20} />,
    items: [
      {
        q: 'How do I create an event?',
        a: 'Log in to your dashboard and click "Create Event." Fill in the event details — title, date, venue, description, and ticket types. You can save as a draft and publish when you are ready.',
      },
      {
        q: 'Can I add a poster or banner image?',
        a: 'Yes! You can upload a poster image for your event. This image appears on your event page, in search results, and when your event is shared on social media.',
      },
      {
        q: 'Can I create recurring events?',
        a: 'Yes. When creating an event, you can set up recurring dates. Each date gets its own ticket inventory and check-in list while sharing the same event details.',
      },
      {
        q: 'How do I set up ticket types?',
        a: 'In the event editor, you can create multiple ticket tiers (e.g., General Admission, VIP, Early Bird). Set the price, quantity, and description for each tier. You can also add promo codes for discounts.',
      },
      {
        q: 'Can I edit my event after publishing?',
        a: 'Absolutely. You can edit event details, update ticket types, add promo codes, and more at any time from your dashboard. Changes are reflected immediately on your event page.',
      },
    ],
  },
  {
    title: 'Tickets & Payments',
    icon: <CreditCard size={20} />,
    items: [
      {
        q: 'How do attendees receive their tickets?',
        a: 'Attendees receive an email confirmation with their ticket immediately after purchase. The ticket includes a unique QR code for check-in. They can also access their tickets from the "My Tickets" page.',
      },
      {
        q: 'What payment methods are supported?',
        a: 'Ticvite uses Stripe for payment processing, which supports all major credit and debit cards, Apple Pay, Google Pay, and other popular payment methods.',
      },
      {
        q: 'How do refunds work?',
        a: 'You can issue full or partial refunds from your event dashboard. Refunds are processed through Stripe and typically appear on the attendee\'s statement within 5-10 business days.',
      },
      {
        q: 'Can I offer promo codes or discounts?',
        a: 'Yes! You can create promo codes with percentage or fixed-amount discounts, set usage limits, and configure expiration dates. Great for early-bird pricing, group discounts, or VIP access.',
      },
      {
        q: 'When do I receive my payouts?',
        a: 'Payouts are handled through Stripe and are typically deposited to your bank account within 2-7 business days after the transaction. You can view your payout schedule in your Stripe dashboard.',
      },
    ],
  },
  {
    title: 'Check-In & Event Day',
    icon: <ScanLine size={20} />,
    items: [
      {
        q: 'How does check-in work?',
        a: 'Use the Ticvite check-in page on any device with a camera. Simply scan the QR code on each attendee\'s ticket. The system validates the ticket in real-time and prevents duplicate entries.',
      },
      {
        q: 'Can multiple people manage check-in?',
        a: 'Yes. You can add team members to your event who can access the check-in system. Each team member can scan tickets simultaneously from their own device.',
      },
      {
        q: 'What if an attendee lost their ticket?',
        a: 'You can look up attendees by name or email in the check-in dashboard and manually check them in. You can also resend the ticket email from the attendee list.',
      },
    ],
  },
  {
    title: 'Account & Settings',
    icon: <Settings size={20} />,
    items: [
      {
        q: 'How do I change my password?',
        a: 'Go to Settings in your dashboard. You can change your password, update your email, and manage your profile information from there. You can also use the "Forgot Password" link on the login page.',
      },
      {
        q: 'Can I have multiple organizers on one account?',
        a: 'Each organizer has their own account, but you can add team members to individual events. Team members can help manage tickets, check-in, and view analytics for that event.',
      },
      {
        q: 'How do I delete my account?',
        a: 'Contact our support team through the contact page, and we will assist you with account deletion. Please note that active events and ticket records may need to be resolved first.',
      },
    ],
  },
]

function Accordion({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start justify-between gap-4 py-4 text-left group"
      >
        <span className="font-medium text-text group-hover:text-primary transition-colors">
          {item.q}
        </span>
        <ChevronDown
          size={18}
          className={`flex-shrink-0 text-text-muted transition-transform duration-200 mt-0.5 ${
            open ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          open ? 'max-h-96 pb-4' : 'max-h-0'
        }`}
      >
        <p className="text-sm text-text-secondary leading-relaxed pr-8">
          {item.a}
        </p>
      </div>
    </div>
  )
}

export default function HelpPage() {
  return (
    <>
      <div className="min-h-screen bg-surface-muted">
        {/* Hero */}
        <section className="bg-gradient-to-br from-primary via-primary-dark to-accent pt-24 pb-14 px-4">
          <div className="mx-auto max-w-3xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mx-auto mb-5">
              <HelpCircle className="text-white" size={28} />
            </div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
              Help Center
            </h1>
            <p className="text-white/70 text-lg max-w-xl mx-auto">
              Find answers to common questions about Ticvite. Can&apos;t find what
              you&apos;re looking for? Contact us directly.
            </p>
          </div>
        </section>

        {/* FAQ Sections */}
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-12 space-y-8">
          {FAQ_SECTIONS.map((section) => (
            <div
              key={section.title}
              className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden"
            >
              <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-surface-muted">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                  {section.icon}
                </div>
                <h2 className="font-heading text-lg font-bold text-text">
                  {section.title}
                </h2>
              </div>
              <div className="px-6">
                {section.items.map((item) => (
                  <Accordion key={item.q} item={item} />
                ))}
              </div>
            </div>
          ))}

          {/* CTA */}
          <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="text-white" size={22} />
            </div>
            <h3 className="font-heading text-xl font-bold text-white mb-2">
              Still need help?
            </h3>
            <p className="text-white/80 text-sm mb-5 max-w-md mx-auto">
              Our support team is happy to help. Reach out and we&apos;ll get back to
              you as soon as possible.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-primary font-semibold text-sm hover:bg-white/90 transition shadow-lg"
            >
              <MessageSquare size={16} />
              Contact Support
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
