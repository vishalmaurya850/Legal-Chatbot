"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ThumbsUp, ThumbsDown, User, Bot, FileText, FileImage, File, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getSupabaseClient } from "@/lib/supabase/client"
import ReactMarkdown from "react-markdown"

interface ChatMessageProps {
  message: {
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
  onFeedback?: (isPositive: boolean) => void
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"positive" | "negative" | null>(null)
  const supabase = getSupabaseClient()

  const handleFeedback = (isPositive: boolean) => {
    setFeedbackGiven(isPositive ? "positive" : "negative")
    if (onFeedback) {
      onFeedback(isPositive)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes("pdf")) return <FileText className="h-4 w-4" />
    if (fileType.includes("image")) return <FileImage className="h-4 w-4" />
    return <File className="h-4 w-4" />
  }

  const getFileUrl = async (filePath: string) => {
    const { data } = await supabase.storage.from("documents").getPublicUrl(filePath)
    return data.publicUrl
  }

  const handleFileClick = async (filePath: string, fileName: string) => {
    const url = await getFileUrl(filePath)
    window.open(url, "_blank")
  }

  return (
    <div className={cn("flex", message.is_bot ? "justify-start" : "justify-end")}>
      <div className={cn("flex flex-col max-w-[80%] space-y-2", message.is_bot ? "items-start" : "items-end")}>
        <div className="flex items-start gap-3">
          {message.is_bot && (
            <div className="flex-shrink-0 rounded-full bg-sky-100 p-2">
              <Bot className="h-5 w-5 text-sky-700" />
            </div>
          )}

          <div className={cn("rounded-lg p-4", message.is_bot ? "bg-sky-50 text-sky-700" : "bg-sky-600 text-white")}>
            {message.attachments && message.attachments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm">{message.content}</p>
                <div className="space-y-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className={cn(
                        "flex items-center gap-2 p-2 rounded cursor-pointer",
                        message.is_bot ? "bg-white" : "bg-sky-700",
                      )}
                      onClick={() => handleFileClick(attachment.file_path, attachment.file_name)}
                    >
                      {getFileIcon(attachment.file_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{attachment.file_name}</p>
                      </div>
                      <ExternalLink className="h-4 w-4 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown>{message.content}</ReactMarkdown>
              </div>
            )}
          </div>

          {!message.is_bot && (
            <div className="flex-shrink-0 rounded-full bg-sky-100 p-2">
              <User className="h-5 w-5 text-sky-700" />
            </div>
          )}
        </div>

        <div
          className={cn("flex items-center text-xs text-gray-500", message.is_bot ? "justify-start" : "justify-end")}
        >
          <span>{format(new Date(message.created_at), "MMM d, h:mm a")}</span>

          {message.is_bot && (
            <div className="flex items-center ml-2">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 rounded-full", feedbackGiven === "positive" && "bg-green-100 text-green-600")}
                onClick={() => handleFeedback(true)}
                disabled={feedbackGiven !== null}
              >
                <ThumbsUp className="h-3 w-3" />
                <span className="sr-only">Helpful</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-6 w-6 rounded-full", feedbackGiven === "negative" && "bg-red-100 text-red-600")}
                onClick={() => handleFeedback(false)}
                disabled={feedbackGiven !== null}
              >
                <ThumbsDown className="h-3 w-3" />
                <span className="sr-only">Not Helpful</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}