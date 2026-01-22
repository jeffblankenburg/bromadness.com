import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Graduate } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const graduate = Graduate({
  weight: "400",
  variable: "--font-display",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bro Madness",
  description: "March Madness bracket pool, daily pick'em, and casino",
  icons: {
    icon: "/logo.png",
    apple: "/icons/icon-192x192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bro Madness",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f97316",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${graduate.variable} antialiased bg-black`}
      >
        <main className="min-h-screen pt-safe pb-14">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
