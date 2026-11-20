"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Ticket } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Pricing", href: "#pricing" },
  { label: "Explore Events", href: "/explore" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-white transition-shadow duration-200 ${
        scrolled ? "shadow-sm border-b border-border" : ""
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Ticket
            className="h-7 w-7 text-primary transition-transform duration-200 group-hover:rotate-[-8deg]"
            strokeWidth={2.2}
          />
          <span className="font-heading text-xl font-bold tracking-tight text-primary">
            Ticvite
          </span>
        </Link>

        {/* Desktop nav links */}
        <ul className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="px-3 py-2 text-sm font-medium text-text-secondary rounded-lg transition-colors hover:text-primary hover:bg-primary-50/60"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Desktop right side */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-text-secondary rounded-lg transition-colors hover:text-primary hover:bg-primary-50/60"
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-primary rounded-lg shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md active:scale-[0.98]"
          >
            Create Your Free Event
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-muted hover:text-primary"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </nav>

      {/* Mobile menu panel */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          mobileOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-border bg-white px-4 pb-5 pt-3 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary-50/60 hover:text-primary"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}

          <div className="my-3 border-t border-border-light" />

          <Link
            href="/login"
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-primary-50/60 hover:text-primary"
            onClick={() => setMobileOpen(false)}
          >
            Log In
          </Link>
          <Link
            href="/register"
            className="mt-2 block w-full rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-primary-dark hover:shadow-md active:scale-[0.98]"
            onClick={() => setMobileOpen(false)}
          >
            Create Your Free Event
          </Link>
        </div>
      </div>
    </header>
  );
}
