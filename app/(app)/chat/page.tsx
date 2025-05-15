"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Chat } from "@/components/chat"

export default function ChatPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!user) return

    const createNewChat = async () => {
      try {
        // Check if there are any existing chats
        const { error: fetchError } = await supabase
          .from("chat_sessions")
          .select("id")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)

        if (fetchError) throw fetchError

        // If there are existing chats, redirect to the most recent one
        // if (existingChats && existingChats.length > 0) {
        //   router.push(`/chat/${existingChats[0].id}`)
        //   return
        // }

        // Otherwise, stay on the "new" chat page
      } catch (error) {
        console.error("Error checking for existing chats:", error)
      }
    }

    createNewChat()
  }, [user, router, supabase])

  return (
    <div className="h-full">
      <Chat chatId="new" />
    </div>
  )
}