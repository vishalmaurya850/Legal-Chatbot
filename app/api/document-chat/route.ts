import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateGeminiResponse, getRelevantContext } from "@/lib/rag/gemini"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient(cookies())

    // Validate user with getUser()
    const { data: userData, error: userError } = await supabase.auth.getUser()
    if (userError || !userData.user) {
      console.error("Error validating user:", userError)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user exists in users table
    const { data: userRecord, error: userRecordError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userData.user.id)
      .single()

    if (userRecordError || !userRecord) {
      console.error("User not found in users table:", userRecordError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { documentId, message, userId } = await request.json()

    // Verify userId matches authenticated user
    if (userId !== userData.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if document exists and belongs to user
    const { data: document, error: documentError } = await supabase
      .from("user_documents")
      .select("*")
      .eq("id", documentId)
      .eq("user_id", userId)
      .single()

    if (documentError || !document) {
      console.error("Document not found:", documentError)
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    // Check if document is processed
    if (!document.processed) {
      return NextResponse.json({ error: "Document is still being processed" }, { status: 400 })
    }

    // Get relevant context for the query from this specific document
    const context = await getRelevantContext(message, documentId)

    if (!context) {
      return NextResponse.json({
        text: "I couldn't find relevant information in this document to answer your question. Please try asking something else related to the document content.",
      })
    }

    // Generate response using Gemini
    const { text } = await generateGeminiResponse(message, context, [{ role: "user", content: message }])

    return NextResponse.json({ text })
  } catch (error) {
    console.error("Error in document chat API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}