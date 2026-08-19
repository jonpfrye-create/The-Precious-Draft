import type { Metadata } from "next";
import { Geist, Geist_Mono, IBM_Plex_Mono, Press_Start_2P } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// The two faces the front-door poster is built from. next/font downloads
// and self-hosts them at build time, so there is no request to Google at
// runtime and no moment where the poster renders in a fallback face and
// then jumps - which on an arcade display face is the whole effect gone.
const pressStart = Press_Start_2P({
  variable: "--font-press-start",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, Next resolves the preview image against localhost and
  // the link unfurls in the league chat with a broken thumbnail. This
  // page exists to be pasted into that chat, so it matters more here than
  // it usually would.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-precious-draft.vercel.app"
  ),
  title: "One Precious After Another",
  description:
    "Draft night. Saturday 29 August 2026, 5:00 PM. Twelve teams, one snake draft, three phases.",
  openGraph: {
    title: "One Precious After Another",
    description:
      "Draft night. Saturday 29 August 2026, 5:00 PM. Twelve teams, one snake draft.",
    images: ["/james-8bit.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${pressStart.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
