import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"

export default async function HomePage() {
  const supabase = createServerSupabaseClient(cookies())

  // Validate user with getUser()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) {
    console.error("Error validating user:", userError)
    redirect("/login")
  }

  if (userData.user) {
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

    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}