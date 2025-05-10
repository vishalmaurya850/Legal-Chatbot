import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/types/supabase"

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey)

// Function to transcribe audio using Google Speech-to-Text API
export async function transcribeAudio(audioBlob: Blob, userId: string): Promise<{ transcription: string; id: string }> {
  try {
    // Convert blob to base64
    const buffer = await audioBlob.arrayBuffer()
    const base64Audio = Buffer.from(buffer).toString("base64")

    // Call Google Speech-to-Text API
    const response = await fetch("https://speech.googleapis.com/v1/speech:recognize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GOOGLE_API_KEY}`,
      },
      body: JSON.stringify({
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US",
          model: "default",
          enableAutomaticPunctuation: true,
        },
        audio: {
          content: base64Audio,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`Speech-to-Text API error: ${response.statusText}`)
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      throw new Error("No transcription results returned")
    }

    const transcription = data.results.map((result: any) => result.alternatives[0].transcript).join(" ")

    // Save audio file to Supabase Storage
    const fileName = `speech/${userId}/${Date.now()}.webm`
    const { error: uploadError } = await supabase.storage.from("audio-uploads").upload(fileName, audioBlob)

    if (uploadError) {
      console.error("Error uploading audio:", uploadError)
      throw new Error(`Error uploading audio: ${uploadError.message}`)
    }

    // Get the public URL
    const { data: urlData } = supabase.storage.from("audio-uploads").getPublicUrl(fileName)

    // Save transcription to database
    const { data: transcriptionData, error: dbError } = await supabase
      .from("speech_transcriptions")
      .insert({
        user_id: userId,
        audio_file_path: urlData.publicUrl,
        transcription,
        language_code: "en-US",
        duration_seconds: buffer.byteLength / 16000, // Approximate duration
      })
      .select("id")
      .single()

    if (dbError) {
      console.error("Error saving transcription:", dbError)
      throw new Error(`Error saving transcription: ${dbError.message}`)
    }

    return {
      transcription,
      id: transcriptionData.id,
    }
  } catch (error) {
    console.error("Error in transcribeAudio:", error)
    throw error
  }
}

// Function to get transcription by ID
export async function getTranscription(id: string): Promise<string> {
  try {
    const { data, error } = await supabase.from("speech_transcriptions").select("transcription").eq("id", id).single()

    if (error) {
      throw error
    }

    return data.transcription
  } catch (error) {
    console.error("Error getting transcription:", error)
    throw error
  }
}