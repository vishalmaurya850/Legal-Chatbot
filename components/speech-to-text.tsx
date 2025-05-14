"use client"

import { useState, useRef } from "react"
import { Mic, MicOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"

interface SpeechToTextProps {
  onTranscription: (text: string) => void
  isDisabled?: boolean
}

export function SpeechToText({ onTranscription, isDisabled = false }: SpeechToTextProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        setIsProcessing(true)
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          await processAudio(audioBlob)
        } catch (error) {
          console.error("Error processing audio:", error)
          toast({
            variant: "destructive",
            description: "Failed to process speech. Please try again.",
          })
        } finally {
          setIsProcessing(false)
        }

        // Stop all tracks in the stream
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("Error accessing microphone:", error)
      toast({
        variant: "destructive",
        description: "Could not access your microphone. Please check permissions.",
      })
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)

      const response = await fetch("/api/speech-to-text", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const data = await response.json()
      if (data.transcription) {
        onTranscription(data.transcription)
      } else {
        toast({
          description: "No speech detected. Please try again.",
        })
      }
    } catch (error) {
      console.error("Error transcribing audio:", error)
      throw error
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      disabled={isDisabled || isProcessing}
      onClick={isRecording ? stopRecording : startRecording}
      className={`border-sky-200 ${
        isRecording ? "bg-red-100 text-red-600 hover:bg-red-200" : "text-sky-700 hover:bg-sky-50"
      }`}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isRecording ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
      <span className="sr-only">{isRecording ? "Stop recording" : "Start recording"}</span>
    </Button>
  )
}
