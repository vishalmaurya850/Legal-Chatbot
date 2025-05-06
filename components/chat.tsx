"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Loader2 } from "lucide-react"
import { ChatMessage } from "@/components/chat-message"
import { toast } from "@/components/ui/use-toast"

type Message = {
  id: string
  content: string
  is_bot: boolean
  created_at: string
  attachments?: {
    id: string
    file_name: string
    file_type: string
    file_path: string
  }[]
}

export function Chat({ chatId }: { chatId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    if (!user || !chatId) {
      router.push("/login")
      return
    }

    const fetchMessages = async () => {
      setIsLoading(true)
      const { data: chatData, error: chatError } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", chatId)
        .eq("user_id", user.id)
        .single()

      if (chatError || !chatData) {
        toast({ variant: "destructive", description: "Chat session not found" })
        router.push("/chat")
        return
      }

      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select(`
          *,
          attachments (*)
        `)
        .eq("chat_session_id", chatId)
        .order("created_at", { ascending: true })

      if (messagesError) {
        console.error("Error fetching messages:", messagesError)
        toast({ variant: "destructive", description: "Failed to load messages" })
      } else {
        setMessages(messagesData || [])
      }
      setIsLoading(false)
    }

    fetchMessages()
  }, [user, chatId, router, supabase])

  useEffect(() => {
    if (!user || !chatId) return

    const subscription = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_session_id=eq.${chatId}`,
        },
        (payload) => {
          console.log("New message received:", payload)
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [user, chatId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() && files.length === 0) return
      if (!user || !chatId || isSending) return

      setIsSending(true)

      try {
        // Upload files if any
        let messageId: string | null = null
        if (files.length > 0) {
          const { data: messageData, error: messageError } = await supabase
            .from("messages")
            .insert({
              chat_session_id: chatId,
              user_id: user.id,
              content: "Attached files",
              is_bot: false,
            })
            .select()
            .single()

          if (messageError || !messageData) {
            throw new Error("Failed to save message with attachments")
          }

          messageId = messageData.id

          for (const file of files) {
            const formData = new FormData()
            formData.append("file", file)
            if (messageId) {
              formData.append("messageId", messageId)
            } else {
              throw new Error("Message ID is null")
            }

            const uploadResponse = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            })

            if (!uploadResponse.ok) {
              throw new Error("Failed to upload file")
            }
          }
          setFiles([])
        }

        // Send message to API if there's text input
        if (input.trim()) {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chatId,
              message: input.trim(),
              userId: user.id,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to get response from bot")
          }

          const { message: botMessage } = await response.json()
          setMessages((prev) => [...prev, botMessage])
        }

        setInput("")
      } catch (error) {
        console.error("Error in chat flow:", error)
        toast({ variant: "destructive", description: "Failed to send message" })
      } finally {
        setIsSending(false)
      }
    },
    [input, files, user, chatId, isSending, supabase]
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    if (!user) return

    const { error } = await supabase.from("feedback").insert({
      message_id: messageId,
      user_id: user.id,
      rating: isPositive ? 5 : 1,
    })

    if (error) {
      console.error("Error submitting feedback:", error)
      toast({ variant: "destructive", description: "Failed to submit feedback" })
    }
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-bold mb-2">Welcome to Legal Chatbot</h2>
            <p className="text-muted-foreground mb-4">Ask any question about the Indian Constitution</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onFeedback={(isPositive) => handleFeedback(message.id, isPositive)}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      <div className="border-t p-4">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach files</span>
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
              multiple
              disabled={isSending}
            />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the Indian Constitution..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={isSending || (!input.trim() && files.length === 0)}>
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-xs"
                >
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0"
                    onClick={() => setFiles(files.filter((_, i) => i !== index))}
                    disabled={isSending}
                  >
                    ×
                  </Button>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  )
}