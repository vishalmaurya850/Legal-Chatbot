"use client"

import { useState } from "react"
import { Avatar } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ThumbsUp, ThumbsDown, FileText, ImageIcon, Paperclip } from "lucide-react"
import { getSupabaseClient } from "@/lib/supabase/client"

type Attachment = {
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
  attachments?: Attachment[]
}

type ChatMessageProps = {
  message: Message
  onFeedback: (isPositive: boolean) => void
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"positive" | "negative" | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const supabase = getSupabaseClient()

  const handleFeedback = (isPositive: boolean) => {
    if (feedbackGiven) return
    onFeedback(isPositive)
    setFeedbackGiven(isPositive ? "positive" : "negative")
  }

  const loadAttachmentUrl = async (attachment: Attachment) => {
    if (attachmentUrls[attachment.id]) return

    const { data } = await supabase.storage.from("attachments").getPublicUrl(attachment.file_path)

    setAttachmentUrls((prev) => ({
      ...prev,
      [attachment.id]: data.publicUrl,
    }))
  }

  const getAttachmentIcon = (fileType: string) => {
    if (fileType.startsWith("image/")) {
      return <ImageIcon className="h-4 w-4" />
    } else if (fileType === "application/pdf" || fileType.includes("document") || fileType.includes("sheet")) {
      return <FileText className="h-4 w-4" />
    }
    return <Paperclip className="h-4 w-4" />
  }

  return (
    <div className={`flex gap-3 ${message.is_bot ? "justify-start" : "justify-end"}`}>
      {message.is_bot && (
        <Avatar className="h-8 w-8">
          <div className="bg-primary text-primary-foreground flex h-full w-full items-center justify-center rounded-full text-sm font-medium">
            AI
          </div>
        </Avatar>
      )}
      <Card
        className={`max-w-[80%] p-3 ${
          message.is_bot ? "bg-secondary text-secondary-foreground" : "bg-primary text-primary-foreground"
        }`}
      >
        <div className="whitespace-pre-wrap">{message.content}</div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((attachment) => {
              if (!attachmentUrls[attachment.id]) {
                loadAttachmentUrl(attachment)
              }

              return (
                <a
                  key={attachment.id}
                  href={attachmentUrls[attachment.id] || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 bg-background text-foreground px-2 py-1 rounded-md text-xs hover:bg-accent"
                  onClick={(e) => {
                    if (!attachmentUrls[attachment.id]) {
                      e.preventDefault()
                    }
                  }}
                >
                  {getAttachmentIcon(attachment.file_type)}
                  <span className="truncate max-w-[150px]">{attachment.file_name}</span>
                </a>
              )
            })}
          </div>
        )}

        {message.is_bot && (
          <div className="mt-2 flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 rounded-full ${
                feedbackGiven === "positive" ? "bg-green-100 text-green-600" : ""
              }`}
              onClick={() => handleFeedback(true)}
              disabled={feedbackGiven !== null}
            >
              <ThumbsUp className="h-3 w-3" />
              <span className="sr-only">Helpful</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={`h-6 w-6 p-0 rounded-full ${feedbackGiven === "negative" ? "bg-red-100 text-red-600" : ""}`}
              onClick={() => handleFeedback(false)}
              disabled={feedbackGiven !== null}
            >
              <ThumbsDown className="h-3 w-3" />
              <span className="sr-only">Not Helpful</span>
            </Button>
          </div>
        )}
      </Card>
    </div>
  )
}