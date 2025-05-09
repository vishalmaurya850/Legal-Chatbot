import type React from "react"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the session
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error("Error getting session in app layout:", error)
      redirect("/login")
    }

    if (!session) {
      console.log("No session found in app layout, redirecting to login")
      redirect("/login")
    }

    // Verify the user exists
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      console.error("Error getting user in app layout:", userError)
      redirect("/login")
    }

    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Navbar />
          <main className="flex-1 overflow-auto p-4">{children}</main>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error in app layout:", error)
    redirect("/login")
  }
}