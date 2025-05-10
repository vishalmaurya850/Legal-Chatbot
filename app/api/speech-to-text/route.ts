import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { transcribeAudio } from "@/lib/speech-to-text"

export async function POST(request: NextRequest) {
  try {
    // Create Supabase server client
    const supabase = await createServerSupabaseClient()

    // Get session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get form data with audio file
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    // Convert File to Blob
    const audioBlob = new Blob([await audioFile.arrayBuffer()], { type: audioFile.type })

    // Transcribe audio
    const { transcription, id } = await transcribeAudio(audioBlob, session.user.id)

    return NextResponse.json({
      success: true,
      transcription,
      transcriptionId: id,
    })
  } catch (error) {
    console.error("Error in speech-to-text API:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}