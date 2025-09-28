import type { Metadata } from 'next'
import './providers'
import { Providers } from './providers'
import '../styles/globals.css'

export const metadata: Metadata = {
  title: 'System Design Copilot',
  description: 'AI-powered system design assistant',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}