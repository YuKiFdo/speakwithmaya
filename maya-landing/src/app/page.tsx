"use client";

import Image from "next/image";
import { type ReactNode, useEffect, useRef, useState } from "react";

const APP_BASE_URL = "https://app.speakwithmaya.com";
const SIGN_IN_URL = `${APP_BASE_URL}/onboarding/phone?mode=login`;
const SIGN_UP_URL = `${APP_BASE_URL}/`;

const FLUENCY_QUOTES = [
  {
    id: "quote-1",
    words: [
      "I've",
      "studied",
      "English",
      "for",
      "years,",
      "but",
      "I",
      "still",
      "struggle",
      "to",
      "speak.",
    ],
    boldPrefixCount: 2,
    blueHighlightIndices: [8, 9, 10], // "struggle to speak."
    desktopQuotes: false,
    xpLabel: "+10 XP · Fluency",
  },
  {
    id: "quote-2",
    words: ["I'm", "afraid", "of", "making", "mistakes", "when", "I", "speak."],
    boldPrefixCount: 0,
    blueHighlightIndices: [3, 4], // "making mistakes"
    desktopQuotes: true,
    xpLabel: "+10 XP · Confidence",
  },
  {
    id: "quote-3",
    words: [
      "I",
      "don't",
      "have",
      "anyone",
      "to",
      "practise",
      "speaking",
      "with.",
    ],
    boldPrefixCount: 0,
    blueHighlightIndices: [5, 6, 7], // "practise speaking with."
    desktopQuotes: true,
    xpLabel: "+10 XP · Partner",
  },
];

const TOTAL_QUOTE_WORDS = FLUENCY_QUOTES.reduce(
  (sum, q) => sum + q.words.length,
  0
);

const QUOTES_WITH_OFFSETS = FLUENCY_QUOTES.map((q, idx) => ({
  ...q,
  startOffset: FLUENCY_QUOTES.slice(0, idx).reduce(
    (sum, prev) => sum + prev.words.length,
    0
  ),
}));

function useInView(options?: {
  threshold?: number;
  rootMargin?: string;
  triggerOnce?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const triggerOnce = options?.triggerOnce ?? true;

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (triggerOnce) {
            observer.unobserve(node);
          }
        } else if (!triggerOnce) {
          setInView(false);
        }
      },
      {
        threshold: options?.threshold ?? 0.14,
        rootMargin: options?.rootMargin ?? "0px 0px -40px 0px",
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [options?.threshold, options?.rootMargin, triggerOnce]);

  return { ref, inView };
}

function Reveal({
  children,
  delay = 0,
  duration = 950,
  y = 22,
  x = 0,
  scale = 1,
  className = "",
  threshold = 0.14,
}: {
  children: ReactNode;
  delay?: number;
  duration?: number;
  y?: number;
  x?: number;
  scale?: number;
  className?: string;
  threshold?: number;
}) {
  const { ref, inView } = useInView({ threshold });

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView
          ? "translate3d(0, 0, 0) scale(1)"
          : `translate3d(${x}px, ${y}px, 0) scale(${scale})`,
        transitionProperty: "opacity, transform",
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        transitionDelay: `${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

const FAQ_ITEMS = [
  {
    question: "What is SpeakwithMaya?",
    answer:
      "SpeakwithMaya is an AI-powered English-speaking coach that helps you improve your speaking skills through real-time conversations, roleplays, and personalized feedback.",
  },
  {
    question: "Who is SpeakwithMaya for?",
    answer:
      "SpeakwithMaya is for anyone who wants to improve their spoken English, build confidence, and speak more naturally, even if they already know English grammar but struggle to speak.",
  },
  {
    question: "What is the difference between Basic, Pro, and Premium?",
    answer:
      "Basic is ideal for getting started. Pro offers more practice time and additional speaking feedback. Premium provides the most practice time and advanced learning features.",
  },
  {
    question: "How many minutes can I practice?",
    answer:
      "Your available AI conversation minutes depend on your selected plan. Check the pricing table to see the included minutes and session durations for each plan.",
  },
  {
    question: "What happens when I use all my daily practice time?",
    answer:
      "Once you use your included daily practice time, you may be able to continue practicing using your remaining monthly AI minutes, depending on your plan's limits.",
  },
  {
    question: "Can Maya correct my English mistakes?",
    answer:
      "Yes! Maya can help you identify grammar mistakes, improve pronunciation, and find more natural ways to express yourself. Available feedback features depend on your plan.",
  },
  {
    question: "Can I cancel my subscription?",
    answer:
      "You can manage or cancel your subscription through the subscription or billing options available for your account.",
  },
  {
    question: "What happens when my subscription expires?",
    answer:
      "When your subscription expires, you may lose access to paid-plan features. You can renew your subscription or choose another available plan to continue enjoying premium features.",
  },
];

function StarIcon({ className = "w-3.5 h-3.5 text-[#F97316]" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

const CTA_PARTICLES = [
  { left: "10%", size: 3, dur: "2.6s", delay: "0s", drift: "5px" },
  { left: "22%", size: 2.5, dur: "3.1s", delay: "0.6s", drift: "-4px" },
  { left: "36%", size: 3.5, dur: "2.8s", delay: "1.2s", drift: "6px" },
  { left: "50%", size: 2.5, dur: "3.3s", delay: "0.3s", drift: "-5px" },
  { left: "64%", size: 3, dur: "2.7s", delay: "0.9s", drift: "4px" },
  { left: "78%", size: 3.5, dur: "3.0s", delay: "1.5s", drift: "-6px" },
  { left: "90%", size: 2.5, dur: "2.5s", delay: "0.4s", drift: "4px" },
];

function CtaParticles() {
  return (
    <span className="cta-particles" aria-hidden="true">
      {CTA_PARTICLES.map((p, i) => (
        <span
          key={i}
          className="cta-particle"
          style={
            {
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--dur": p.dur,
              "--delay": p.delay,
              "--drift-x": p.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

function ArrowRightIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.333 8h9.334M8.667 4l4 4-4 4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <span className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full bg-[#EBF2FF] text-[#0D4EFD] shrink-0">
      <svg
        viewBox="0 0 12 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="w-2.5 h-2.5"
      >
        <path d="M2.5 6.2L4.8 8.5L9.5 3.5" />
      </svg>
    </span>
  );
}

function QuotesCardsContainer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [smoothWordPos, setSmoothWordPos] = useState(0);

  // 60fps spring-interpolated scroll tracker: glides smoothly forward & backward without choppy timer ticks
  useEffect(() => {
    let rafId: number | null = null;
    let targetPos = 0;
    let currentPos = 0;
    let isAnimating = false;

    const computeTarget = () => {
      const el = containerRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;

      const startY = vh * 0.86;
      const endY = vh * 0.24;

      const progress = Math.max(
        0,
        Math.min(1, (startY - rect.top) / (startY - endY))
      );
      targetPos = progress * TOTAL_QUOTE_WORDS;
      startTicking();
    };

    const tick = () => {
      const diff = targetPos - currentPos;
      if (Math.abs(diff) > 0.02) {
        // Smooth exponential easing toward target scroll position
        currentPos += diff * 0.14;
        setSmoothWordPos(currentPos);
        rafId = window.requestAnimationFrame(tick);
      } else {
        currentPos = targetPos;
        setSmoothWordPos(targetPos);
        isAnimating = false;
        rafId = null;
      }
    };

    const startTicking = () => {
      if (!isAnimating) {
        isAnimating = true;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    computeTarget();
    window.addEventListener("scroll", computeTarget, { passive: true });
    window.addEventListener("resize", computeTarget, { passive: true });

    return () => {
      window.removeEventListener("scroll", computeTarget);
      window.removeEventListener("resize", computeTarget);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="max-w-[540px] mx-auto space-y-3 sm:space-y-3.5 mb-7 sm:mb-9 text-left"
    >
      {QUOTES_WITH_OFFSETS.map((card, cardIdx) => {
        const cardStart = card.startOffset;
        const cardProgressWords = Math.max(
          0,
          Math.min(card.words.length, smoothWordPos - cardStart)
        );
        const isCardComplete = cardProgressWords >= card.words.length - 0.15;
        const isCardActive =
          cardProgressWords > 0.05 && cardProgressWords < card.words.length - 0.15;

        return (
          <Reveal
            key={card.id}
            delay={80 + cardIdx * 70}
            y={14}
            duration={750}
          >
            <div
              className={`bg-white rounded-xl px-5 py-4 border transition-all duration-500 ease-out flex items-start gap-2.5 select-none ${
                isCardActive
                  ? "border-[#BFDBFE] shadow-[0_8px_24px_rgba(13,78,253,0.08)] ring-1 ring-[#0D4EFD]/20"
                  : isCardComplete
                    ? "border-[#E2ECF9] shadow-[0_4px_20px_rgba(15,23,42,0.04)] hover:border-[#BFDBFE] hover:shadow-[0_6px_20px_rgba(13,78,253,0.06)]"
                    : "border-[#EDF2F9] opacity-85"
              }`}
            >
              <span
                className={`font-serif text-[20px] leading-none select-none mt-0.5 transition-colors duration-500 ease-out ${
                  cardProgressWords > 0.1 ? "text-[#0D4EFD]" : "text-[#93C5FD]"
                }`}
              >
                “
              </span>
              <p className="text-[13.5px] sm:text-[14.5px] leading-relaxed">
                {card.words.map((word, wIdx) => {
                  const globalIdx = cardStart + wIdx;
                  // Continuous 0..1 fill ratio for each word so transitions never snap or reflow
                  const wordFill = Math.max(
                    0,
                    Math.min(1, smoothWordPos - globalIdx)
                  );
                  const isFilled = wordFill >= 0.5;
                  const isBlueHighlight =
                    card.blueHighlightIndices.includes(wIdx);
                  const isBoldPrefix = wIdx < card.boldPrefixCount;

                  // Keep font-weight and horizontal padding constant across states to eliminate layout shift/jitter
                  const weightClass = isBlueHighlight
                    ? "font-extrabold"
                    : isBoldPrefix
                      ? "font-bold"
                      : "font-semibold";

                  return (
                    <span key={`${card.id}-${wIdx}`} className="inline">
                      <span
                        style={{
                          opacity: 0.32 + wordFill * 0.68,
                          transform: `translate3d(0, ${(1 - wordFill) * 1.5}px, 0)`,
                        }}
                        className={`inline-block rounded transition-colors duration-300 ease-out will-change-[opacity,transform] ${weightClass} ${
                          isBlueHighlight
                            ? isFilled
                              ? "text-[#0D4EFD] bg-[#EBF2FF] px-1.5 py-0.5 border border-[#BFDBFE]/80 shadow-[0_1px_3px_rgba(13,78,253,0.08)]"
                              : "text-[#64748B] bg-transparent px-1.5 py-0.5 border border-transparent"
                            : isFilled
                              ? isBoldPrefix
                                ? "text-[#0F172A]"
                                : "text-[#1E293B]"
                              : "text-[#94A3B8]"
                        }`}
                      >
                        {word}
                      </span>
                      {wIdx < card.words.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </p>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"feedback" | "expressions" | "pronunciation">("feedback");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "home" | "features" | "how-it-works" | "pricing" | "faq"
  >("home");

  const marqueeTrackRef = useRef<HTMLDivElement | null>(null);
  const marqueePausedRef = useRef(false);

  const { ref: sessionReviewRef, inView: sessionReviewInView } = useInView({
    threshold: 0.22,
  });
  const { ref: watermarkRef, inView: watermarkInView } = useInView({
    threshold: 0.1,
    rootMargin: "0px 0px 0px 0px",
  });

  // Infinite seamless rightward horizontal auto-scroll for testimonials
  useEffect(() => {
    let rafId: number;
    let lastTime = performance.now();
    let offset = 0;
    let initialized = false;
    const speedPxPerSec = 55; // smooth continuous scroll to the right

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const track = marqueeTrackRef.current;
      if (track) {
        const halfWidth = track.scrollWidth / 2;
        if (halfWidth > 0) {
          if (!initialized) {
            offset = -halfWidth;
            initialized = true;
          }
          if (!marqueePausedRef.current) {
            offset += speedPxPerSec * dt;
            if (offset >= 0) {
              offset -= halfWidth;
            }
          }
          track.style.transform = `translate3d(${offset}px, 0, 0)`;
        }
      }

      rafId = window.requestAnimationFrame(step);
    };

    rafId = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(rafId);
  }, []);


  // Floating navbar state & active section detection
  useEffect(() => {
    let rafId: number | null = null;

    const updateOnScroll = () => {
      const scrollY = window.scrollY || 0;
      const nextScrolled = scrollY > 24;
      setIsScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));

      // Active section detection for navbar
      const sectionIds: Array<
        "faq" | "pricing" | "features" | "how-it-works"
      > = ["faq", "pricing", "features", "how-it-works"];
      let detected: "home" | "features" | "how-it-works" | "pricing" | "faq" =
        "home";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const top = el.getBoundingClientRect().top;
          if (top <= 180) {
            detected = id;
            break;
          }
        }
      }
      setActiveSection((prev) => (prev === detected ? prev : detected));
    };

    const onScroll = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        updateOnScroll();
        rafId = null;
      });
    };

    updateOnScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const testimonials = [
    {
      quote:
        "I used to pause for a long time before answering. Practicing simple conversations with Maya is helping me respond more naturally.",
      author: "Nadeesha P.",
      location: "Colombo, Sri Lanka · Software Engineer",
      initial: "N",
    },
    {
      quote:
        "The Sinhala explanations make feedback much easier to understand. I can practice without feeling judged.",
      author: "Arun K.",
      location: "Jaffna, Sri Lanka · University Student",
      initial: "A",
    },
    {
      quote:
        "The interview roleplays helped me organize my answers and speak with more confidence during my actual job interview.",
      author: "Shafiya M.",
      location: "Kandy, Sri Lanka · Marketing Executive",
      initial: "S",
    },
    {
      quote:
        "I knew English grammar for years, but my mind went blank when speaking. Five minutes a day with Maya changed everything.",
      author: "Kasun R.",
      location: "Galle, Sri Lanka · Banking Associate",
      initial: "K",
    },
    {
      quote:
        "Getting instant sentence corrections after each session helped me stop repeating the same mistakes at work.",
      author: "Dilani W.",
      location: "Negombo, Sri Lanka · HR Coordinator",
      initial: "D",
    },
    {
      quote:
        "I used to avoid speaking in client meetings. Now I practice workplace scenarios with Maya before important calls.",
      author: "Tharindu S.",
      location: "Kurunegala, Sri Lanka · Project Analyst",
      initial: "T",
    },
    {
      quote:
        "Maya feels like a patient friend who listens and gently shows me more natural ways to express my ideas.",
      author: "Fathima N.",
      location: "Matara, Sri Lanka · Teacher",
      initial: "F",
    },
    {
      quote:
        "The pronunciation tips and vocabulary suggestions helped me sound much clearer when presenting to my team.",
      author: "Chathura B.",
      location: "Gampaha, Sri Lanka · UI Designer",
      initial: "C",
    },
  ];

  return (
    <div
      id="home"
      className="min-h-screen flex flex-col bg-white text-[#0F172A] overflow-x-clip"
    >
      {/* ================= HEADER / NAVBAR (STICKY POP-OUT ON SCROLL) ================= */}
      <header
        className={`sticky top-0 z-50 w-full border-b transition-[padding,background-color,border-color] duration-300 ease-out ${
          isScrolled
            ? "pt-2.5 sm:pt-3 px-3 sm:px-6 bg-transparent border-transparent"
            : "bg-white border-[#F1F5F9] md:border-transparent"
        }`}
      >
        <div
          className={`mx-auto rounded-2xl border transition-[max-width,background-color,border-color,box-shadow,padding,backdrop-filter] duration-300 ease-out ${
            isScrolled
              ? "max-w-[1080px] bg-white/92 backdrop-blur-md border-[#E2E8F0]/90 shadow-[0_12px_32px_rgba(15,23,42,0.08)] px-4 sm:px-7"
              : "max-w-[1120px] bg-white/0 border-[#E2E8F0]/0 shadow-none px-5 sm:px-10"
          }`}
        >
          <Reveal y={-10} duration={750} threshold={0.01}>
            <div
              className={`flex items-center justify-between transition-all duration-300 ${
                isScrolled ? "h-[56px] md:h-[58px]" : "h-[72px] md:h-20"
              }`}
            >
              {/* Brand Logo */}
              <a
                href="#home"
                className="flex flex-col leading-none select-none group"
              >
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
              </a>

              {/* Navigation Links (Desktop) */}
              <nav className="hidden md:flex items-center gap-8 text-[13.5px] font-medium text-[#475569]">
                <a
                  href="#home"
                  className={`transition-colors ${
                    activeSection === "home"
                      ? "text-[#0F172A] font-semibold"
                      : "hover:text-[#0D4EFD]"
                  }`}
                >
                  Home
                </a>
                <a
                  href="#features"
                  className={`transition-colors ${
                    activeSection === "features"
                      ? "text-[#0D4EFD] font-semibold"
                      : "hover:text-[#0D4EFD]"
                  }`}
                >
                  Features
                </a>
                <a
                  href="#how-it-works"
                  className={`transition-colors ${
                    activeSection === "how-it-works"
                      ? "text-[#0D4EFD] font-semibold"
                      : "hover:text-[#0D4EFD]"
                  }`}
                >
                  How It Works
                </a>
                <a
                  href="#pricing"
                  className={`transition-colors ${
                    activeSection === "pricing"
                      ? "text-[#0D4EFD] font-semibold"
                      : "hover:text-[#0D4EFD]"
                  }`}
                >
                  Pricing
                </a>
                <a
                  href="#faq"
                  className={`transition-colors ${
                    activeSection === "faq"
                      ? "text-[#0D4EFD] font-semibold"
                      : "hover:text-[#0D4EFD]"
                  }`}
                >
                  FAQ
                </a>
              </nav>

              {/* Sign in Button (Desktop) */}
              <a
                href={SIGN_IN_URL}
                className="landing-primary-cta group hidden md:inline-flex items-center gap-2 bg-[#0D4EFD] hover:bg-[#0B42D8] hover:-translate-y-0.5 text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg shadow-[0_4px_12px_rgba(13,78,253,0.24)] hover:shadow-[0_8px_20px_rgba(13,78,253,0.32)] transition-all duration-200"
              >
                <CtaParticles />
                <span>Sign in</span>
                <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>

              {/* Hamburger Menu Button (Mobile) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-label="Toggle navigation menu"
                aria-expanded={mobileMenuOpen}
                className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#EDF4FF] text-[#0D4EFD] hover:bg-[#E0ECFF] active:scale-95 transition-all cursor-pointer"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="w-5 h-5 transition-transform duration-200"
                >
                  {mobileMenuOpen ? (
                    <path d="M5 5l10 10M15 5L5 15" />
                  ) : (
                    <path d="M3.5 6h13M3.5 10h13M3.5 14h13" />
                  )}
                </svg>
              </button>
            </div>
          </Reveal>

          {/* Smooth Mobile Dropdown Menu */}
          <div className="md:hidden">
            <div
              className="faq-accordion-content border-t border-[#F1F5F9]"
              data-open={mobileMenuOpen ? "true" : "false"}
              style={{ borderTopWidth: mobileMenuOpen ? "1px" : "0px" }}
            >
              <div className="faq-accordion-inner">
                <div className="pt-2 pb-5 space-y-3">
                  <nav className="flex flex-col space-y-2.5 text-[14px] font-medium text-[#475569] pt-1">
                    <a
                      href="#home"
                      onClick={() => setMobileMenuOpen(false)}
                      className="text-[#0F172A] font-semibold py-1"
                    >
                      Home
                    </a>
                    <a
                      href="#features"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-[#0D4EFD] py-1"
                    >
                      Features
                    </a>
                    <a
                      href="#how-it-works"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-[#0D4EFD] py-1"
                    >
                      How It Works
                    </a>
                    <a
                      href="#pricing"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-[#0D4EFD] py-1"
                    >
                      Pricing
                    </a>
                    <a
                      href="#faq"
                      onClick={() => setMobileMenuOpen(false)}
                      className="hover:text-[#0D4EFD] py-1"
                    >
                      FAQ
                    </a>
                  </nav>
                  <a
                    href={SIGN_IN_URL}
                    onClick={() => setMobileMenuOpen(false)}
                    className="landing-primary-cta w-full inline-flex items-center justify-center gap-2 bg-[#0D4EFD] text-white text-[13.5px] font-semibold py-3 rounded-xl shadow-[0_4px_12px_rgba(13,78,253,0.24)]"
                  >
                    <CtaParticles />
                    <span>Sign in</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ================= HERO SECTION ================= */}
        <section className="relative bg-white pt-8 sm:pt-10 overflow-hidden">
          <div className="max-w-[1120px] mx-auto px-5 sm:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 items-end gap-6 lg:gap-8">
              {/* Left Column */}
              <div className="lg:col-span-6 pb-2 lg:pb-16 pt-1 z-10 text-center lg:text-left">
                <Reveal delay={80} y={16} duration={850} threshold={0.05}>
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.11em] text-[#0D4EFD] mb-3">
                    YOUR PERSONAL AI ENGLISH SPEAKING COACH
                  </p>
                </Reveal>

                <Reveal delay={180} y={20} duration={950} threshold={0.05}>
                  <h1 className="font-display text-[36px] sm:text-[50px] lg:text-[58px] font-extrabold leading-[1.1] lg:leading-[1.06] tracking-[-0.03em] text-[#0F172A] mb-4 lg:mb-5">
                    Speak English{" "}
                    <br className="hidden lg:inline" />
                    with{" "}
                    <br className="lg:hidden" />
                    <span className="text-[#0D4EFD]">Confidence.</span>
                  </h1>
                </Reveal>

                <Reveal delay={280} y={18} duration={950} threshold={0.05}>
                  <p className="text-[14.5px] sm:text-[16.5px] leading-[1.6] text-[#64748B] max-w-[380px] sm:max-w-[440px] mx-auto lg:mx-0 mb-6 lg:mb-8 font-normal">
                    Practice real conversations with Maya, your personal AI
                    speaking coach. Improve your fluency, build better
                    sentences, and speak naturally.
                  </p>
                </Reveal>

                {/* CTA Buttons */}
                <Reveal delay={380} y={16} duration={950} threshold={0.05}>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-3 mb-5 lg:mb-7 max-w-[400px] sm:max-w-none mx-auto lg:mx-0">
                    <a
                      href={SIGN_UP_URL}
                      className="landing-primary-cta group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-[#0D4EFD] hover:bg-[#0B42D8] hover:-translate-y-0.5 text-white text-[14px] lg:text-[13.5px] font-semibold px-5 py-3.5 lg:py-3 rounded-xl lg:rounded-lg shadow-[0_6px_16px_rgba(13,78,253,0.25)] hover:shadow-[0_10px_22px_rgba(13,78,253,0.32)] transition-all duration-200"
                    >
                      <CtaParticles />
                      <span>Create an account</span>
                      <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                    </a>
                    <a
                      href={SIGN_IN_URL}
                      className="w-full sm:w-auto inline-flex items-center justify-center bg-white hover:bg-[#F8FAFC] hover:-translate-y-0.5 text-[#0F172A] border border-[#E2E8F0] text-[14px] lg:text-[13.5px] font-semibold px-5 py-3.5 lg:py-3 rounded-xl lg:rounded-lg transition-all duration-200"
                    >
                      Sign in
                    </a>
                  </div>
                </Reveal>

                {/* Social Proof */}
                <Reveal delay={480} y={14} duration={900} threshold={0.05}>
                  <div className="space-y-1.5">
                    <p className="text-[12px] lg:text-[12.5px] text-[#64748B]">
                      <span className="font-bold text-[#0D4EFD]">
                        Over 10,000 people
                      </span>{" "}
                      already use Maya
                    </p>
                    <div className="hidden lg:flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {[0, 1, 2, 3, 4].map((starIdx) => (
                          <span
                            key={starIdx}
                            className="animate-star-pop inline-flex"
                            style={{
                              animationDelay: `${560 + starIdx * 70}ms`,
                            }}
                          >
                            <StarIcon />
                          </span>
                        ))}
                      </div>
                      <span className="text-[12.5px] font-extrabold text-[#0F172A] ml-0.5">
                        4.9/5
                      </span>
                      <span className="text-[12px] text-[#94A3B8]">
                        Student Rating
                      </span>
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* Right Column — 3D Maya Illustration */}
              <div className="lg:col-span-6 flex justify-center lg:justify-end items-end relative -mx-5 sm:mx-0">
                <Reveal
                  delay={220}
                  y={24}
                  scale={0.96}
                  duration={1050}
                  threshold={0.05}
                  className="w-full flex justify-center lg:justify-end"
                >
                  <div className="relative w-full max-w-[420px] sm:max-w-[460px] lg:max-w-[520px] flex items-end justify-center pt-2 lg:pt-0">
                    {/* Breathing radial aura */}
                    <div
                      aria-hidden="true"
                      className="animate-maya-aura pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(50% 50% at 50% 55%, rgba(191, 214, 255, 0.42) 0%, rgba(255, 255, 255, 0) 75%)",
                      }}
                    />
                    <div className="animate-maya-float relative z-10 w-full flex items-end justify-center">
                      <Image
                        src="/maya-waving.png?v=2"
                        alt="Maya — Your Personal AI English Speaking Coach"
                        width={1232}
                        height={1118}
                        unoptimized
                        priority
                        className="w-[88%] sm:w-full h-auto object-contain object-bottom select-none pointer-events-none"
                      />
                    </div>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION 2: WHY IS SPEAKING SO HARD ================= */}
        <section
          className="py-16 sm:py-24 overflow-hidden"
          style={{
            background:
              "radial-gradient(65% 55% at 92% 96%, rgba(160, 190, 254, 0.6) 0%, rgba(246, 249, 255, 0) 100%), linear-gradient(180deg, #F6F9FF 0%, #EEF4FF 100%)",
          }}
        >
          <div className="max-w-[780px] w-full mx-auto px-5 sm:px-6 text-center relative z-10">
            <Reveal delay={0} y={18} duration={900}>
              <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0D4EFD] mb-2.5 sm:mb-3">
                YOUR NEXT STEP TO FLUENCY
              </p>
            </Reveal>

            <Reveal delay={110} y={20} duration={950}>
              <h2 className="font-display text-[28px] sm:text-[40px] font-extrabold leading-[1.18] sm:leading-[1.16] tracking-[-0.025em] text-[#0F172A] mb-3.5 sm:mb-4">
                You Know English.
                <br />
                So Why Is{" "}
                <span className="text-[#0D4EFD]">Speaking So Hard?</span>
              </h2>
            </Reveal>

            <Reveal delay={220} y={20} duration={950}>
              <p className="text-[13.5px] sm:text-[15px] leading-[1.6] text-[#64748B] max-w-[340px] sm:max-w-[540px] mx-auto mb-8 sm:mb-10">
                You understand English, but speaking feels difficult. Maya
                helps you practise real conversations, improve your sentences,
                and speak with confidence.
              </p>
            </Reveal>

            {/* 3 Quote Cards with Sequential Scroll-triggered Word-by-Word Fill Animation */}
            <QuotesCardsContainer />

            {/* Primary Wide CTA */}
            <Reveal delay={340} y={18} duration={950}>
              <div className="flex flex-col items-center max-w-[540px] mx-auto">
                <a
                  href={SIGN_UP_URL}
                  className="landing-primary-cta group w-full sm:max-w-[360px] inline-flex items-center justify-center gap-2 bg-[#0D4EFD] hover:bg-[#0B42D8] hover:-translate-y-0.5 text-white text-[14px] font-semibold py-3.5 px-6 rounded-xl shadow-[0_8px_20px_rgba(13,78,253,0.28)] hover:shadow-[0_12px_26px_rgba(13,78,253,0.36)] transition-all duration-200"
                >
                  <CtaParticles />
                  <span>Start Speaking with Maya</span>
                  <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </a>
                <p className="text-[11.5px] text-[#475569] mt-3.5">
                  Make mistakes. Learn naturally. Speak with confidence.
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ================= SECTION 3: HOW IT WORKS + PERSONALIZED FEEDBACK ================= */}
        <section id="how-it-works" className="bg-white py-16 sm:py-24">
          <div className="max-w-[1060px] mx-auto px-5 sm:px-10">
            {/* How It Works Header */}
            <Reveal y={16}>
              <div className="text-center mb-10 sm:mb-12">
                <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0D4EFD] mb-2">
                  HOW IT WORKS
                </p>
                <h2 className="font-display text-[28px] sm:text-[38px] font-extrabold leading-[1.18] tracking-[-0.025em] text-[#0F172A]">
                  Your English Practice
                  <br className="sm:hidden" />{" "}
                  <span className="text-[#0D4EFD]">Starts in Three Steps.</span>
                </h2>
              </div>
            </Reveal>

            {/* 3 Steps Grid with Arrows */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 relative items-stretch mb-16 sm:mb-24">
              {/* Step 01 */}
              <Reveal delay={0} y={22} scale={0.98} className="h-full">
                <div className="group h-full relative bg-[#F8FAFF] hover:bg-[#F3F7FF] border border-[#EAF1FF] hover:border-[#D6E4FF] rounded-2xl p-6 sm:p-7 text-center flex flex-col items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(13,78,253,0.06)]">
                  <span className="block absolute top-4 left-5 text-[11px] font-semibold text-[#CBD5E1]">
                    01
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-[#0D4EFD] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(13,78,253,0.25)] mb-4 mt-1 transition-transform duration-300 group-hover:scale-105">
                    {/* Speech Bubble Icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] sm:text-[15.5px] font-bold text-[#0F172A] mb-1.5">
                    Choose a Conversation
                  </h3>
                  <p className="text-[12.5px] sm:text-[13px] text-[#64748B] leading-relaxed max-w-[240px]">
                    <span className="md:hidden">
                      Pick a real-life situation you want to practise.
                    </span>
                    <span className="hidden md:inline">
                      Pick a topic or roleplay based on your goals.
                    </span>
                  </p>

                  {/* Arrow to Step 2 (desktop) */}
                  <div className="hidden md:flex items-center justify-center absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-[#93C5FD]">
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Reveal>

              {/* Step 02 */}
              <Reveal delay={140} y={22} scale={0.98} className="h-full">
                <div className="group h-full relative bg-[#F8FAFF] hover:bg-[#F3F7FF] border border-[#EAF1FF] hover:border-[#D6E4FF] rounded-2xl p-6 sm:p-7 text-center flex flex-col items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(13,78,253,0.06)]">
                  <span className="block absolute top-4 left-5 text-[11px] font-semibold text-[#CBD5E1]">
                    02
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-[#0D4EFD] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(13,78,253,0.25)] mb-4 mt-1 transition-transform duration-300 group-hover:scale-105">
                    {/* Microphone Icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] sm:text-[15.5px] font-bold text-[#0F172A] mb-1.5">
                    Speak Naturally with Maya
                  </h3>
                  <p className="text-[12.5px] sm:text-[13px] text-[#64748B] leading-relaxed max-w-[250px]">
                    <span className="md:hidden">
                      Talk freely and get support whenever you need it.
                    </span>
                    <span className="hidden md:inline">
                      Have a real-time voice conversation and express yourself
                      in your own words.
                    </span>
                  </p>

                  {/* Arrow to Step 3 (desktop) */}
                  <div className="hidden md:flex items-center justify-center absolute -right-4 top-1/2 -translate-y-1/2 z-10 text-[#93C5FD]">
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Reveal>

              {/* Step 03 */}
              <Reveal delay={280} y={22} scale={0.98} className="h-full">
                <div className="group h-full relative bg-[#F8FAFF] hover:bg-[#F3F7FF] border border-[#EAF1FF] hover:border-[#D6E4FF] rounded-2xl p-6 sm:p-7 text-center flex flex-col items-center transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(13,78,253,0.06)]">
                  <span className="block absolute top-4 left-5 text-[11px] font-semibold text-[#CBD5E1]">
                    03
                  </span>
                  <div className="w-12 h-12 rounded-xl bg-[#0D4EFD] text-white flex items-center justify-center shadow-[0_6px_14px_rgba(13,78,253,0.25)] mb-4 mt-1 transition-transform duration-300 group-hover:scale-105">
                    {/* Sparkles Icon */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-5 h-5"
                    >
                      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
                      <path d="M5 3v4M3 5h4" />
                    </svg>
                  </div>
                  <h3 className="text-[15px] sm:text-[15.5px] font-bold text-[#0F172A] mb-1.5">
                    Review and Improve
                  </h3>
                  <p className="text-[12.5px] sm:text-[13px] text-[#64748B] leading-relaxed max-w-[250px]">
                    <span className="md:hidden">
                      See corrections and tips after every conversation.
                    </span>
                    <span className="hidden md:inline">
                      Get feedback, correct mistakes, and learn better ways to
                      say things.
                    </span>
                  </p>
                </div>
              </Reveal>
            </div>

            {/* ================= PERSONALIZED FEEDBACK SUBSECTION ================= */}
            <div
              id="features"
              className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center"
            >
              {/* Left Column on Desktop / Second on Mobile: Session Review Mockup Card */}
              <div
                ref={sessionReviewRef}
                className="lg:col-span-6 order-2 lg:order-1"
              >
                <Reveal y={24} scale={0.98} duration={700}>
                  <div className="bg-white rounded-2xl border border-[#E8EFFC] shadow-[0_14px_40px_rgba(13,78,253,0.08)] p-5 sm:p-7">
                    {/* Top Bar */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <p className="text-[9px] sm:text-[9.5px] font-bold uppercase tracking-[0.12em] text-[#0D4EFD] mb-0.5">
                          SESSION REVIEW
                        </p>
                        <h4 className="text-[15.5px] sm:text-[16px] font-extrabold text-[#0F172A]">
                          Weekend conversation
                        </h4>
                      </div>
                      <div className="inline-flex items-center gap-1 text-[11.5px] text-[#94A3B8] font-medium mt-1">
                        <svg
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          className="w-3.5 h-3.5 hidden sm:inline-block"
                        >
                          <circle cx="8" cy="8" r="6" />
                          <path d="M8 4.5V8l2.2 1.2" strokeLinecap="round" />
                        </svg>
                        <span>8:42 min</span>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex items-center justify-between sm:justify-start sm:gap-6 border-b border-[#F1F5F9] text-[12px] font-semibold mb-4">
                      <button
                        type="button"
                        onClick={() => setActiveTab("feedback")}
                        className={`pb-2.5 inline-flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                          activeTab === "feedback"
                            ? "border-[#0D4EFD] text-[#0D4EFD]"
                            : "border-transparent text-[#94A3B8] hover:text-[#475569]"
                        }`}
                      >
                        <span>Feedback</span>
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full sm:rounded text-[10px] font-bold bg-[#DBEAFE] text-[#0D4EFD] sm:bg-[#0D4EFD] sm:text-white">
                          3
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("expressions")}
                        className={`pb-2.5 border-b-2 transition-colors cursor-pointer ${
                          activeTab === "expressions"
                            ? "border-[#0D4EFD] text-[#0D4EFD]"
                            : "border-transparent text-[#94A3B8] hover:text-[#475569]"
                        }`}
                      >
                        New Expressions
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveTab("pronunciation")}
                        className={`hidden sm:inline-block pb-2.5 border-b-2 transition-colors cursor-pointer ${
                          activeTab === "pronunciation"
                            ? "border-[#0D4EFD] text-[#0D4EFD]"
                            : "border-transparent text-[#94A3B8] hover:text-[#475569]"
                        }`}
                      >
                        Pronunciation
                      </button>
                    </div>

                    {/* Grammar Clarity Progress Box */}
                    <div className="sm:bg-[#FBFDFF] sm:border sm:border-[#EEF2F8] rounded-xl sm:p-3.5 mb-4 sm:mb-3.5">
                      <div className="flex items-center justify-between text-[11.5px] mb-2">
                        <span className="text-[#475569] sm:text-[#64748B] font-semibold sm:font-medium">
                          Grammar clarity
                        </span>
                        <span className="text-[#16A34A] font-bold">
                          Good progress
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#DCFCE7] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#16A34A] rounded-full transition-all duration-1000 ease-out"
                          style={{
                            width: sessionReviewInView ? "78%" : "0%",
                            transitionDelay: "180ms",
                          }}
                        />
                      </div>
                    </div>

                    {/* Red Box (Cascading Reveal 1) */}
                    <div
                      className="bg-[#FFF5F5] border border-[#FEE2E2] rounded-xl p-3.5 mb-3 flex items-center gap-3.5 transition-all duration-500"
                      style={{
                        opacity: sessionReviewInView ? 1 : 0,
                        transform: sessionReviewInView
                          ? "translateY(0)"
                          : "translateY(10px)",
                        transitionDelay: "180ms",
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#F87171] sm:bg-[#FEE2E2] flex items-center justify-center shrink-0">
                        {/* Mobile exclamation icon */}
                        <span className="sm:hidden text-white font-bold text-[13px] leading-none">
                          !
                        </span>
                        {/* Desktop X icon */}
                        <div className="hidden sm:flex w-4 h-4 rounded-full bg-[#EF4444] text-white items-center justify-center">
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            className="w-2.5 h-2.5"
                          >
                            <path d="M3.5 3.5l5 5M8.5 3.5l-5 5" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#EF4444] mb-0.5">
                          <span className="sm:hidden">NEEDS IMPROVEMENT</span>
                          <span className="hidden sm:inline">YOUR SENTENCE</span>
                        </p>
                        <p className="text-[12.5px] sm:text-[13px] font-medium text-[#B91C1C]">
                          <span className="sm:hidden">
                            I am agree with your opinion.
                          </span>
                          <span className="hidden sm:inline">
                            &ldquo;I am working here since two years.&rdquo;
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Green Box (Cascading Reveal 2) */}
                    <div
                      className="bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl p-3.5 mb-3 flex items-center gap-3.5 transition-all duration-500"
                      style={{
                        opacity: sessionReviewInView ? 1 : 0,
                        transform: sessionReviewInView
                          ? "translateY(0)"
                          : "translateY(10px)",
                        transitionDelay: "310ms",
                      }}
                    >
                      <div className="w-7 h-7 rounded-full bg-[#22C55E] sm:bg-[#DCFCE7] flex items-center justify-center shrink-0">
                        <div className="w-4 h-4 rounded-full bg-[#22C55E] text-white flex items-center justify-center">
                          <svg
                            viewBox="0 0 12 12"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-2.5 h-2.5"
                          >
                            <path d="M2.5 6.2L5 8.5L9.5 3.5" />
                          </svg>
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] font-extrabold uppercase tracking-[0.08em] text-[#16A34A] mb-0.5">
                          <span className="sm:hidden">BETTER SENTENCE</span>
                          <span className="hidden sm:inline">
                            SAY IT NATURALLY
                          </span>
                        </p>
                        <p className="text-[12.5px] sm:text-[13px] font-semibold text-[#15803D]">
                          <span className="sm:hidden">
                            I agree with your opinion.
                          </span>
                          <span className="hidden sm:inline">
                            &ldquo;I have been working here for two years.&rdquo;
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* Maya's Tip Box (Cascading Reveal 3) */}
                    <div
                      className="bg-[#F4F8FF] sm:bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-3.5 flex items-start gap-3 transition-all duration-500"
                      style={{
                        opacity: sessionReviewInView ? 1 : 0,
                        transform: sessionReviewInView
                          ? "translateY(0)"
                          : "translateY(10px)",
                        transitionDelay: "440ms",
                      }}
                    >
                      <div className="text-[#0D4EFD] mt-0.5 shrink-0">
                        <svg
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-4 h-4"
                        >
                          <path d="M10 2l1.5 4.5L16 8l-4.5 1.5L10 14l-1.5-4.5L4 8l4.5-1.5L10 2zM5 13l.75 2.25L8 16l-2.25.75L5 19l-.75-2.25L2 16l2.25-.75L5 13z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-[9.5px] font-extrabold uppercase tracking-[0.08em] text-[#334155] mb-0.5">
                          MAYA&apos;S TIP
                        </p>
                        <p className="text-[11.5px] text-[#64748B] leading-relaxed">
                          <span className="sm:hidden">
                            &ldquo;Agree&rdquo; is already a verb, so you
                            don&apos;t need &ldquo;am&rdquo;.
                          </span>
                          <span className="hidden sm:inline">
                            Use &ldquo;have been working&rdquo; for an activity
                            that started in the past and continues now. Use
                            &ldquo;for&rdquo; to describe how long it has
                            continued.
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>

              {/* Right Column on Desktop / First on Mobile: Learn from Every Conversation */}
              <div className="lg:col-span-6 lg:pl-4 order-1 lg:order-2 text-center lg:text-left">
                <Reveal delay={0} y={14}>
                  <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0D4EFD] mb-2">
                    <span className="lg:hidden">
                      REAL FEEDBACK. REAL PROGRESS.
                    </span>
                    <span className="hidden lg:inline">
                      PERSONALIZED FEEDBACK
                    </span>
                  </p>
                </Reveal>

                <Reveal delay={80} y={16}>
                  <h3 className="font-display text-[28px] sm:text-[38px] font-extrabold leading-[1.16] tracking-[-0.025em] text-[#0F172A] mb-3.5 sm:mb-4">
                    Learn from <span className="text-[#0D4EFD]">Every</span>
                    <br />
                    <span className="text-[#0D4EFD]">Conversation.</span>
                  </h3>
                </Reveal>

                <Reveal delay={150} y={16}>
                  <p className="text-[13.5px] sm:text-[15px] text-[#64748B] leading-[1.65] mb-7 max-w-[360px] sm:max-w-[460px] mx-auto lg:mx-0">
                    <span className="lg:hidden">
                      Maya doesn&apos;t just talk with you. After every
                      conversation, you get clear feedback that helps you
                      improve naturally.
                    </span>
                    <span className="hidden lg:inline">
                      Maya helps you understand your mistakes and discover
                      better ways to express yourself, so you can speak more
                      naturally over time.
                    </span>
                  </p>
                </Reveal>

                {/* Feature List */}
                <div className="space-y-4 mb-8 text-left max-w-[360px] sm:max-w-[440px] mx-auto lg:mx-0">
                  {/* Item 1 */}
                  <Reveal delay={210} x={-12} y={8}>
                    <div className="flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#0D4EFD] flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M4 13l3-7 3 7M5 11h4M12 11l2 2 3.5-3.5" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-[13.5px] sm:text-[14px] font-bold text-[#0F172A]">
                          <span className="lg:hidden">
                            Correct Sentence Mistakes
                          </span>
                          <span className="hidden lg:inline">
                            Correct Grammar Mistakes
                          </span>
                        </h4>
                        <p className="text-[12px] sm:text-[12.5px] text-[#64748B]">
                          <span className="lg:hidden">
                            See what went wrong and how to say it better.
                          </span>
                          <span className="hidden lg:inline">
                            Understand what was wrong and how to fix it.
                          </span>
                        </p>
                      </div>
                    </div>
                  </Reveal>

                  {/* Item 2 */}
                  <Reveal delay={300} x={-12} y={8}>
                    <div className="flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#0D4EFD] flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M17 9.5a6.5 6.5 0 0 1-6.5 6.5c-1.15 0-2.23-.3-3.17-.82L3 16.5l1.32-4.13A6.47 6.47 0 0 1 4 9.5 6.5 6.5 0 0 1 10.5 3 6.5 6.5 0 0 1 17 9.5Z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-[13.5px] sm:text-[14px] font-bold text-[#0F172A]">
                          <span className="lg:hidden">Improve Your Grammar</span>
                          <span className="hidden lg:inline">
                            Discover Natural Expressions
                          </span>
                        </h4>
                        <p className="text-[12px] sm:text-[12.5px] text-[#64748B]">
                          <span className="lg:hidden">
                            Understand grammar through real conversations.
                          </span>
                          <span className="hidden lg:inline">
                            Learn how fluent English speakers express everyday
                            ideas.
                          </span>
                        </p>
                      </div>
                    </div>
                  </Reveal>

                  {/* Item 3 */}
                  <Reveal delay={390} x={-12} y={8}>
                    <div className="flex items-start gap-3.5">
                      <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#0D4EFD] flex items-center justify-center shrink-0 mt-0.5">
                        <svg
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="w-4 h-4"
                        >
                          <path d="M3.5 6h13M3.5 10h9M3.5 14h11" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-[13.5px] sm:text-[14px] font-bold text-[#0F172A]">
                          Improve Sentence Formation
                        </h4>
                        <p className="text-[12px] sm:text-[12.5px] text-[#64748B]">
                          Build clearer and more confident sentences.
                        </p>
                      </div>
                    </div>
                  </Reveal>
                </div>

                {/* CTA Button */}
                <Reveal delay={460} y={12}>
                  <a
                    href={SIGN_UP_URL}
                    className="landing-primary-cta group inline-flex items-center justify-center gap-2 bg-[#0D4EFD] hover:bg-[#0B42D8] hover:-translate-y-0.5 text-white text-[13.5px] font-semibold px-6 py-3 rounded-xl lg:rounded-lg shadow-[0_6px_16px_rgba(13,78,253,0.24)] hover:shadow-[0_10px_22px_rgba(13,78,253,0.32)] transition-all duration-200"
                  >
                    <CtaParticles />
                    <span>Start Speaking</span>
                    <ArrowRightIcon className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </a>
                </Reveal>
              </div>
            </div>
          </div>
        </section>

        {/* ================= SECTION 4: PRICING ================= */}
        <section
          id="pricing"
          className="relative py-16 sm:py-24 overflow-hidden"
          style={{
            background:
              "radial-gradient(50% 55% at 95% 95%, rgba(168, 195, 254, 0.5) 0%, rgba(244, 248, 254, 0) 100%), linear-gradient(180deg, #F4F8FE 0%, #EFF5FF 100%)",
          }}
        >
          <div className="max-w-[1040px] mx-auto px-5 sm:px-10 relative z-10">
            {/* Pricing Header */}
            <Reveal y={16}>
              <div className="text-center mb-12 sm:mb-14">
                <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0D4EFD] mb-2">
                  SIMPLE AND AFFORDABLE
                </p>
                <h2 className="font-display text-[28px] sm:text-[38px] font-extrabold leading-[1.18] tracking-[-0.025em] text-[#0F172A] mb-3">
                  Choose Your Speaking
                  <br className="sm:hidden" /> Practice Plan
                </h2>
                <p className="text-[13.5px] sm:text-[14.5px] text-[#64748B] max-w-[340px] sm:max-w-[490px] mx-auto leading-relaxed">
                  Start free and upgrade whenever you&apos;re ready for more
                  practice time and advanced guidance.
                </p>
              </div>
            </Reveal>

            {/* 3 Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Basic Plan */}
              <Reveal delay={0} y={24} scale={0.98} className="h-full">
                <div className="h-full bg-white rounded-2xl border border-[#E6EEFA] p-6 sm:p-7 flex flex-col justify-between shadow-[0_6px_24px_rgba(15,23,42,0.03)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-all duration-300">
                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#0F172A] mb-1">
                      Basic
                    </h3>
                    <p className="text-[12.5px] text-[#94A3B8] mb-5">
                      Good for getting started
                    </p>
                    <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-[#F1F5F9]">
                      <span className="font-display text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                        LKR 3,600
                      </span>
                      <span className="text-[12px] text-[#94A3B8] font-medium">
                        / month
                      </span>
                    </div>

                    <ul className="space-y-3.5 mb-8 text-[13px] text-[#475569]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>10 minutes of practice per day</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Limited hints</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Basic feedback</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>All conversation topics</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Sinhala &amp; Tamil explanations</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={SIGN_UP_URL}
                    className="w-full py-3 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#0F172A] text-[13px] font-bold text-center transition-colors"
                  >
                    Start Basic
                  </a>
                </div>
              </Reveal>

              {/* Pro Plan (Highlighted) */}
              <Reveal delay={120} y={24} scale={0.98} className="h-full">
                <div className="h-full relative bg-white rounded-2xl border-2 border-[#3B76FE] p-6 sm:p-7 flex flex-col justify-between shadow-[0_14px_34px_rgba(13,78,253,0.12)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(13,78,253,0.18)] transition-all duration-300 mt-2 md:mt-0 md:-my-2">
                  {/* Most Popular Pill */}
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="inline-block bg-[#0D4EFD] text-white text-[9.5px] font-extrabold uppercase tracking-[0.1em] px-3.5 py-1 rounded-full shadow-sm">
                      MOST POPULAR
                    </span>
                  </div>

                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#0F172A] mb-1 mt-1">
                      Pro
                    </h3>
                    <p className="text-[12.5px] text-[#94A3B8] mb-5">
                      For faster improvement
                    </p>
                    <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-[#F1F5F9]">
                      <span className="font-display text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                        LKR 5,400
                      </span>
                      <span className="text-[12px] text-[#94A3B8] font-medium">
                        / month
                      </span>
                    </div>

                    <ul className="space-y-3.5 mb-8 text-[13px] text-[#475569]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>15-minute practice sessions</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Unlimited hints</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Detailed feedback</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>All conversation topics</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Sinhala &amp; Tamil explanations</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={SIGN_UP_URL}
                    className="landing-primary-cta w-full py-3 rounded-xl bg-[#0D4EFD] hover:bg-[#0B42D8] text-white text-[13px] font-bold text-center shadow-[0_6px_16px_rgba(13,78,253,0.28)] transition-all"
                  >
                    <CtaParticles />
                    <span>Upgrade to Pro</span>
                  </a>
                </div>
              </Reveal>

              {/* Premium Plan */}
              <Reveal delay={240} y={24} scale={0.98} className="h-full">
                <div className="h-full bg-white rounded-2xl border border-[#E6EEFA] p-6 sm:p-7 flex flex-col justify-between shadow-[0_6px_24px_rgba(15,23,42,0.03)] hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition-all duration-300">
                  <div>
                    <h3 className="text-[18px] font-extrabold text-[#0F172A] mb-1">
                      Premium
                    </h3>
                    <p className="text-[12.5px] text-[#94A3B8] mb-5">
                      For maximum guidance
                    </p>
                    <div className="flex items-baseline gap-1 mb-6 pb-6 border-b border-[#F1F5F9]">
                      <span className="font-display text-[28px] font-extrabold text-[#0F172A] tracking-tight">
                        LKR 7,200
                      </span>
                      <span className="text-[12px] text-[#94A3B8] font-medium">
                        / month
                      </span>
                    </div>

                    <ul className="space-y-3.5 mb-8 text-[13px] text-[#475569]">
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>30-minute practice sessions</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Unlimited hints</span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>
                          <span className="md:hidden">Advanced feedback</span>
                          <span className="hidden md:inline">
                            Deep guidance and advanced feedback
                          </span>
                        </span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>
                          <span className="md:hidden">
                            Personalised guidance
                          </span>
                          <span className="hidden md:inline">
                            Priority conversation topics
                          </span>
                        </span>
                      </li>
                      <li className="flex items-center gap-2.5">
                        <CheckCircleIcon />
                        <span>Sinhala &amp; Tamil explanations</span>
                      </li>
                    </ul>
                  </div>

                  <a
                    href={SIGN_UP_URL}
                    className="w-full py-3 rounded-xl border border-[#E2E8F0] md:border-transparent bg-white md:bg-[#EDF4FF] hover:bg-[#F8FAFC] md:hover:bg-[#E0ECFF] text-[#0F172A] md:text-[#0D4EFD] text-[13px] font-bold text-center transition-colors"
                  >
                    Upgrade to Premium
                  </a>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ================= SECTION 5: TESTIMONIALS ================= */}
        <section className="relative bg-[#0D4EFD] pt-16 sm:pt-20 pb-0 overflow-hidden text-white">
          <div className="max-w-[1040px] mx-auto px-5 sm:px-10 relative z-10">
            {/* Header */}
            <Reveal y={16}>
              <div className="text-center mb-10 sm:mb-12">
                <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/80 mb-2">
                  TESTIMONIALS
                </p>
                <h2 className="font-display text-[28px] sm:text-[38px] font-extrabold tracking-[-0.02em] text-white mb-2.5 sm:mb-3">
                  What Our Users Say
                </h2>
                <div className="inline-flex items-center gap-1.5">
                  <div className="flex items-center gap-0.5">
                    <StarIcon className="w-3.5 h-3.5 text-[#FACC15]" />
                    <StarIcon className="w-3.5 h-3.5 text-[#FACC15]" />
                    <StarIcon className="w-3.5 h-3.5 text-[#FACC15]" />
                    <StarIcon className="w-3.5 h-3.5 text-[#FACC15]" />
                    <StarIcon className="w-3.5 h-3.5 text-[#FACC15]" />
                  </div>
                  <span className="text-[12.5px] font-bold text-white ml-1">
                    4.9/5
                  </span>
                  <span className="text-[12px] text-white/75">
                    Student Rating
                  </span>
                </div>
              </div>
            </Reveal>

            {/* Infinite Horizontal Auto-Scroll Right Marquee */}
          </div>

          <Reveal delay={100} y={20}>
            <div className="relative w-full overflow-hidden mb-10 py-2">
              {/* Soft Left & Right Edge Fade Masks */}
              <div
                className="pointer-events-none absolute inset-y-0 left-0 w-10 sm:w-24 z-20 bg-gradient-to-r from-[#0D4EFD] to-transparent"
                aria-hidden="true"
              />
              <div
                className="pointer-events-none absolute inset-y-0 right-0 w-10 sm:w-24 z-20 bg-gradient-to-l from-[#0D4EFD] to-transparent"
                aria-hidden="true"
              />

              <div
                ref={marqueeTrackRef}
                onMouseEnter={() => {
                  marqueePausedRef.current = true;
                }}
                onMouseLeave={() => {
                  marqueePausedRef.current = false;
                }}
                className="flex flex-nowrap w-max will-change-transform"
              >
                {[0, 1].map((groupIndex) => (
                  <div
                    key={groupIndex}
                    className="flex flex-nowrap items-stretch gap-5 sm:gap-6 pr-5 sm:pr-6 shrink-0"
                    aria-hidden={groupIndex === 1 ? "true" : undefined}
                  >
                    {testimonials.map((item) => (
                      <div
                        key={`${groupIndex}-${item.author}`}
                        className="w-[285px] sm:w-[340px] shrink-0 bg-white text-[#0F172A] rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between"
                      >
                        <div>
                          <div className="text-[#0D4EFD] font-serif text-[28px] leading-none font-bold mb-3 select-none">
                            “
                          </div>
                          <p className="text-[13px] text-[#475569] leading-[1.65] mb-6">
                            &ldquo;{item.quote}&rdquo;
                          </p>
                        </div>
                        <div className="flex items-center gap-3 pt-4 border-t border-[#F1F5F9]">
                          <div className="w-8 h-8 rounded-full bg-[#EFF6FF] text-[#0D4EFD] text-[12px] font-extrabold flex items-center justify-center shrink-0">
                            {item.initial}
                          </div>
                          <div>
                            <p className="text-[12.5px] font-bold text-[#0F172A] leading-tight">
                              {item.author}
                            </p>
                            <p className="text-[10.5px] text-[#94A3B8]">
                              {item.location}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </Reveal>

          {/* Giant Clipped "10,000+" Display Text at Bottom */}
          <div
            ref={watermarkRef}
            className="w-full text-center select-none pointer-events-none overflow-hidden leading-none pt-2"
            aria-hidden="true"
          >
            <div
              className="font-display font-extrabold text-white text-[76px] sm:text-[150px] md:text-[190px] tracking-[-0.03em] leading-[0.78] transition-all duration-900"
              style={{
                opacity: watermarkInView ? 1 : 0,
                transform: watermarkInView
                  ? "translateY(14%)"
                  : "translateY(46%)",
                transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              10,000+
            </div>
          </div>
        </section>

        {/* ================= SECTION 6: FAQ ================= */}
        <section id="faq" className="bg-white py-16 sm:py-24">
          <div className="max-w-[1040px] mx-auto px-5 sm:px-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
              {/* Left Column */}
              <div className="lg:col-span-5 text-center lg:text-left">
                <Reveal delay={0} y={14}>
                  <p className="text-[10px] sm:text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#0D4EFD] mb-2">
                    FREQUENTLY ASKED QUESTIONS
                  </p>
                </Reveal>
                <Reveal delay={70} y={16}>
                  <h2 className="font-display text-[28px] sm:text-[38px] font-extrabold leading-[1.16] tracking-[-0.025em] text-[#0F172A] mb-3.5 sm:mb-4">
                    Got Questions?
                    <br />
                    We&apos;ve Got{" "}
                    <br className="hidden lg:inline" />
                    Answers.
                  </h2>
                </Reveal>
                <Reveal delay={140} y={16}>
                  <p className="text-[13.5px] sm:text-[14px] text-[#64748B] leading-[1.6] max-w-[320px] lg:max-w-[300px] mx-auto lg:mx-0 mb-5 sm:mb-6">
                    Everything you need to know before starting your first
                    conversation with Maya.
                  </p>
                </Reveal>
                <Reveal delay={200} y={14}>
                  <a
                    href="mailto:support@talkwithmaya.com"
                    className="w-full lg:w-auto inline-flex items-center justify-center px-5 py-3 lg:py-2.5 rounded-xl lg:rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAFC] hover:-translate-y-0.5 text-[13px] font-bold text-[#0F172A] transition-all duration-200"
                  >
                    Contact Us
                  </a>
                </Reveal>
              </div>

              {/* Right Column: Accordion List */}
              <div className="lg:col-span-7 divide-y divide-[#F1F5F9] border-b border-[#F1F5F9]">
                {FAQ_ITEMS.map((item, idx) => {
                  const isOpen = openFaqIndex === idx;
                  return (
                    <Reveal key={item.question} delay={idx * 55} y={12}>
                      <div className="py-4 first:pt-1">
                        <button
                          type="button"
                          onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                          className="w-full flex items-center justify-between gap-4 text-left py-1.5 group cursor-pointer"
                          aria-expanded={isOpen}
                        >
                          <span className="text-[14px] sm:text-[14.5px] font-bold text-[#0F172A] group-hover:text-[#0D4EFD] transition-colors">
                            {item.question}
                          </span>
                          <span
                            className={`w-6 h-6 rounded-full bg-[#F1F5F9] group-hover:bg-[#E2E8F0] flex items-center justify-center text-[#64748B] shrink-0 transition-transform duration-200 ${
                              isOpen
                                ? "rotate-180 bg-[#EFF6FF] text-[#0D4EFD]"
                                : ""
                            }`}
                          >
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="w-3.5 h-3.5"
                            >
                              <path d="M4.5 6.5L8 10l3.5-3.5" />
                            </svg>
                          </span>
                        </button>
                        <div
                          className="faq-accordion-content"
                          data-open={isOpen ? "true" : "false"}
                        >
                          <div className="faq-accordion-inner">
                            <p className="text-[13.5px] text-[#64748B] leading-relaxed pt-2 pb-1 pr-8">
                              {item.answer}
                            </p>
                          </div>
                        </div>
                      </div>
                    </Reveal>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-[#EDF3FE] pt-14 pb-10 text-[#475569]">
        <Reveal y={14} duration={550}>
          <div className="max-w-[1040px] mx-auto px-6 sm:px-10">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-10 pb-12 border-b border-[#DCE6F7]">
              {/* Brand Column */}
              <div className="md:col-span-5">
                <a
                  href="#home"
                  className="inline-block text-[22px] tracking-[-0.03em] text-[#0F172A] mb-2.5"
                >
                  <span className="font-extrabold">Speak</span>
                  <span className="font-normal text-[#1E293B]">with</span>
                  <span className="font-extrabold text-[#0D4EFD]">Maya</span>
                </a>
                <p className="text-[12.5px] text-[#64748B] leading-relaxed max-w-[240px]">
                  Your personal AI partner for building English speaking
                  confidence.
                </p>
              </div>

              {/* Explore Column */}
              <div className="md:col-span-2">
                <h4 className="text-[12px] font-bold text-[#0F172A] mb-3.5">
                  Explore
                </h4>
                <ul className="space-y-2.5 text-[12px] text-[#64748B]">
                  <li>
                    <a
                      href="#home"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Home
                    </a>
                  </li>
                  <li>
                    <a
                      href="#features"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Features
                    </a>
                  </li>
                  <li>
                    <a
                      href="#how-it-works"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      How It Works
                    </a>
                  </li>
                  <li>
                    <a
                      href="#pricing"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Pricing
                    </a>
                  </li>
                  <li>
                    <a
                      href="#faq"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      FAQ
                    </a>
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
                  <li className="text-[11.5px] text-[#64748B]">
                    Colombo, Sri Lanka
                  </li>
                </ul>

                <div className="mt-4 pt-3 border-t border-[#DCE6F7]/60">
                  <span className="text-[10px] text-[#64748B] block mb-1 font-semibold uppercase tracking-wider">
                    Secured by PayHere
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
                <ul className="space-y-2.5 text-[12px] text-[#64748B]">
                  <li>
                    <a
                      href="/terms"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Terms of Service
                    </a>
                  </li>
                  <li>
                    <a
                      href="/privacy"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Privacy Policy
                    </a>
                  </li>
                  <li>
                    <a
                      href="/refund"
                      className="hover:text-[#0D4EFD] transition-colors"
                    >
                      Refund Policy
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom Copyright Row */}
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#94A3B8]">
              <p>© 2026 SpeakwithMaya. All rights reserved.</p>
              <div className="flex items-center gap-2">
                <span className="uppercase tracking-[0.04em] font-medium text-[#64748B]">
                  IDEACIPHER (PVT) LTD
                </span>
                <span>·</span>
                <span>Sri Lanka</span>
              </div>
            </div>
          </div>
        </Reveal>
      </footer>
    </div>
  );
}
