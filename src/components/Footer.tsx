import Link from "next/link";
import { Ticket } from "lucide-react";

const productLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Explore Events", href: "/explore" },
];

const supportLinks = [
  { label: "Help Center", href: "/help" },
  { label: "Contact", href: "/contact" },
  { label: "FAQ", href: "#faq" },
];

const legalLinks = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "About", href: "/about" },
];

export default function Footer() {
  return (
    <footer className="bg-[#0F172A] text-white">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Column 1 — Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2 group">
              <Ticket
                className="h-7 w-7 text-indigo-400 transition-transform duration-200 group-hover:rotate-[-8deg]"
                strokeWidth={2.2}
              />
              <span className="font-heading text-xl font-bold tracking-tight text-white">
                Ticvite
              </span>
            </Link>
            <p className="mt-3 text-sm font-medium text-indigo-300">
              Your Event. Your Tickets. Zero Platform Fees.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              The free ticketing platform that lets you create beautiful event
              pages, sell tickets, and manage check-ins — without paying a
              single platform fee.
            </p>
          </div>

          {/* Column 2 — Product */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Product
            </h3>
            <ul className="mt-4 space-y-2.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — Support */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Support
            </h3>
            <ul className="mt-4 space-y-2.5">
              {supportLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — Legal */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
              Legal
            </h3>
            <ul className="mt-4 space-y-2.5">
              {legalLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-slate-300 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-slate-800 pt-6">
          <p className="text-center text-xs text-slate-500">
            &copy; 2026 Ticvite. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
