import { redirect } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { cookies } from "next/headers"

export default async function ChatPage() {
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
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-6">User not found. Please try again later.</p>
        </div>
      </div>
    )
  }

  // Create a new chat session
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({
      user_id: userData.user.id,
      title: "New Chat",
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating chat session:", error)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-muted-foreground mb-6">Failed to create a new chat session. Please try again.</p>
        </div>
      </div>
    )
  }

  if (data) {
    redirect(`/chat/${data.id}`)
  }

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Start a New Chat</h1>
        <p className="text-muted-foreground mb-6">Ask any question about the Indian Constitution</p>
        <Button disabled={true} size="lg">
          <PlusCircle className="mr-2 h-4 w-4" />
          Creating new chat...
        </Button>
      </div>
    </div>
  )
}