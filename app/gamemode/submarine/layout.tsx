import type React from "react"
import type { Metadata } from "next"
import { Montserrat } from "next/font/google"
// import "./globals.css"

export const metadata: Metadata = {
  title: "Submarine Squad",
  description: "Created with v0 by Kizuko",
  generator: "v0.dev",
}

export const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  variable: "--font-montserrat",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className={`${montserrat.variable}`}>
      <body>
        <div
          id="page-transition"
          className="fixed inset-0 bg-deep-ocean z-50 opacity-0 pointer-events-none transition-opacity duration-300"
        >
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin w-12 h-12 border-4 border-white/30 border-t-white rounded-full"></div>
          </div>
        </div>
        {children}
      </body>
    </html>
  )
}
