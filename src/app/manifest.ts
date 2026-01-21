import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bro Madness',
    short_name: 'Bro Madness',
    description: 'March Madness bracket pool, daily pick\'em, and casino',
    start_url: '/',
    display: 'standalone',
    background_color: '#0a0a0a',
    theme_color: '#f97316',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
