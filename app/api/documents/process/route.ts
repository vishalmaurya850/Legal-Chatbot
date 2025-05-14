import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { processDocument } from "@/lib/document-service"

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { filePath, fileName, fileType, fileSize, userId } = await request.json()

    if (!filePath || !fileName || !fileType || !fileSize || !userId) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Process the document
    const result = await processDocument(filePath, fileName, fileType, fileSize, userId, true)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true, documentId: result.documentId })
  } catch (error: any) {
    console.error("Error processing document:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}