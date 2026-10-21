import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'

import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

// Static, as in E-commerce: the dashboard (sign-in included) never waits on the storefront carrier lookup.
// Storefront pages set their carrier titles in their own generateMetadata.
export const metadata: Metadata = {
  title: 'Flights',
  description: 'Search flights, manage bookings, and check in online.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="/favicon.svg" rel="icon" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans`}>
        {children}
      </body>
    </html>
  )
}
