"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Loader2 } from "lucide-react"
import { ChatMessage } from "@/components/chat-message"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

type Message = {
  id: string
  content: string
  is_bot: boolean
  created_at: string
}

export function DocumentChat({ documentId }: { documentId: string }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase =getSupabaseClient()

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    if (!user || !documentId) return

    setIsSending(true)

    try {
      // Create a temporary message
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        content: input.trim(),
        is_bot: false,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, tempMessage])
      setInput("")

      // Call API to get bot response
      const response = await fetch("/api/document-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentId,
          message: input.trim(),
          userId: user.id,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to get response from bot")
      }

      const data = await response.json()

      // Add bot response
      const botMessage: Message = {
        id: `bot-${Date.now()}`,
        content: data.text || "I couldn't find an answer based on this document.",
        is_bot: true,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, botMessage])
    } catch (error) {
      console.error("Error in document chat:", error)

      // Add error message
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        content: "Sorry, there was an error processing your request. Please try again.",
        is_bot: true,
        created_at: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Document Chat</CardTitle>
        <CardDescription>Ask questions about this document to get specific information</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="flex flex-col h-[500px]">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                <p className="text-muted-foreground mb-4">
                  Ask specific questions about this document to get targeted answers
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <ChatMessage key={message.id} message={message} onFeedback={() => {}} />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about this document..."
                className="flex-1 min-h-[60px] resize-none"
                disabled={isSending}
              />
              <Button type="submit" size="icon" disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send</span>
              </Button>
            </form>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
