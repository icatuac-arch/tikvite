'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  DollarSign,
  Sparkles,
  Ticket,
  Shield,
  BarChart3,
  QrCode,
  UserPlus,
  Calendar,
  Share2,
  PartyPopper,
  ChevronDown,
  ArrowRight,
  CalendarPlus,
  Armchair,
  Tag,
  ShoppingCart,
  Lock,
  Users,
  UserCog,
  ClipboardCheck,
  LineChart,
  RotateCcw,
  Mail,
  FileDown,
  Music,
  Theater,
  Heart,
  Mic2,
  GraduationCap,
  School,
  Church,
  Tent,
  HandHeart,
  Cake,
  Trophy,
  Briefcase,
} from 'lucide-react';

/* ================================================================
   A — HERO
   ================================================================ */
function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-[#4F46E5]/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-[#7C3AED]/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-1.5 text-sm font-medium text-[#475569]">
            <Ticket className="h-4 w-4 text-[#4F46E5]" />
            100% Free Event Ticketing Platform
          </div>

          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-[#0F172A] sm:text-5xl lg:text-6xl">
            Create Events. Sell Tickets.{' '}
            <span className="gradient-text">Pay Zero Platform Fees.</span>
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-[#475569] sm:text-xl">
            Everything you need to organize events, manage tickets, accept
            payments, and welcome attendees — without complicated software or
            platform charges.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#4F46E5]/25 transition-all duration-200 hover:bg-[#4338CA] hover:shadow-xl hover:shadow-[#4F46E5]/30 active:scale-[0.98]"
            >
              Create Your Free Event
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-xl border-2 border-[#E2E8F0] bg-white px-8 py-3.5 text-base font-semibold text-[#475569] transition-all duration-200 hover:border-[#4F46E5] hover:text-[#4F46E5]"
            >
              See How It Works
            </a>
          </div>
        </div>

        {/* Dashboard mockup */}
        <div className="mx-auto mt-16 max-w-4xl">
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-1.5 shadow-2xl shadow-black/5">
            <div className="rounded-xl bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] p-6 sm:p-8">
              {/* Fake browser bar */}
              <div className="mb-5 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-white/20" />
                <div className="h-3 w-3 rounded-full bg-white/20" />
                <div className="h-3 w-3 rounded-full bg-white/20" />
                <div className="ml-3 h-6 w-48 rounded-full bg-white/10" />
              </div>
              {/* Fake dashboard content */}
              <div className="grid grid-cols-3 gap-3 sm:gap-4">
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="h-3 w-16 rounded bg-white/30" />
                  <div className="mt-3 font-heading text-2xl font-bold text-white">1,284</div>
                  <div className="mt-1 h-2 w-20 rounded bg-white/20" />
                </div>
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="h-3 w-12 rounded bg-white/30" />
                  <div className="mt-3 font-heading text-2xl font-bold text-white">$9,420</div>
                  <div className="mt-1 h-2 w-24 rounded bg-white/20" />
                </div>
                <div className="rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                  <div className="h-3 w-14 rounded bg-white/30" />
                  <div className="mt-3 font-heading text-2xl font-bold text-white">96%</div>
                  <div className="mt-1 h-2 w-16 rounded bg-white/20" />
                </div>
              </div>
              {/* Fake chart area */}
              <div className="mt-4 rounded-lg bg-white/10 p-4 backdrop-blur-sm">
                <div className="flex items-end gap-2 h-24">
                  {[40, 65, 45, 80, 55, 90, 70, 95, 60, 85, 75, 100].map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-white/30 transition-all"
                      style={{ height: `${h}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   B — TRUST / VALUE CARDS
   ================================================================ */
const trustCards = [
  {
    icon: DollarSign,
    title: '$0 Platform Fees',
    desc: 'No subscription charges, no per-ticket fees, no hidden costs. Ticvite is completely free to use.',
  },
  {
    icon: Sparkles,
    title: 'Easy Event Setup',
    desc: 'A guided, step-by-step process takes you from concept to a polished, published event page in minutes.',
  },
  {
    icon: Ticket,
    title: 'Flexible Ticketing',
    desc: 'Free, paid, early-bird, VIP, group rates, and reserved seating — configure tickets your way.',
  },
  {
    icon: Shield,
    title: 'Secure Payments',
    desc: 'Stripe-powered checkout keeps attendee payment information safe and PCI-compliant.',
  },
  {
    icon: BarChart3,
    title: 'Real-Time Management',
    desc: 'Track registrations, ticket sales, attendance, and revenue with a live dashboard.',
  },
  {
    icon: QrCode,
    title: 'Easy Check-In',
    desc: 'Scan QR codes at the door for fast, contactless attendee check-in on any device.',
  },
];

function TrustSection() {
  return (
    <section className="bg-[#F8FAFC] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            Why Event Organizers Choose Ticvite
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            Everything you need to run a successful event, from creation to closeout.
          </p>
        </div>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {trustCards.map((card) => (
            <div
              key={card.title}
              className="group rounded-2xl border border-[#E2E8F0] bg-white p-7 transition-all duration-200 hover:border-[#4F46E5]/30 hover:shadow-lg hover:shadow-[#4F46E5]/5"
            >
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] transition-colors group-hover:bg-[#4F46E5] group-hover:text-white">
                <card.icon className="h-6 w-6" />
              </div>
              <h3 className="font-heading text-lg font-bold text-[#0F172A]">{card.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   C — HOW IT WORKS
   ================================================================ */
const steps = [
  {
    icon: UserPlus,
    title: 'Create Your Free Account',
    desc: 'Sign up in seconds with just your email. No credit card required.',
  },
  {
    icon: Calendar,
    title: 'Create Your Event',
    desc: 'Add event details, upload images, and customize your event page.',
  },
  {
    icon: Ticket,
    title: 'Configure Your Tickets',
    desc: 'Set up free or paid tickets, early-bird pricing, VIP tiers, and more.',
  },
  {
    icon: Share2,
    title: 'Publish & Share',
    desc: 'Go live instantly and share your event link across social media and email.',
  },
  {
    icon: PartyPopper,
    title: 'Manage & Celebrate',
    desc: 'Track sales, check in attendees with QR codes, and enjoy your event.',
  },
];

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            How It Works
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            From sign-up to sold-out in five simple steps.
          </p>
        </div>

        <div className="relative mx-auto mt-16 max-w-3xl">
          {/* Vertical connector line */}
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-[#4F46E5] via-[#7C3AED] to-[#4F46E5]/20 sm:block" />

          <div className="space-y-10">
            {steps.map((step, i) => (
              <div key={step.title} className="relative flex gap-6">
                {/* Step number circle */}
                <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-white shadow-lg shadow-[#4F46E5]/20">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="pt-1.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#EEF2FF] text-xs font-bold text-[#4F46E5]">
                      {i + 1}
                    </span>
                    <h3 className="font-heading text-lg font-bold text-[#0F172A]">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mt-1.5 text-[#475569]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-14 text-center">
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-xl bg-[#4F46E5] px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-[#4F46E5]/25 transition-all duration-200 hover:bg-[#4338CA] hover:shadow-xl active:scale-[0.98]"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   D — FEATURE OVERVIEW (14 cards)
   ================================================================ */
const features = [
  {
    icon: CalendarPlus,
    title: 'Event Creation',
    desc: 'Build beautiful event pages with all the details attendees need.',
  },
  {
    icon: Armchair,
    title: 'GA & Reserved Seating',
    desc: 'Offer general admission or assign specific seats and sections.',
  },
  {
    icon: Ticket,
    title: 'Free & Paid Tickets',
    desc: 'Create unlimited free registrations or paid ticket types.',
  },
  {
    icon: Tag,
    title: 'Early Bird Discounts',
    desc: 'Reward early buyers with time-limited promotional pricing.',
  },
  {
    icon: ShoppingCart,
    title: 'Online Ticket Sales',
    desc: 'Sell tickets 24/7 through your shareable event page.',
  },
  {
    icon: Lock,
    title: 'Secure Checkout',
    desc: 'PCI-compliant Stripe integration for safe payment processing.',
  },
  {
    icon: QrCode,
    title: 'QR Code Ticketing',
    desc: 'Every ticket includes a unique QR code for instant validation.',
  },
  {
    icon: Users,
    title: 'Attendee Management',
    desc: 'View, search, and manage your full attendee list in one place.',
  },
  {
    icon: UserCog,
    title: 'Team & Staff Access',
    desc: 'Invite team members with role-based permissions for your event.',
  },
  {
    icon: ClipboardCheck,
    title: 'Event Check-In',
    desc: 'Scan QR codes on any device for fast, reliable door management.',
  },
  {
    icon: LineChart,
    title: 'Real-Time Reports',
    desc: 'Live dashboards for sales, revenue, attendance, and trends.',
  },
  {
    icon: RotateCcw,
    title: 'Refunds & Cancellations',
    desc: 'Process full or partial refunds directly from your dashboard.',
  },
  {
    icon: Mail,
    title: 'Event Communications',
    desc: 'Send updates, reminders, and announcements to your attendees.',
  },
  {
    icon: FileDown,
    title: 'Event Closeout & Export',
    desc: 'Export attendee data, financial reports, and post-event summaries.',
  },
];

function FeatureOverview() {
  return (
    <section id="features" className="bg-[#F8FAFC] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            Everything You Need to Run Events
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            A complete toolkit for event creation, ticketing, management, and analytics.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-[#E2E8F0] bg-white p-6 transition-all duration-200 hover:border-[#4F46E5]/30 hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5] transition-colors group-hover:bg-[#4F46E5] group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-heading text-base font-bold text-[#0F172A]">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   E — PRICING
   ================================================================ */
function Pricing() {
  const rows = [
    { label: 'Ticvite platform', value: '$0' },
    { label: 'Event creation', value: '$0' },
    { label: 'Per-ticket fee', value: '$0' },
    { label: 'Free event registration', value: '$0' },
    { label: 'Payment processing', value: 'Charged by Stripe where applicable' },
  ];

  return (
    <section id="pricing" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            Powerful Event Ticketing.{' '}
            <span className="gradient-text">Zero Ticvite Platform Fees.</span>
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            No tiers. No upgrades. Every feature, every time, completely free.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-lg">
          <div className="overflow-hidden rounded-2xl border-2 border-[#4F46E5] bg-white shadow-xl shadow-[#4F46E5]/10">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-8 py-6 text-center text-white">
              <p className="text-sm font-medium uppercase tracking-wider text-white/80">
                All-Inclusive
              </p>
              <div className="mt-2 flex items-baseline justify-center gap-1">
                <span className="font-heading text-5xl font-extrabold">$0</span>
                <span className="text-lg text-white/80">/ forever</span>
              </div>
            </div>

            {/* Pricing rows */}
            <div className="divide-y divide-[#E2E8F0] px-8 py-2">
              {rows.map((row) => (
                <div key={row.label} className="flex items-center justify-between py-4">
                  <span className="text-sm font-medium text-[#0F172A]">{row.label}</span>
                  <span className="text-sm font-semibold text-[#4F46E5]">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Note */}
            <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] px-8 py-4">
              <p className="text-center text-xs leading-relaxed text-[#94A3B8]">
                Ticvite is completely free. Payment processor fees (e.g., Stripe
                2.9% + $0.30) apply only to paid tickets and are charged
                directly by Stripe, not by Ticvite.
              </p>
            </div>

            {/* CTA */}
            <div className="px-8 pb-8 pt-4">
              <Link
                href="/register"
                className="block w-full rounded-xl bg-[#4F46E5] py-3.5 text-center text-base font-semibold text-white shadow-lg shadow-[#4F46E5]/25 transition-all duration-200 hover:bg-[#4338CA] hover:shadow-xl active:scale-[0.98]"
              >
                Start for Free
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   F — WHO CAN USE TICVITE
   ================================================================ */
const useCases = [
  { icon: Music, label: 'Concerts' },
  { icon: Theater, label: 'Theater' },
  { icon: Heart, label: 'Nonprofits' },
  { icon: Mic2, label: 'Conferences' },
  { icon: GraduationCap, label: 'Workshops' },
  { icon: School, label: 'Schools' },
  { icon: Church, label: 'Religious Events' },
  { icon: Tent, label: 'Festivals' },
  { icon: HandHeart, label: 'Fundraisers' },
  { icon: Cake, label: 'Private Celebrations' },
  { icon: Trophy, label: 'Sports' },
  { icon: Briefcase, label: 'Business Events' },
];

function WhoCanUse() {
  return (
    <section className="bg-[#F8FAFC] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            Built for Every Kind of Event
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            Whether you are hosting 20 people or 20,000, Ticvite scales with you.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {useCases.map((uc) => (
            <div
              key={uc.label}
              className="group flex flex-col items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white p-6 text-center transition-all duration-200 hover:border-[#4F46E5]/30 hover:shadow-md"
            >
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5] transition-colors group-hover:bg-[#4F46E5] group-hover:text-white">
                <uc.icon className="h-6 w-6" />
              </div>
              <span className="font-heading text-sm font-bold text-[#0F172A]">{uc.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   G — FAQ
   ================================================================ */
const faqs = [
  {
    q: 'Is Ticvite really free?',
    a: 'Yes. Ticvite charges zero platform fees, zero subscription fees, and zero per-ticket fees. The only costs you may encounter are payment processing fees charged directly by Stripe (2.9% + $0.30 per transaction) when you sell paid tickets.',
  },
  {
    q: 'How does Ticvite make money if the platform is free?',
    a: 'Ticvite is focused on growing its user base and building the best free ticketing platform available. We may introduce optional premium add-ons in the future, but the core ticketing features will always remain free.',
  },
  {
    q: 'What types of events can I create?',
    a: 'Any type of event — concerts, conferences, workshops, fundraisers, school events, religious gatherings, private parties, sports tournaments, business seminars, and more. If it has attendees, Ticvite can handle it.',
  },
  {
    q: 'Can I sell paid tickets?',
    a: 'Absolutely. Connect your Stripe account and sell tickets at any price. Ticvite takes zero commission — only Stripe\'s standard processing fees apply.',
  },
  {
    q: 'What payment methods are supported?',
    a: 'Through Stripe, attendees can pay with all major credit and debit cards, Apple Pay, Google Pay, and other methods supported in your region.',
  },
  {
    q: 'How do attendees receive their tickets?',
    a: 'After purchasing or registering, attendees receive a confirmation email with a PDF ticket containing a unique QR code. They can also access their tickets from their Ticvite account.',
  },
  {
    q: 'How does QR code check-in work?',
    a: 'At your event, use any smartphone or tablet to scan attendee QR codes through the Ticvite check-in interface. The system validates the ticket instantly and marks it as used to prevent duplicates.',
  },
  {
    q: 'Can I create free events?',
    a: 'Yes. Free events require no Stripe connection and have no fees whatsoever. Attendees simply register and receive their tickets.',
  },
  {
    q: 'Is there a limit on the number of tickets I can sell?',
    a: 'No. You can create as many ticket types and sell as many tickets as you need. There are no artificial limits on Ticvite.',
  },
  {
    q: 'Can I offer early-bird pricing or discount codes?',
    a: 'Yes. You can set up early-bird pricing windows that automatically adjust ticket prices based on dates you configure.',
  },
  {
    q: 'Can I issue refunds?',
    a: 'Yes. You can process full or partial refunds directly from your Ticvite dashboard. Refunds are processed through Stripe back to the attendee\'s original payment method.',
  },
  {
    q: 'Can I add team members to help manage my event?',
    a: 'Yes. Invite team members and assign roles so they can help with check-in, attendee management, and event coordination.',
  },
  {
    q: 'What kind of reports and analytics are available?',
    a: 'Your dashboard shows real-time data on ticket sales, revenue, registration trends, check-in rates, and attendee demographics. You can also export reports for your records.',
  },
  {
    q: 'Can I customize my event page?',
    a: 'Yes. Add your event description, images, schedule, venue details, and more. Your event gets a clean, professional page that is easy for attendees to find and use.',
  },
  {
    q: 'How do I get started?',
    a: 'Just create a free account, set up your event, configure your tickets, and publish. The entire process takes just a few minutes.',
  },
];

function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-[#0F172A] sm:text-4xl">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-[#475569]">
            Everything you need to know about Ticvite.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-3xl divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white">
          {faqs.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <div key={i}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-[#F8FAFC]"
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-sm font-semibold text-[#0F172A] sm:text-base">
                    {faq.q}
                  </span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[#94A3B8] transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                  }`}
                >
                  <p className="px-6 pb-5 text-sm leading-relaxed text-[#475569]">{faq.a}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   H — FINAL CTA
   ================================================================ */
function FinalCTA() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" />
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIxLjUiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4xKSIvPjwvc3ZnPg==')] opacity-50" />

      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-bold text-white sm:text-4xl lg:text-5xl">
            Ready to Create Your Event?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/80">
            Join organizers who trust Ticvite for simple, free event ticketing.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-8 py-4 text-base font-bold text-[#4F46E5] shadow-xl transition-all duration-200 hover:bg-[#F8FAFC] hover:shadow-2xl active:scale-[0.98]"
            >
              Create Your Free Event
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <p className="mt-5 text-sm text-white/60">
            No credit card required. Set up in under 5 minutes.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ================================================================
   PAGE
   ================================================================ */
export default function Home() {
  return (
    <>
      <Hero />
      <TrustSection />
      <HowItWorks />
      <FeatureOverview />
      <Pricing />
      <WhoCanUse />
      <FAQ />
      <FinalCTA />
    </>
  );
}
