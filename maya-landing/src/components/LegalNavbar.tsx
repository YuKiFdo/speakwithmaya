"use client";

import Link from "next/link";
import { useState } from "react";

export function LegalNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-[#E2E8F0]/80">
      <div className="max-w-[1120px] mx-auto px-5 sm:px-10">
        <div className="flex items-center justify-between h-[68px] md:h-20">
          {/* Brand Logo */}
          <Link href="/" className="flex flex-col leading-none select-none group">
            <div className="text-[22px] md:text-[23px] tracking-[-0.03em] text-[#0F172A]">
              <span className="font-extrabold">Speak</span>
              <span className="font-normal text-[#1E293B]">with</span>
              <span className="font-extrabold text-[#0D4EFD] group-hover:text-[#0B42D8] transition-colors">
                Maya
              </span>
            </div>
            <span className="text-[9px] md:text-[9.5px] text-[#94A3B8] font-medium tracking-[0.01em] mt-0.5">
              Your AI English Speaking Coach
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-[13.5px] font-medium text-[#475569]">
            <Link href="/" className="hover:text-[#0D4EFD] transition-colors">
              Home
            </Link>
            <Link href="/#features" className="hover:text-[#0D4EFD] transition-colors">
              Features
            </Link>
            <Link href="/#how-it-works" className="hover:text-[#0D4EFD] transition-colors">
              How It Works
            </Link>
            <Link href="/#pricing" className="hover:text-[#0D4EFD] transition-colors">
              Pricing
            </Link>
            <Link href="/#faq" className="hover:text-[#0D4EFD] transition-colors">
              FAQ
            </Link>
          </nav>

          {/* Right Action */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#0D4EFD] bg-[#EDF3FE] hover:bg-[#E0ECFF] px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5"
              >
                <path d="M13 8H3M7 4L3 8l4 4" />
              </svg>
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#EDF4FF] text-[#0D4EFD] hover:bg-[#E0ECFF] transition-colors"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              className="w-5 h-5"
            >
              {mobileMenuOpen ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#F1F5F9] py-4 space-y-3">
            <nav className="flex flex-col space-y-2.5 text-[14px] font-medium text-[#475569]">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#0F172A] font-semibold py-1"
              >
                Home
              </Link>
              <Link
                href="/#features"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#0D4EFD] py-1"
              >
                Features
              </Link>
              <Link
                href="/#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#0D4EFD] py-1"
              >
                How It Works
              </Link>
              <Link
                href="/#pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#0D4EFD] py-1"
              >
                Pricing
              </Link>
              <Link
                href="/#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#0D4EFD] py-1"
              >
                FAQ
              </Link>
            </nav>
            <div className="pt-2">
              <Link
                href="/"
                className="block text-center bg-[#0D4EFD] text-white text-[13px] font-semibold py-2.5 rounded-lg"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
