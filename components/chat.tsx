"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Send, Paperclip, Loader2, Mic, FileText, X } from "lucide-react"
import { ChatMessage } from "@/components/chat-message"
import { toast } from "@/components/ui/use-toast"
import { FileUpload } from "@/components/file-upload"
import { uploadAudio } from "@/lib/storage-service"
import { extractTextFromFile } from "@/lib/text-extraction"
import Tesseract from "tesseract.js"

type Document = {
  id: string
  file_name: string
  file_type: string
  file_path: string
}

type Message = {
  id: string
  content: string
  is_bot: boolean
  created_at: string
  documents?: Document[]
}

export function Chat({ chatId }: { chatId: string }) {
  const { user } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [isBotResponding, setIsBotResponding] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  // const streamRef = useRef<MediaStream | null>(null)
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
          console.error("Error fetching chat:", JSON.stringify(chatError, null, 2))
          toast({ variant: "destructive", description: "Chat session not found" })
          router.push("/chat")
          return
        }

        console.log("Fetching messages for chatId:", chatId)
        const { data: messagesData, error: messagesError } = await supabase
          .from("messages")
          .select(`
            id,
            content,
            is_bot,
            created_at,
            documents:documents!left (
              id,
              file_name:title,
              file_type,
              file_path
            )
          `)
          .eq("chat_session_id", chatId)
          .order("created_at", { ascending: true })

        if (messagesError) {
          console.error("Error fetching messages:", JSON.stringify(messagesError, null, 2))
          toast({
            variant: "destructive",
            description: `Failed to load messages: ${messagesError.message || "Unknown error"}`,
          })
          return
        }

        console.log("Raw messagesData:", JSON.stringify(messagesData, null, 2))

        // Validate and transform data to match Message type
        const validatedMessages: Message[] = (messagesData || []).map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          is_bot: msg.is_bot,
          created_at: msg.created_at,
          documents: Array.isArray(msg.documents)
            ? msg.documents.map((doc: any) => ({
                id: doc.id,
                file_name: doc.file_name || "Unknown",
                file_type: doc.file_type || "",
                file_path: doc.file_path || "",
              }))
            : [],
        }))

        console.log("Validated messages:", validatedMessages)
        setMessages(validatedMessages)
      } catch (error: any) {
        console.error("Error in fetchMessages:", JSON.stringify(error, null, 2))
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
        async (payload) => {
          console.log("New message received:", payload)
          const newMessage = payload.new as Message

          const { data: documentData, error: documentError } = await supabase
            .from("documents")
            .select("id, title, file_type, file_path")
            .eq("message_id", newMessage.id)
            .maybeSingle()

          if (documentError) {
            console.error("Error fetching document for message:", JSON.stringify(documentError, null, 2))
          }

          setMessages((prev) => {
            if (!prev.some((msg) => msg.id === newMessage.id)) {
              return [
                ...prev,
                {
                  ...newMessage,
                  documents: documentData
                    ? [
                        {
                          id: documentData.id,
                          file_name: documentData.title || "Unknown",
                          file_type: documentData.file_type || "",
                          file_path: documentData.file_path || "",
                        },
                      ]
                    : [],
                },
              ]
            }
            return prev
          })

          if (newMessage.is_bot) {
            setIsBotResponding(false)
          }

          setTimeout(() => {
            scrollToBottom()
          }, 100)
        },
      )
      .subscribe((status, err) => {
        if (err) {
          console.error("Subscription error:", JSON.stringify(err, null, 2))
          toast({ variant: "destructive", description: "Failed to subscribe to messages" })
        }
        console.log("Subscription status:", status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chatId, supabase])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Clean up media resources on unmount
  useEffect(() => {
    return () => {
      // Stop any ongoing recording
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
      }

      // Stop and release the media stream
      // if (streamRef.current) {
      //   streamRef.current.getTracks().forEach((track) => track.stop())
      // }
    }
  }, [isRecording])

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }

  const createNewChat = async (message: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated")

    try {
      const { data: userData, error: userError } = await supabase.from("users").select("id").eq("id", user.id).single()

      if (userError) {
        const { error: insertError } = await supabase.from("users").insert({
          id: user.id,
          full_name: user.email || "Unknown User",
        })

        if (insertError) {
          console.error("Error creating user:", JSON.stringify(insertError, null, 2))
          throw new Error("Failed to create user profile")
        }
      }

      const { data: chatData, error: chartError } = await supabase
        .from("chat_sessions")
        .insert({
          user_id: user.id,
          title: message.substring(0, 30) + (message.length > 30 ? "..." : ""),
        })
        .select()
        .single()

      if (chartError) {
        console.error("Error creating chat session:", JSON.stringify(chartError, null, 2))
        throw new Error("Failed to create new chat session")
      }

      return chatData.id
    } catch (error: any) {
      console.error("Error creating new chat:", JSON.stringify(error, null, 2))
      toast({
        variant: "destructive",
        description: error.message || "Failed to create new chat",
      })
      throw error
    }
  }

  const handleSendMessage = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!input.trim()) return
      if (!user || isSending) return

      setIsSending(true)
      setIsBotResponding(true)

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!session) {
          throw new Error("No active session")
        }

        let currentChatId = chatId
        if (chatId === "new") {
          currentChatId = await createNewChat(input.trim())
          window.history.pushState({}, "", `/chat/${currentChatId}`)
        }

        const optimisticUserMessage: Message = {
          id: `temp-${Date.now()}`,
          content: input.trim(),
          is_bot: false,
          created_at: new Date().toISOString(),
          documents: [],
        }

        setMessages((prev) => [...prev, optimisticUserMessage])
        setInput("")

        const { data: messageData, error: userMessageError } = await supabase
          .from("messages")
          .insert({
            chat_session_id: currentChatId,
            user_id: user.id,
            content: input.trim(),
            is_bot: false,
          })
          .select()
          .single()

        if (userMessageError) {
          console.error("Error creating user message:", userMessageError)
          throw new Error("Failed to send message")
        }

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            chatId: currentChatId,
            message: input.trim(),
            userId: user.id,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error("API error response:", errorData)
          throw new Error(errorData.error || "Failed to get response from bot")
        }

        const responseData = await response.json()

        if (responseData.success && responseData.message) {
          const botMessage: Message = {
            id: responseData.id || `bot-${Date.now()}`,
            content: responseData.message,
            is_bot: true,
            created_at: new Date().toISOString(),
            documents: [],
          }

          setMessages((prev) => [...prev, botMessage])
          setIsBotResponding(false)
        }

        if (chatId === "new") {
          router.push(`/chat/${currentChatId}`)
        }
      } catch (error: any) {
        console.error("Error in chat flow:", error)
        console.error("Error details:", JSON.stringify(error, null, 2))

        toast({
          variant: "destructive",
          description: error?.message || "Failed to send message",
        })

        setIsBotResponding(false)
      } finally {
        setIsSending(false)
      }
    },
    [input, user, chatId, isSending, supabase, router],
  )

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
    } catch (error: any) {
      console.error("Error submitting feedback:", JSON.stringify(error, null, 2))
      toast({ variant: "destructive", description: "Failed to submit feedback" })
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // streamRef.current = stream

      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await processAudioTranscription(audioBlob)

        // Stop all tracks to release the microphone
        stream.getTracks().forEach((track) => track.stop())
        // streamRef.current = null
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error: any) {
      console.error("Error starting recording:", JSON.stringify(error, null, 2))
      toast({ variant: "destructive", description: "Failed to access microphone" })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudioTranscription = async (audioBlob: Blob) => {
    if (!user) {
      toast({ variant: "destructive", description: "You must be logged in to transcribe audio" })
      return
    }

    try {
      setIsUploading(true)
      toast({ description: "Processing your speech..." })

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No active session")
      }

      const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: "audio/webm" })
      const uploadResult = await uploadAudio(audioFile, user.id)

      if (!uploadResult.success || !uploadResult.filePath) {
        throw new Error(uploadResult.error || "Failed to upload audio")
      }

      const formData = new FormData()
      formData.append("audio", audioFile)
      formData.append("userId", user.id)
      formData.append("audioPath", uploadResult.filePath)

      const deviceInfo = {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        vendor: navigator.vendor,
      }
      formData.append("deviceInfo", JSON.stringify(deviceInfo))

      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to transcribe audio")
      }

      const { transcription, confidence } = await response.json()

      if (transcription && transcription.trim()) {
        setInput((prev) => prev + (prev ? " " : "") + transcription)

        toast({
          description: `Transcription complete (${Math.round((confidence || 0) * 100)}% confidence)`,
        })

        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      } else {
        toast({
          variant: "destructive",
          description: "Could not understand audio. Please try again.",
        })
      }
    } catch (error: any) {
      console.error("Error processing audio transcription:", JSON.stringify(error, null, 2))
      toast({ variant: "destructive", description: error.message || "Failed to transcribe audio" })
    } finally {
      setIsUploading(false)
    }
  }

  const handleFileUploadStart = () => {
    setIsUploading(true)
  }

  const handleFileUploadComplete = async (
    filePath: string,
    fileName: string,
    fileType: string,
    fileSize: number,
    file: File,
  ) => {
    try {
      let extractedText: string | undefined

      // For image files, perform client-side OCR
      if (["image/png", "image/jpeg", "image/jpg"].includes(fileType)) {
        console.log("Performing client-side OCR for image:", fileName)
        toast({ description: "Extracting text from image..." })

        const {
          data: { text },
        } = await Tesseract.recognize(file, "eng", {
          logger: (m) => console.log("OCR progress:", m),
        })

        extractedText = text.trim()
        if (!extractedText) {
          throw new Error("No text content found in image")
        }

        toast({ description: "Text extracted from image successfully" })
      }
      // For other document types, extract text client-side
      else if (
        [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ].includes(fileType)
      ) {
        console.log("Extracting text from document:", fileName)
        toast({ description: "Extracting text from document..." })

        const result = await extractTextFromFile(file)
        if (result.success && result.text) {
          extractedText = result.text
          toast({ description: "Text extracted from document successfully" })
        } else {
          console.warn("Text extraction warning:", result.error)
          // Continue without extracted text - server will handle it
        }
      }

      let currentChatId = chatId
      if (chatId === "new") {
        currentChatId = await createNewChat("Document: " + fileName)
        window.history.pushState({}, "", `/chat/${currentChatId}`)
      }

      // Call server-side document processing
      const processResponse = await fetch("/api/process-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath,
          fileName,
          fileType,
          fileSize,
          userId: user?.id,
          extractedText,
        }),
      })

      if (!processResponse.ok) {
        const errorData = await processResponse.json()
        throw new Error(errorData.error || "Failed to process document")
      }

      const { documentId: processedDocumentId } = await processResponse.json()

      // Insert message
      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .insert({
          chat_session_id: currentChatId,
          user_id: user?.id || "",
          content: `Uploaded document: ${fileName}`,
          is_bot: false,
        })
        .select()
        .single()

      if (messageError) {
        console.error("Error creating message:", JSON.stringify(messageError, null, 2))
        throw new Error("Failed to create message: " + messageError.message)
      }

      // Update document with message_id
      console.log("Updating document with:", {
        filePath,
        userId: user?.id,
        messageId: messageData.id,
        documentId: processedDocumentId,
      })

      const { data: documentData, error: documentError } = await supabase
        .from("documents")
        .update({ message_id: messageData.id })
        .eq("id", processedDocumentId)
        .select("id, title, file_type, file_path")
        .single()

      if (documentError || !documentData) {
        console.error("Error updating document record:", JSON.stringify(documentError, null, 2))
        throw new Error(`Document update failed: ${documentError?.message || "Unknown error"}`)
      }

      const newMessage: Message = {
        ...messageData,
        documents: [
          {
            id: documentData.id,
            file_name: documentData.title || "Unknown",
            file_type: documentData.file_type || "",
            file_path: documentData.file_path || "",
          },
        ],
      }

      setMessages((prev) => [...prev, newMessage])

      if (chatId === "new") {
        router.push(`/chat/${currentChatId}`)
      }

      // Trigger bot response
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("No active session")
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          chatId: currentChatId,
          message: `I've uploaded a document called "${fileName}". Please analyze it and provide insights.`,
          userId: user?.id,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to get response from bot")
      }

      const responseData = await response.json()

      if (responseData.success && responseData.message) {
        const botMessage: Message = {
          id: responseData.id || `bot-${Date.now()}`,
          content: responseData.message,
          is_bot: true,
          created_at: new Date().toISOString(),
          documents: [],
        }

        setMessages((prev) => [...prev, botMessage])
      }

      toast({
        description: "Document uploaded and processed successfully",
      })
    } catch (error: any) {
      console.error("Error handling file upload:", JSON.stringify(error, null, 2))
      toast({
        variant: "destructive",
        description: error.message || "Failed to process document",
      })
    } finally {
      setIsUploading(false)
      setShowFileUpload(false)
    }
  }

  const handleFileUploadError = (error: string) => {
    toast({
      variant: "destructive",
      description: error || "Failed to upload document",
    })
    setIsUploading(false)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 custom-scrollbar p-4 md:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-bold mb-2 text-sky-700">Welcome to VIDHI 7</h2>
            <p className="text-gray-600 mb-4">Ask any question for legal advice or upload documents for analysis</p>
            <div className="flex flex-col gap-4 items-center">
              <Button variant="outline" onClick={() => setShowFileUpload(true)} className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Upload a Document
              </Button>
              <p className="text-sm text-gray-500">Supported formats: PDF, DOC, DOCX, TXT, PNG, JPEG (max 5MB)</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
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
            <div ref={messagesEndRef} className="h-0 w-full" />
          </div>
        )}
      </div>

      {showFileUpload && (
        <div className="border-t border-sky-100 p-4 bg-sky-50 sticky bottom-0">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-medium">Upload Document</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFileUpload(false)}
                disabled={isUploading}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <FileUpload
              userId={user?.id || ""}
              onUploadStart={handleFileUploadStart}
              onUploadComplete={handleFileUploadComplete}
              onUploadError={handleFileUploadError}
              disabled={!user || isUploading}
            />
          </div>
        </div>
      )}

      <div className="border-t border-sky-100 p-4 bg-white sticky bottom-0">
        <form onSubmit={handleSendMessage} className="flex flex-col gap-2 max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowFileUpload(!showFileUpload)}
              disabled={isSending || isRecording || isUploading}
              className="border-sky-200 text-sky-700 hover:bg-sky-50 flex-shrink-0"
            >
              <Paperclip className="h-4 w-4" />
              <span className="sr-only">Attach files</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending || isUploading}
              className={`border-sky-200 flex-shrink-0 ${isRecording ? "bg-red-100 text-red-600" : "text-sky-700 hover:bg-sky-50"}`}
            >
              <Mic className={`h-4 w-4 ${isRecording ? "animate-pulse" : ""}`} />
              <span className="sr-only">{isRecording ? "Stop recording" : "Start recording"}</span>
            </Button>

            <div className="relative flex-1">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleTextareaChange}
                placeholder="Ask for legal advice..."
                className="min-h-[60px] max-h-[200px] w-full resize-none border-sky-200 focus-visible:ring-sky-500"
                disabled={isSending || isRecording || isUploading}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage(e)
                  }
                }}
              />
            </div>

            <Button
              type="submit"
              size="icon"
              disabled={isSending || isRecording || isUploading || !input.trim()}
              className="bg-sky-600 hover:bg-sky-700 flex-shrink-0"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span className="sr-only">Send</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
