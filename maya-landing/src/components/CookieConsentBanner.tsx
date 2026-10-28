"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pushLandingDataLayerEvent } from "@/utils/analytics";

const COOKIE_CONSENT_STORAGE_KEY = "maya_cookie_consent_v1";
const COOKIE_CONSENT_COOKIE_NAME = "maya_cookie_consent";

type ConsentChoice = "accepted" | "essential_only";

function setConsentCookie(value: ConsentChoice) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 180; // 180 days
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${COOKIE_CONSENT_COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(
        COOKIE_CONSENT_STORAGE_KEY
      ) as ConsentChoice | null;
      if (!saved) {
        const timer = window.setTimeout(() => {
          setVisible(true);
        }, 350);
        return () => window.clearTimeout(timer);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const handleChoice = (choice: ConsentChoice) => {
    setClosing(true);
    try {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice);
    } catch {
      // ignore storage errors
    }
    setConsentCookie(choice);

    pushLandingDataLayerEvent("cookie_consent_update", {
      consent_status: choice,
      analytics_storage: choice === "accepted" ? "granted" : "denied",
      ad_storage: choice === "accepted" ? "granted" : "denied",
      ad_user_data: choice === "accepted" ? "granted" : "denied",
      ad_personalization: choice === "accepted" ? "granted" : "denied",
    });

    window.setTimeout(() => {
      setVisible(false);
    }, 240);
  };

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie consent"
      className={`fixed bottom-4 left-4 right-4 sm:left-6 sm:right-6 z-[60] flex justify-center pointer-events-none transition-all duration-250 ease-out ${
        closing
          ? "opacity-0 translate-y-3"
          : "opacity-100 translate-y-0"
      }`}
    >
      <div className="pointer-events-auto w-full max-w-[920px] rounded-2xl bg-white/95 backdrop-blur-xl border border-[#DCE6F7] shadow-[0_18px_48px_rgba(15,23,42,0.14)] p-4 sm:p-5 md:px-6 md:py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Icon & Copy */}
        <div className="flex items-start gap-3.5 flex-1">
          <div className="hidden sm:flex w-10 h-10 rounded-xl bg-[#EDF4FF] border border-[#DCE8FF] text-[#0D4EFD] items-center justify-center shrink-0 mt-0.5">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
              <path d="M8.5 8.5v.01" />
              <path d="M16 15.5v.01" />
              <path d="M12 12v.01" />
              <path d="M11 17v.01" />
              <path d="M7 14v.01" />
            </svg>
          </div>
          <div className="text-[12.5px] sm:text-[13px] text-[#475569] leading-relaxed">
            <p className="font-bold text-[#0F172A] text-[13.5px] sm:text-[14px] mb-0.5">
              We value your privacy
            </p>
            <p>
              We use cookies and similar technologies to keep SpeakwithMaya
              secure, remember your preferences, and measure site performance in
              accordance with our{" "}
              <Link
                href="/privacy"
                className="font-semibold text-[#0D4EFD] hover:underline underline-offset-2"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 w-full md:w-auto shrink-0">
          <button
            type="button"
            onClick={() => handleChoice("essential_only")}
            className="flex-1 md:flex-initial px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[#475569] hover:text-[#0F172A] text-[12.5px] font-semibold transition-colors cursor-pointer"
          >
            Essential Only
          </button>
          <button
            type="button"
            onClick={() => handleChoice("accepted")}
            className="flex-1 md:flex-initial px-5 py-2.5 rounded-xl bg-[#0D4EFD] hover:bg-[#0B42D8] text-white text-[12.5px] font-bold shadow-[0_6px_16px_rgba(13,78,253,0.26)] transition-all cursor-pointer"
          >
            Accept All
          </button>
        </div>
      </div>
    </div>
  );
}
