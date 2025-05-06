import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Chat } from "@/components/chat"
import { cookies } from "next/headers"

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = createServerSupabaseClient(cookies())

  // Await params to access id
  const { id } = await params

  // Validate user with getUser()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error("Error validating user:", userError)
    notFound()
  }

  // Verify user exists in users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userData.user.id)
    .single()

  if (userRecordError || !userRecord) {
    console.error("User not found in users table:", userRecordError)
    notFound()
  }

  // Check if chat session exists and belongs to user
  const { data: chatSession, error } = await supabase
    .from("chat_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", userData.user.id)
    .single()

  if (error || !chatSession) {
    console.error("Chat session not found:", error)
    notFound()
  }

  return <Chat chatId={id} />
}