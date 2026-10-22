"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface LegalFooterProps {
  active?: "terms" | "privacy" | "refund" | "none";
}

export function LegalFooter({ active }: LegalFooterProps) {
  const pathname = usePathname();

  // Determine active item from prop first (100% deterministic on SSR), fallback to pathname
  let currentActive = active;
  if (!currentActive) {
    if (pathname?.includes("/terms")) currentActive = "terms";
    else if (pathname?.includes("/privacy")) currentActive = "privacy";
    else if (pathname?.includes("/refund")) currentActive = "refund";
    else currentActive = "none";
  }

  const isTerms = currentActive === "terms";
  const isPrivacy = currentActive === "privacy";
  const isRefund = currentActive === "refund";

  return (
    <footer className="bg-[#EDF3FE] pt-14 pb-10 text-[#475569] border-t border-[#DCE6F7]">
      <div className="max-w-[1040px] mx-auto px-6 sm:px-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-10 pb-12 border-b border-[#DCE6F7]">
          {/* Brand Column */}
          <div className="md:col-span-5">
            <Link
              href="/"
              className="inline-block text-[22px] tracking-[-0.03em] text-[#0F172A] mb-2.5"
            >
              <span className="font-extrabold">Speak</span>
              <span className="font-normal text-[#1E293B]">with</span>
              <span className="font-extrabold text-[#0D4EFD]">Maya</span>
            </Link>
            <p className="text-[12.5px] text-[#64748B] leading-relaxed max-w-[280px] mb-4">
              Your personal AI partner for building English speaking confidence
              through natural voice conversations.
            </p>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 border border-[#DCE6F7] text-[11px] text-[#475569]">
              <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
              <span>Payments Secured via <strong>PayHere</strong></span>
            </div>
          </div>

          {/* Explore Column */}
          <div className="md:col-span-2">
            <h4 className="text-[12px] font-bold text-[#0F172A] mb-3.5">
              Explore
            </h4>
            <ul className="space-y-2.5 text-[12px] text-[#64748B]">
              <li>
                <Link href="/" className="hover:text-[#0D4EFD] transition-colors">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/#features" className="hover:text-[#0D4EFD] transition-colors">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/#how-it-works" className="hover:text-[#0D4EFD] transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="hover:text-[#0D4EFD] transition-colors">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/#faq" className="hover:text-[#0D4EFD] transition-colors">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Us Column */}
          <div className="md:col-span-3">
            <h4 className="text-[12px] font-bold text-[#0F172A] mb-3.5">
              Contact & Support
            </h4>
            <ul className="space-y-2.5 text-[12px] text-[#64748B]">
              <li>
                <a
                  href="mailto:support@speakwithmaya.com"
                  className="hover:text-[#0D4EFD] transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 text-[#0D4EFD]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span>support@speakwithmaya.com</span>
                </a>
              </li>
              <li className="text-[11.5px] text-[#64748B] pt-1">
                Colombo, Sri Lanka
              </li>
            </ul>

            <div className="mt-4 pt-3 border-t border-[#DCE6F7]/60">
              <span className="text-[10.5px] text-[#64748B] block mb-1 font-semibold uppercase tracking-wider">
                Payment Partners
              </span>
              <p className="text-[11px] text-[#64748B]">
                Visa · Mastercard · Amex · eZ Cash · Genie · Frimi
              </p>
            </div>
          </div>

          {/* Legal Column */}
          <div className="md:col-span-2">
            <h4 className="text-[12px] font-bold text-[#0F172A] mb-3.5">
              Legal & Policies
            </h4>
            <ul className="space-y-2.5 text-[12.5px]">
              <li>
                <Link
                  href="/terms"
                  className={`inline-block transition-colors ${
                    isTerms
                      ? "text-[#0D4EFD] font-bold"
                      : "text-[#64748B] hover:text-[#0D4EFD]"
                  }`}
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className={`inline-block transition-colors ${
                    isPrivacy
                      ? "text-[#0D4EFD] font-bold"
                      : "text-[#64748B] hover:text-[#0D4EFD]"
                  }`}
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  href="/refund"
                  className={`inline-block transition-colors ${
                    isRefund
                      ? "text-[#0D4EFD] font-bold"
                      : "text-[#64748B] hover:text-[#0D4EFD]"
                  }`}
                >
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright Row */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#94A3B8]">
          <p>© 2026 SpeakwithMaya. All rights reserved.</p>
          <div className="flex items-center gap-3">
            <span className="uppercase tracking-[0.04em] font-medium text-[#64748B]">
              IDEACIPHER (PVT) LTD
            </span>
            <span>·</span>
            <span>Sri Lanka</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
