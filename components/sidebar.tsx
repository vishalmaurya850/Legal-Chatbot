"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { MessageSquare, LayoutDashboard, FileText, Settings, PlusCircle, Scale, UserPlus, Users } from "lucide-react"
import { DeleteChatButton } from "@/components/delete-chat-button"

export function Sidebar() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [chats, setChats] = useState<{ id: string; title: string }[]>([])
  const [isLawyer, setIsLawyer] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!user) return

    const fetchChats = async () => {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("id, title")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })

      if (!error && data) {
        setChats(data)
      }
    }

    const fetchLawyerStatus = async () => {
      const { data, error } = await supabase.from("lawyers").select("id").eq("user_id", user.id).single()

      if (!error && data) {
        setIsLawyer(true)
      }
    }

    fetchChats()
    fetchLawyerStatus()

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
          fetchChats()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [user, supabase])

  const isActive = (path: string) => {
    return pathname === path || pathname.startsWith(`${path}/`)
  }

  return (
    <div className="flex h-full w-64 flex-col border-r border-sky-100 bg-white">
      <div className="flex h-16 items-center border-b border-sky-100 px-4">
        {/* <Link href="/dashboard" className="flex items-center">
          <h1 className="text-xl font-bold text-sky-700">VIDHI 7</h1>
        </Link> */}
      </div>
      <ScrollArea className="flex-1 px-2 py-4">
        <div className="space-y-1">
          <Link href="/chat">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                isActive("/chat") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
              }`}
            >
              <MessageSquare className="mr-2 h-4 w-4" />
              AI Chat
            </Button>
          </Link>
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                isActive("/dashboard") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
              }`}
            >
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Dashboard
            </Button>
          </Link>
          <Link href="/documents">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                isActive("/documents") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
              }`}
            >
              <FileText className="mr-2 h-4 w-4" />
              Documents
            </Button>
          </Link>
          <Link href="/settings">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                isActive("/settings") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
              }`}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
        </div>

        <Separator className="my-4 bg-sky-100" />

        <div className="space-y-1">
          <div className="flex items-center justify-between px-2 py-1.5">
            <h2 className="text-sm font-semibold text-gray-700">Recent Chats</h2>
            <Link href="/chat">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-500 hover:text-sky-700">
                <PlusCircle className="h-4 w-4" />
                <span className="sr-only">New Chat</span>
              </Button>
            </Link>
          </div>
          {chats.map((chat) => (
            <div key={chat.id} className="flex items-center">
              <Link href={`/chat/${chat.id}`} className="flex-1">
                <Button
                  variant="ghost"
                  className={`w-full justify-start truncate ${
                    pathname === `/chat/${chat.id}` ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
                  }`}
                >
                  <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                  <span className="truncate">{chat.title}</span>
                </Button>
              </Link>
              <DeleteChatButton chatId={chat.id} />
            </div>
          ))}
        </div>

        <Separator className="my-4 bg-sky-100" />

        <div className="space-y-1">
          <div className="px-2 py-1.5">
            <h2 className="text-sm font-semibold text-gray-700">Legal Services</h2>
          </div>
          <Link href="/legal-help/dashboard">
            <Button
              variant="ghost"
              className={`w-full justify-start ${
                isActive("/legal-help/dashboard") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
              }`}
            >
              <Scale className="mr-2 h-4 w-4" />
              Legal Help
            </Button>
          </Link>
          {isLawyer ? (
            <Link href="/lawyers/dashboard">
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive("/lawyers/dashboard") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
                }`}
              >
                <Users className="mr-2 h-4 w-4" />
                Lawyer Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/lawyers/register">
              <Button
                variant="ghost"
                className={`w-full justify-start ${
                  isActive("/lawyers/register") ? "bg-sky-100 text-sky-700" : "text-gray-700 hover:text-sky-700"
                }`}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Register as Lawyer
              </Button>
            </Link>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
