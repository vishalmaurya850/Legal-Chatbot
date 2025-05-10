"use client"

import { useState, useRef } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"

interface SpeechToTextProps {
  onTranscription: (text: string) => void
  isDisabled?: boolean
}

export function SpeechToText({ onTranscription, isDisabled = false }: SpeechToTextProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { toast } = useToast()

  const startRecording = async () => {
    try {
      audioChunksRef.current = []

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      mediaRecorderRef.current = mediaRecorder

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)

        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })

          // Create form data
          const formData = new FormData()
          formData.append("audio", audioBlob, "recording.webm")

          // Send to API
          const response = await fetch("/api/speech-to-text", {
            method: "POST",
            body: formData,
          })

          if (!response.ok) {
            throw new Error("Failed to transcribe audio")
          }

          const data = await response.json()

          if (data.success && data.transcription) {
            onTranscription(data.transcription)
          } else {
            toast({
              title: "Transcription Error",
              description: "Could not transcribe audio. Please try again.",
              variant: "destructive",
            })
          }
        } catch (error) {
          console.error("Error processing audio:", error)
          toast({
            title: "Error",
            description: "Failed to process audio. Please try again.",
            variant: "destructive",
          })
        } finally {
          setIsProcessing(false)
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)

      toast({
        title: "Recording started",
        description: "Speak clearly into your microphone.",
      })
    } catch (error) {
      console.error("Error starting recording:", error)
      toast({
        title: "Microphone Error",
        description: "Could not access microphone. Please check permissions.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      toast({
        title: "Recording stopped",
        description: "Processing your speech...",
      })
    }
  }

  return (
    <div className="flex items-center justify-center">
      {isProcessing ? (
        <Button variant="outline" size="icon" disabled className="h-10 w-10 rounded-full border-sky-500">
          <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
          <span className="sr-only">Processing</span>
        </Button>
      ) : isRecording ? (
        <Button
          onClick={stopRecording}
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-red-500 bg-red-100 hover:bg-red-200"
          disabled={isDisabled}
        >
          <MicOff className="h-5 w-5 text-red-500" />
          <span className="sr-only">Stop Recording</span>
        </Button>
      ) : (
        <Button
          onClick={startRecording}
          variant="outline"
          size="icon"
          className="h-10 w-10 rounded-full border-sky-500 hover:bg-sky-100"
          disabled={isDisabled}
        >
          <Mic className="h-5 w-5 text-sky-500" />
          <span className="sr-only">Start Recording</span>
        </Button>
      )}
    </div>
  )
}