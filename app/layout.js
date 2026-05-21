import { IBM_Plex_Mono, Syne, Inter } from 'next/font/google';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';

// 600 never used — drop it to save ~10 KB
const ibmPlex = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
  preload: true,
});

// Only used for headings (logo + hero h1) — 400/600 not needed
const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-syne',
  display: 'swap',
  preload: true,
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
  preload: true,
});

export const metadata = {
  metadataBase: new URL('https://llm-matcher.vercel.app'),
  title: 'Local LLM Matcher — Find Models Your GPU Can Run',
  description: 'Instantly match your GPU, VRAM, and RAM to compatible local LLMs. Find the best quantization level and estimated tokens/sec for your hardware.',
  keywords: 'local LLM, GPU, VRAM, llama.cpp, ollama, quantization, gguf',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Local LLM Matcher',
    description: 'Find which local AI models your GPU can actually run.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Local LLM Matcher',
    description: 'Find which local AI models your GPU can actually run.',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${ibmPlex.variable} ${syne.variable} ${inter.variable}`}>
      <head>
        {process.env.NEXT_PUBLIC_ADSENSE && (
          <Script
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js`}
            data-ad-client={process.env.NEXT_PUBLIC_ADSENSE}
            strategy="lazyOnload"
            crossOrigin="anonymous"
          />
        )}
      </head>
      <body className="antialiased min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
