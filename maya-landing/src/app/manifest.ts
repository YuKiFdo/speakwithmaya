import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SpeakwithMaya - AI English Speaking Coach",
    short_name: "SpeakwithMaya",
    description:
      "Practice real conversations with Maya, your personal AI speaking coach. Improve your fluency, build better sentences, and speak naturally.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0D4EFD",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
