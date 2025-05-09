"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { PlusCircle, MessageSquare, FileText, Settings, Trash2, MoreVertical, Scale, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

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
  const [chatToDelete, setChatToDelete] = useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const supabase = getSupabaseClient()

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

  const handleDeleteChat = async (chatId: string) => {
    if (!user) return

    try {
      // First delete all messages associated with this chat
      const { error: messagesError } = await supabase.from("messages").delete().eq("chat_session_id", chatId)

      if (messagesError) {
        console.error("Error deleting messages:", messagesError)
        return
      }

      // Then delete the chat session
      const { error: chatError } = await supabase.from("chat_sessions").delete().eq("id", chatId).eq("user_id", user.id)

      if (chatError) {
        console.error("Error deleting chat:", chatError)
        return
      }

      // If we're currently on the deleted chat page, redirect to dashboard
      if (pathname === `/chat/${chatId}`) {
        router.push("/dashboard")
      }

      // Update the local state
      setChatSessions(chatSessions.filter((chat) => chat.id !== chatId))
    } catch (error) {
      console.error("Error in delete operation:", error)
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
              href="/legal-help/dashboard"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith("/legal-help") ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <Scale className="h-4 w-4" />
              <span>Legal Help</span>
            </Link>
            <Link
              href="/lawyers/dashboard"
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                pathname.startsWith("/lawyers") ? "bg-accent text-accent-foreground" : ""
              }`}
            >
              <User className="h-4 w-4" />
              <span>Lawyer Dashboard</span>
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
                <div key={chat.id} className="flex items-center group">
                  <Link
                    href={`/chat/${chat.id}`}
                    className={`flex flex-1 items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
                      pathname === `/chat/${chat.id}` ? "bg-accent text-accent-foreground" : ""
                    }`}
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{chat.title}</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">More options</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          setChatToDelete(chat.id)
                          setIsDeleteDialogOpen(true)
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            ) : (
              <div className="px-4 py-2 text-sm text-muted-foreground">No chat history found</div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChatToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (chatToDelete) {
                  handleDeleteChat(chatToDelete)
                  setChatToDelete(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}