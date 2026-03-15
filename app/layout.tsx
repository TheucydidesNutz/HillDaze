import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Covaled — Group Travel, Coordinated',
  description: 'Covaled gives group travel organizers a command center and every attendee a personal microsite with everything they need.',
  metadataBase: new URL('https://www.covaled.com'),
  openGraph: {
    title: 'Covaled — Group Travel, Coordinated',
    description: 'One link. Everything your attendees need. Group travel made easy.',
    url: 'https://www.covaled.com',
    siteName: 'Covaled',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Covaled — Group Travel, Coordinated',
      },
    ],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Covaled — Group Travel, Coordinated',
    description: 'One link. Everything your attendees need. Group travel made easy.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}