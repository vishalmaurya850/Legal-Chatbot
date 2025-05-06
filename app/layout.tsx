import type React from "react"
import "./globals.css"
import { Inter } from "next/font/google"
import { AuthProvider } from "@/contexts/auth-context"
import { ThemeProvider } from "@/components/theme-provider"
// import { runStartupTasks } from "@/lib/startup"

const inter = Inter({ subsets: ["latin"] })

export const metadata = {
  title: "Legal Chatbot - Indian Constitution",
  description: "AI-powered legal assistant for the Indian Constitution",
}

// Run startup tasks
// if (process.env.NODE_ENV !== "production") {
//   runStartupTasks().catch(console.error)
// }

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
