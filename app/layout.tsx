import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"
import { AuthProvider } from "@/contexts/auth-context";
// import { runStartupTasks } from "@/lib/startup"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "VIDHI 7 - Legal Chatbot",
  description: "AI-powered legal assistance for Indian law",
}

// Run startup tasks
// if (process.env.NODE_ENV !== "production") {
//   runStartupTasks().catch(console.error)
// }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
          {children}
          <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
