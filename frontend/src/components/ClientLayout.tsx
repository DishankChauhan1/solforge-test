"use client"

import { Navbar } from "./Navbar"
import { Footer } from "./Footer"
import { Providers } from "./Providers"

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 pt-16">
          {children}
        </main>
        <Footer />
      </div>
    </Providers>
  )
} 