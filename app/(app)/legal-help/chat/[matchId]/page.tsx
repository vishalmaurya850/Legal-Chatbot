"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, Send, User, ArrowLeft } from "lucide-react"
import type { LawyerMatch, LawyerMessage, Lawyer, LegalRequest } from "@/types/supabase"

export default function LegalHelpChatPage({ params }: { params: { matchId: string } }) {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const [match, setMatch] = useState<LawyerMatch | null>(null)
  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [request, setRequest] = useState<LegalRequest | null>(null)
  const [messages, setMessages] = useState<LawyerMessage[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchChatData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch match data
        const { data: matchData, error: matchError } = await supabase
          .from("lawyer_matches")
          .select("*")
          .eq("id", params.matchId)
          .eq("user_id", user.id)
          .single()

        if (matchError) {
          if (matchError.code === "PGRST116") {
            // Not found error
            router.push("/legal-help/dashboard")
            return
          }
          throw matchError
        }

        setMatch(matchData)

        // Fetch lawyer data
        const { data: lawyerData, error: lawyerError } = await supabase
          .from("lawyers")
          .select("*")
          .eq("id", matchData.lawyer_id)
          .single()

        if (lawyerError) throw lawyerError

        setLawyer(lawyerData)

        // Fetch request data
        const { data: requestData, error: requestError } = await supabase
          .from("legal_requests")
          .select("*")
          .eq("id", matchData.legal_request_id)
          .single()

        if (requestError) throw requestError

        setRequest(requestData)

        // Fetch messages
        const { data: messagesData, error: messagesError } = await supabase
          .from("lawyer_messages")
          .select("*")
          .eq("match_id", params.matchId)
          .order("created_at", { ascending: true })

        if (messagesError) throw messagesError

        setMessages(messagesData || [])

        // Mark unread messages as read
        if (messagesData && messagesData.length > 0) {
          const unreadMessages = messagesData.filter((msg) => !msg.is_read && msg.sender_id !== user.id)

          if (unreadMessages.length > 0) {
            await supabase
              .from("lawyer_messages")
              .update({ is_read: true })
              .in(
                "id",
                unreadMessages.map((msg) => msg.id),
              )
          }
        }
      } catch (err: any) {
        console.error("Error fetching chat data:", err)
        setError(err.message || "An error occurred while loading the chat")
      } finally {
        setIsLoading(false)
      }
    }

    fetchChatData()

    // Set up real-time subscription for new messages
    const messagesSubscription = supabase
      .channel(`match_${params.matchId}_messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "lawyer_messages",
          filter: `match_id=eq.${params.matchId}`,
        },
        async (payload) => {
          // Add the new message to the state
          const newMsg = payload.new as LawyerMessage

          // Mark message as read if it's not from the current user
          if (newMsg.sender_id !== user.id) {
            await supabase.from("lawyer_messages").update({ is_read: true }).eq("id", newMsg.id)
          }

          setMessages((prev) => [...prev, newMsg])
        },
      )
      .subscribe()

    return () => {
      messagesSubscription.unsubscribe()
    }
  }, [user, router, supabase, params.matchId])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!newMessage.trim() || !user || !match) return

    setIsSending(true)

    try {
      const { error: sendError } = await supabase.from("lawyer_messages").insert({
        match_id: match.id,
        sender_id: user.id,
        content: newMessage.trim(),
        is_read: false,
      })

      if (sendError) throw sendError

      setNewMessage("")
    } catch (err: any) {
      console.error("Error sending message:", err)
      setError(err.message || "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!match || !lawyer || !request) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Chat Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">The chat you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
            <Button onClick={() => router.push("/legal-help/dashboard")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-12rem)]">
      <div className="flex items-center mb-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/legal-help/dashboard")} className="mr-4">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{request.title}</h1>
          <div className="flex items-center text-sm text-muted-foreground">
            <span className="mr-2">Chatting with {lawyer.full_name}</span>
            <Badge variant="outline">{lawyer.specialization}</Badge>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="flex flex-col h-full">
        <CardContent className="flex-1 p-0 flex flex-col">
          <ScrollArea className="flex-1 p-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center p-4">
                <User className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Start your conversation</h3>
                <p className="text-muted-foreground mb-4">
                  This is the beginning of your conversation with {lawyer.full_name} regarding your legal issue.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => {
                  const isCurrentUser = message.sender_id === user?.id
                  return (
                    <div key={message.id} className={`flex ${isCurrentUser ? "justify-end" : "justify-start"}`}>
                      <div className="flex items-start max-w-[80%]">
                        {!isCurrentUser && (
                          <Avatar className="h-8 w-8 mr-2">
                            <div className="bg-primary text-primary-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-medium">
                              {lawyer.full_name.charAt(0)}
                            </div>
                          </Avatar>
                        )}
                        <div
                          className={`rounded-lg px-4 py-2 ${
                            isCurrentUser ? "bg-primary text-primary-foreground" : "bg-muted"
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          <div className="text-xs mt-1 opacity-70">
                            {new Date(message.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-4 border-t">
            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 min-h-[80px] resize-none"
                disabled={isSending}
              />
              <Button type="submit" size="icon" className="h-10 w-10" disabled={isSending}>
                {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="sr-only">Send message</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}