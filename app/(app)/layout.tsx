import type React from "react"
import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Navbar } from "@/components/navbar"
import { Sidebar } from "@/components/sidebar"
import { cookies } from "next/headers"

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createServerSupabaseClient(cookies())

  // Validate user with getUser()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error("Error validating user:", userError)
    redirect("/login")
  }

  // Verify user exists in users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userData.user.id)
    .single()

  if (userRecordError || !userRecord) {
    console.error("User not found in users table:", userRecordError)
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
}