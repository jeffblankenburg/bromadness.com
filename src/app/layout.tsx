import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Graduate } from "next/font/google";
import "./globals.css";
import { BottomNav } from "@/components/BottomNav";
import { DevTimeBanner } from "@/components/DevTimeBanner";
import { SimulatedUserBanner } from "@/components/SimulatedUserBanner";
import { ServiceWorkerInit } from "@/components/ServiceWorkerInit";
import { createClient } from "@/lib/supabase/server";
import { getSimulatedUserId } from "@/lib/simulation";

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
  manifest: "/manifest.json",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetch simulated time for dev banner
  const supabase = await createClient()
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  const simulatedTime = tournament?.dev_simulated_time as string | null

  // Check for user simulation
  const simulatedUserId = await getSimulatedUserId()
  let simulatedUserName: string | null = null

  if (simulatedUserId) {
    const { data: simulatedUser } = await supabase
      .from('users')
      .select('display_name')
      .eq('id', simulatedUserId)
      .single()
    simulatedUserName = simulatedUser?.display_name || null
  }

  // Calculate banner count for layout spacing
  const bannerCount = (simulatedTime ? 1 : 0) + (simulatedUserName ? 1 : 0)

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${graduate.variable} antialiased bg-black`}
      >
        {simulatedTime && <DevTimeBanner simulatedTime={simulatedTime} />}
        {simulatedUserName && (
          <SimulatedUserBanner
            userName={simulatedUserName}
            hasDevBanner={!!simulatedTime}
          />
        )}
        <ServiceWorkerInit />
        <main className={`min-h-screen pt-safe pb-14 ${bannerCount === 1 ? 'mt-8' : bannerCount === 2 ? 'mt-16' : ''}`}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
