"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusCircle, MessageSquare, FileText, Settings } from "lucide-react"

type ChatSession = {
  id: string
  title: string
  created_at: string
}

export function Sidebar() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!user) return

    const fetchChatSessions = async () => {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (!error && data) {
        setChatSessions(data)
      }
      setIsLoading(false)
    }

    fetchChatSessions()

    // Subscribe to changes
    const subscription = supabase
      .channel("chat_sessions_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchChatSessions()
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, supabase])

  const createNewChat = async () => {
    if (!user) return

    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        user_id: user.id,
        title: "New Chat",
      })
      .select()
      .single()

    if (!error && data) {
      router.push(`/chat/${data.id}`)
    }
  }

  return (
    <div className="hidden md:flex h-screen w-64 flex-col border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <Button onClick={createNewChat} className="w-full justify-start gap-2" variant="outline">
          <PlusCircle className="h-4 w-4" />
          New Chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-2 py-2">
          <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">Navigation</h2>
          <div className="space-y-1">
            <Link
              href="/dashboard"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname === "/dashboard" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              <span>Dashboard</span>
            </Link>
            <Link
              href="/documents"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname === "/documents" || pathname.startsWith("/documents/")
                  ? "bg-accent text-accent-foreground"
                  : ""
              }`}
            >
              <FileText className="h-4 w-4" />
              <span>Documents</span>
            </Link>
            <Link
              href="/settings"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname === "/settings" ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
          </div>

          <h2 className="mt-6 mb-2 px-4 text-lg font-semibold tracking-tight">Recent Chats</h2>
          <div className="space-y-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            ) : chatSessions.length > 0 ? (
              chatSessions.map((chat) => (
                <Link
                  key={chat.id}
                  href={`/chat/${chat.id}`}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                    pathname === `/chat/${chat.id}` ? "bg-accent text-accent-foreground" : ""
                  }`}
                >
                  <MessageSquare className="h-4 w-4" />
                  <span className="truncate">{chat.title}</span>
                </Link>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-muted-foreground">No chat history found</div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
