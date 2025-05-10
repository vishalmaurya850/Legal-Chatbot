"use client"

import { useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { Button } from "@/components/ui/button"
import { ThumbsUp, ThumbsDown } from "lucide-react"
import ReactMarkdown, { Components } from "react-markdown"

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

interface ChatMessageProps {
  message: Message
  onFeedback?: (isPositive: boolean) => void
}

export function ChatMessage({ message, onFeedback }: ChatMessageProps) {
  const [feedbackGiven, setFeedbackGiven] = useState<"positive" | "negative" | null>(null)
  const isImage = (type: string) => type.startsWith("image/")
  const isPdf = (type: string) => type === "application/pdf"

  const handleFeedback = (isPositive: boolean) => {
    if (onFeedback) {
      onFeedback(isPositive)
      setFeedbackGiven(isPositive ? "positive" : "negative")
    }
  }

  return (
    <div className={`flex ${message.is_bot ? "justify-start" : "justify-end"} mb-4`}>
      <div
        className={`rounded-lg p-4 max-w-[80%] ${message.is_bot ? "bg-sky-50 text-gray-800" : "bg-sky-600 text-white"}`}
      >
        <div className="prose max-w-none">
          {message.is_bot ? (
            <ReactMarkdown
              components={{
                a: ({ node, ...props }: { node?: any; [key: string]: any }) => (
                  <a {...props} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline" />
                ),
                p: ({ node, ...props }: { node?: any; [key: string]: any }) => <p {...props} className="mb-2 last:mb-0" />,
                ul: ({ node, ...props }: { node?: any; [key: string]: any }) => <ul {...props} className="list-disc pl-5 mb-2" />,
                ol: ({ node, ...props }: { node?: any; [key: string]: any }) => <ol {...props} className="list-decimal pl-5 mb-2" />,
                li: ({ node, ...props }: { node?: any; [key: string]: any }) => <li {...props} className="mb-1" />,
                h1: ({ node, ...props }: { node?: any; [key: string]: any }) => <h1 {...props} className="text-xl font-bold mb-2" />,
                h2: ({ node, ...props }: { node?: any; [key: string]: any }) => <h2 {...props} className="text-lg font-bold mb-2" />,
                h3: ({ node, ...props }: { node?: any; [key: string]: any }) => <h3 {...props} className="text-base font-bold mb-2" />,
                code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
                  inline ? (
                    <code {...props} className="bg-sky-100 text-sky-800 px-1 py-0.5 rounded">
                      {children}
                    </code>
                  ) : (
                    <code {...props} className="block bg-sky-100 text-sky-800 p-2 rounded overflow-x-auto">
                      {children}
                    </code>
                  ),
                pre: ({ children, ...props }: { children?: React.ReactNode }) => (
                  <pre {...props} className="bg-sky-100 text-sky-800 p-2 rounded overflow-x-auto mb-2">
                    {children}
                  </pre>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((attachment) => (
              <div key={attachment.id}>
                {isImage(attachment.file_type) ? (
                  <img
                    src={attachment.file_path || "/placeholder.svg"}
                    alt={attachment.file_name}
                    className="max-w-full rounded"
                  />
                ) : isPdf(attachment.file_type) ? (
                  <a
                    href={attachment.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-2 bg-sky-100 text-sky-700 rounded hover:bg-sky-200"
                  >
                    <svg
                      className="w-6 h-6 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                      />
                    </svg>
                    {attachment.file_name}
                  </a>
                ) : (
                  <a
                    href={attachment.file_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center p-2 bg-sky-100 text-sky-700 rounded hover:bg-sky-200"
                  >
                    <svg
                      className="w-6 h-6 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    {attachment.file_name}
                  </a>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-1 flex items-center justify-between text-xs">
          <span className={message.is_bot ? "text-gray-500" : "text-sky-200"}>
            {formatDistanceToNow(new Date(message.created_at), {
              addSuffix: true,
            })}
          </span>

          {message.is_bot && onFeedback && (
            <div className="flex space-x-1">
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 w-6 p-0 rounded-full ${
                  feedbackGiven === "positive" ? "bg-green-100 text-green-600" : "hover:bg-sky-100 text-gray-500"
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
                className={`h-6 w-6 p-0 rounded-full ${
                  feedbackGiven === "negative" ? "bg-red-100 text-red-600" : "hover:bg-sky-100 text-gray-500"
                }`}
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
