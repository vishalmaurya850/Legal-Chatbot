"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Paperclip, Loader2 } from "lucide-react"
import { ChatMessage } from "@/components/chat-message"

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
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!user || !chatId) return

    const fetchMessages = async () => {
      setIsLoading(true)
      const { data: chatData, error: chatError } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("id", chatId)
        .eq("user_id", user.id)
        .single()

      if (chatError || !chatData) {
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

      if (!messagesError && messagesData) {
        setMessages(messagesData)
      }
      setIsLoading(false)
    }

    fetchMessages()

    // Subscribe to new messages
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
        async (payload) => {
          const { data: newMessage, error } = await supabase
            .from("messages")
            .select(`
              *,
              attachments (*)
            `)
            .eq("id", payload.new.id)
            .single()

          if (!error && newMessage) {
            setMessages((prev) => [...prev, newMessage])
          }
        },
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, chatId, router, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && files.length === 0) return
    if (!user || !chatId) return

    setIsSending(true)

    try {
      // Insert user message
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_session_id: chatId,
          user_id: user.id,
          content: input.trim() || "Attached files",
          is_bot: false,
        })
        .select()
        .single()

      if (messageError || !messageData) {
        console.error("Error sending message:", messageError)
        setIsSending(false)
        return
      }

      // Upload files if any
      if (files.length > 0) {
        for (const file of files) {
          const formData = new FormData()
          formData.append("file", file)
          formData.append("messageId", messageData.id)

          await fetch("/api/upload", {
            method: "POST",
            body: formData,
          })
        }
        setFiles([])
      }

      setInput("")

      // Call API to get bot response
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
        throw new Error("Failed to get response from bot")
      }

      // Update chat title if it's the first message
      if (messages.length === 0) {
        const title = input.trim().substring(0, 30) + (input.trim().length > 30 ? "..." : "")
        await supabase.from("chat_sessions").update({ title }).eq("id", chatId)
      }
    } catch (error) {
      console.error("Error in chat flow:", error)
    } finally {
      setIsSending(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    if (!user) return

    await supabase.from("feedback").insert({
      message_id: messageId,
      user_id: user.id,
      rating: isPositive ? 5 : 1,
    })
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
            <Button type="button" variant="outline" size="icon" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach files</span>
            </Button>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question about the Indian Constitution..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={isSending}
            />
            <Button type="submit" size="icon" disabled={isSending}>
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
                  >
                    &times;
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