import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "SpeakwithMaya — Your AI English Speaking Coach",
  description:
    "Practice real conversations with Maya, your personal AI speaking coach. Improve your fluency, build better sentences, and speak naturally.",
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
      <body className="min-h-screen bg-white text-[#0F172A] font-sans selection:bg-[#0D4EFD]/15 selection:text-[#0D4EFD]">
        {children}
      </body>
    </html>
  );
}
