"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
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
import { Trash2 } from "lucide-react"
import { toast } from "@/components/ui/use-toast"

interface DeleteChatButtonProps {
  chatId: string
}

export function DeleteChatButton({ chatId }: DeleteChatButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()
  const supabase = getSupabaseClient()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      // First delete all messages associated with this chat
      const { error: messagesError } = await supabase.from("messages").delete().eq("chat_session_id", chatId)

      if (messagesError) {
        throw messagesError
      }

      // Then delete the chat session
      const { error: chatError } = await supabase.from("chat_sessions").delete().eq("id", chatId)

      if (chatError) {
        throw chatError
      }

      toast({
        description: "Chat deleted successfully",
      })

      // If we're currently on the deleted chat page, redirect to chat
      if (window.location.pathname === `/chat/${chatId}`) {
        router.push("/chat")
      } else {
        // Otherwise just refresh the current page
        router.refresh()
      }
    } catch (error) {
      console.error("Error deleting chat:", error)
      toast({
        variant: "destructive",
        description: "Failed to delete chat",
      })
    } finally {
      setIsDeleting(false)
      setIsOpen(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 p-0 text-gray-500 hover:text-red-600 hover:bg-red-50"
        onClick={() => setIsOpen(true)}
      >
        <Trash2 className="h-4 w-4" />
        <span className="sr-only">Delete chat</span>
      </Button>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this chat and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDelete()
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}