"use client"

import type React from "react"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Paperclip, Loader2 } from "lucide-react"
import { ChatMessage } from "@/components/chat-message"
// import { SpeechToText } from "@/components/speech-to-text"
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
  const [isBotResponding, setIsBotResponding] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const supabase = getSupabaseClient()

  useEffect(() => {
    if (!chatId || chatId === "new") return

    const fetchMessages = async () => {
      setIsLoading(true)
      try {
        const { data: chatData, error: chatError } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("id", chatId)
          .single()

        if (chatError) {
          console.error("Error fetching chat:", chatError)
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
      } catch (error) {
        console.error("Error in fetchMessages:", error)
        toast({ variant: "destructive", description: "An error occurred while loading messages" })
      } finally {
        setIsLoading(false)
      }
    }

    fetchMessages()
  }, [chatId, router, supabase])

  useEffect(() => {
    if (!chatId || chatId === "new") return

    const channel = supabase
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
          const newMessage = payload.new as Message

          // Only add the message if it's not already in the messages array
          setMessages((prev) => {
            if (!prev.some((msg) => msg.id === newMessage.id)) {
              return [...prev, newMessage]
            }
            return prev
          })

          if (newMessage.is_bot) {
            setIsBotResponding(false)
          }
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Subscription error:", err)
          toast({ variant: "destructive", description: "Failed to subscribe to messages" })
        }
        console.log("Subscription status:", status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const createNewChat = async (message: string): Promise<string> => {
    try {
      // Create a new chat session
      const { data: chatData, error: chatError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user?.id,
          title: message.substring(0, 30) + (message.length > 30 ? "..." : ""),
        })
        .select()
        .single()

      if (chatError) throw chatError

      return chatData.id
    } catch (error) {
      console.error("Error creating new chat:", error)
      toast({ variant: "destructive", description: "Failed to create new chat" })
      throw error
    }
  }

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim() && files.length === 0) return
      if (!user || isSending) return

      setIsSending(true)
      setIsBotResponding(true)

      try {
        // If chatId is "new", create a new chat session
        let currentChatId = chatId
        if (chatId === "new") {
          currentChatId = await createNewChat(input.trim())
          // Update the URL without reloading the page
          window.history.pushState({}, "", `/chat/${currentChatId}`)
        }

        // Add optimistic update for user message
        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          content: input.trim(),
          is_bot: false,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => [...prev, optimisticUserMessage])

        // Handle file uploads if any
        if (files.length > 0) {
          const { data: messageData, error: messageError } = await supabase
            .from("messages")
            .insert({
              chat_session_id: currentChatId,
              user_id: user.id,
              content: files.length > 0 ? "Attached files" : input.trim(),
              is_bot: false,
            })
            .select()
            .single()

          if (messageError) throw messageError

          for (const file of files) {
            const formData = new FormData()
            formData.append("file", file)
            formData.append("messageId", messageData.id)

            const uploadResponse = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            })

            if (!uploadResponse.ok) {
              const errorData = await uploadResponse.json()
              throw new Error(errorData.error || "Failed to upload file")
            }
          }
          setFiles([])
        }

        // Send the actual message to the server
        if (input.trim()) {
          const { error: userMessageError } = await supabase.from("messages").insert({
            chat_session_id: currentChatId,
            user_id: user.id,
            content: input.trim(),
            is_bot: false,
          })

          if (userMessageError) throw userMessageError

          // Call API to get bot response
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              chatId: currentChatId,
              message: input.trim(),
              userId: user.id,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            throw new Error(errorData.error || "Failed to get response from bot")
          }
        }

        setInput("")

        // If this was a new chat, redirect to the new chat page
        if (chatId === "new") {
          router.push(`/chat/${currentChatId}`)
        }
      } catch (error: any) {
        console.error("Error in chat flow:", error)
        toast({
          variant: "destructive",
          description: error.message || "Failed to send message",
        })
        setIsBotResponding(false)
      } finally {
        setIsSending(false)
      }
    },
    [input, files, user, chatId, isSending, supabase, router],
  )

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files))
    }
  }

  const handleFeedback = async (messageId: string, isPositive: boolean) => {
    if (!user) return

    try {
      const { error } = await supabase.from("feedback").insert({
        message_id: messageId,
        user_id: user.id,
        rating: isPositive ? 5 : 1,
      })

      if (error) throw error

      toast({
        description: isPositive
          ? "Thank you for your positive feedback!"
          : "Thank you for your feedback. We'll work to improve.",
      })
    } catch (error) {
      console.error("Error submitting feedback:", error)
      toast({ variant: "destructive", description: "Failed to submit feedback" })
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-4rem)]">
      <div ref={chatContainerRef} className="flex-1 p-6 overflow-y-auto" style={{ maxHeight: "calc(100vh - 10rem)" }}>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-bold mb-2 text-sky-700">Welcome to VIDHI 7</h2>
            <p className="text-gray-600 mb-4">Ask any question for legal advice</p>
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
            {isBotResponding && (
              <div className="flex justify-start">
                <div className="bg-sky-50 text-sky-700 rounded-lg p-4 max-w-[80%]">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t border-sky-100 p-4 bg-white">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="border-sky-200 text-sky-700 hover:bg-sky-50"
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
              placeholder="Ask for legal advice..."
              className="flex-1 min-h-[60px] resize-none border-sky-200 focus-visible:ring-sky-500"
              disabled={isSending}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage(e)
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={isSending || (!input.trim() && files.length === 0)}
              className="bg-sky-600 hover:bg-sky-700"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {files.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-sky-50 text-sky-700 px-2 py-1 rounded-md text-xs"
                >
                  <span className="truncate max-w-[150px]">{file.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-sky-100"
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