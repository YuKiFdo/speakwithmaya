import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://speakwithmaya.com";

export const viewport: Viewport = {
  themeColor: "#0D4EFD",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SpeakwithMaya — Your Personal AI English Speaking Coach",
    template: "%s | SpeakwithMaya",
  },
  description:
    "Practice real spoken English conversations with Maya. Gain fluency, get instant sentence corrections, and speak with confidence without fear of judgment. Try it free today.",
  keywords: [
    "SpeakwithMaya",
    "AI English speaking coach",
    "learn spoken English Sri Lanka",
    "spoken English practice",
    "English conversation practice app",
    "AI English tutor",
    "IELTS speaking practice AI",
    "English fluency trainer",
    "Sinhala to English speaking",
    "Tamil to English speaking",
    "daily English conversation",
  ],
  authors: [{ name: "IDEACIPHER (PVT) LTD", url: SITE_URL }],
  creator: "IDEACIPHER (PVT) LTD",
  publisher: "IDEACIPHER (PVT) LTD",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SpeakwithMaya — Your Personal AI English Speaking Coach",
    description:
      "Practice real spoken English conversations with Maya. Gain fluency, get instant sentence corrections, and speak naturally without fear. Join thousands practicing in Sri Lanka.",
    url: SITE_URL,
    siteName: "SpeakwithMaya",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "SpeakwithMaya — Your Personal AI English Speaking Coach",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SpeakwithMaya — Your Personal AI English Speaking Coach",
    description:
      "Practice real spoken English conversations with Maya. Improve your fluency, build confidence, and speak naturally.",
    images: ["/og-image.png"],
    creator: "@speakwithmaya",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "SpeakwithMaya",
      alternateName: "IDEACIPHER (PVT) LTD",
      url: SITE_URL,
      logo: `${SITE_URL}/icon.png`,
      sameAs: [],
      contactPoint: {
        "@type": "ContactPoint",
        email: "support@speakwithmaya.com",
        contactType: "customer support",
        areaServed: "LK",
        availableLanguage: ["en", "si", "ta"],
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: "SpeakwithMaya",
      description: "AI-Powered English Speaking Coach",
      publisher: {
        "@id": `${SITE_URL}/#organization`,
      },
    },
    {
      "@type": "SoftwareApplication",
      name: "SpeakwithMaya",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web, iOS, Android",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "LKR",
        lowPrice: "0",
        highPrice: "4990",
      },
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        ratingCount: "1250",
        bestRating: "5",
        worstRating: "1",
      },
      description:
        "Real-time AI voice conversation partner for spoken English practice, instant pronunciation feedback, and grammar corrections.",
    },
    {
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is SpeakwithMaya?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "SpeakwithMaya is an AI-powered English-speaking coach that helps you improve your speaking skills through real-time conversations, roleplays, and personalized feedback.",
          },
        },
        {
          "@type": "Question",
          name: "Who is SpeakwithMaya for?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "SpeakwithMaya is for anyone who wants to improve their spoken English, build confidence, and speak more naturally, even if they already know English grammar but struggle to speak.",
          },
        },
        {
          "@type": "Question",
          name: "Can Maya correct my English mistakes?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes! Maya can help you identify grammar mistakes, improve pronunciation, and find more natural ways to express yourself.",
          },
        },
        {
          "@type": "Question",
          name: "How many minutes can I practice?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Your available AI conversation minutes depend on your selected plan. Check the pricing table to see the included minutes and session durations for each plan.",
          },
        },
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jakarta.variable} scroll-smooth antialiased`}
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-screen bg-white text-[#0F172A] font-sans selection:bg-[#0D4EFD]/15 selection:text-[#0D4EFD]">
        {children}
      </body>
    </html>
  );
}
