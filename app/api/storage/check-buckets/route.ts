import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // Check if audio bucket exists
    const { data: audioBucket, error: audioError } = await supabase.storage.getBucket("audio")

    if (audioError) {
      // Create audio bucket
      const { error: createAudioError } = await supabase.storage.createBucket("audio", {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
      })

      if (createAudioError) {
        console.error("Error creating audio bucket:", createAudioError)
      }
    }

    // Check if documents bucket exists
    const { data: documentsBucket, error: documentsError } = await supabase.storage.getBucket("documents")

    if (documentsError) {
      // Create documents bucket
      const { error: createDocumentsError } = await supabase.storage.createBucket("documents", {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024, // 5MB
      })

      if (createDocumentsError) {
        console.error("Error creating documents bucket:", createDocumentsError)
      }
    }

    return NextResponse.json({
      success: true,
      buckets: {
        audio: audioBucket ? true : !audioError,
        documents: documentsBucket ? true : !documentsError,
      },
    })
  } catch (error: any) {
    console.error("Error checking buckets:", error)
    return NextResponse.json({ error: error.message || "Failed to check storage buckets" }, { status: 500 })
  }
}