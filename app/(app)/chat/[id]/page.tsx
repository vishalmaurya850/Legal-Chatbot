"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Chat } from "@/components/chat"
import { Loader2 } from "lucide-react"

export default function ChatPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [isValidChat, setIsValidChat] = useState<boolean | null>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!user || !id || id === "new") {
      setIsValidChat(true)
      return
    }

    const validateChat = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select("id")
          .eq("id", id)
          .eq("user_id", user.id)
          .single()

        if (error) {
          console.error("Error validating chat:", error)
          setIsValidChat(false)
          return
        }

        setIsValidChat(true)
      } catch (error) {
        console.error("Error in validateChat:", error)
        setIsValidChat(false)
      }
    }

    validateChat()
  }, [id, user, supabase])

  if (isValidChat === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  if (isValidChat === false) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <h2 className="text-2xl font-bold mb-2 text-sky-700">Chat Not Found</h2>
        <p className="text-gray-600 mb-4">The chat you're looking for doesn't exist or you don't have access to it.</p>
      </div>
    )
  }

  return (
    <div className="h-full">
      <Chat chatId={id as string} />
    </div>
  )
}