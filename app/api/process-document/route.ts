import { type NextRequest, NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateEmbedding } from "@/lib/rag/gemini"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()

    // Get the session to verify authentication
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const { filePath, fileName, fileType, fileSize, userId, extractedText } = await request.json()

    if (!filePath || !fileName || !fileType || !userId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log("Processing document:", { filePath, fileName, fileType, userId })

    // Check if document already exists in database
    const { data: existingDoc } = await supabase
      .from("documents")
      .select("id, status")
      .eq("file_path", filePath)
      .eq("user_id", userId)
      .maybeSingle()

    let documentId: string

    if (existingDoc) {
      documentId = existingDoc.id
      console.log("Document already exists in database, id:", documentId)

      // Update status if needed
      if (existingDoc.status === "pending") {
        await supabase.from("documents").update({ status: "processing" }).eq("id", documentId)
      }
    } else {
      // Create document record
      const { data: newDoc, error: insertError } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          title: fileName,
          file_path: filePath,
          file_type: fileType,
          file_size: fileSize,
          status: "processing",
        })
        .select()
        .single()

      if (insertError) {
        console.error("Error creating document record:", insertError)
        return NextResponse.json({ error: "Failed to create document record" }, { status: 500 })
      }

      documentId = newDoc.id
      console.log("Created new document record, id:", documentId)
    }

    // Process text content if provided
    if (extractedText) {
      console.log("Using pre-extracted text for document")

      // Update document with extracted text
      await supabase
        .from("documents")
        .update({
          content: extractedText,
          status: "processed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId)

      // Generate embeddings
      try {
        console.log("Generating embeddings for document")
        const embedding = await generateEmbedding(extractedText)

        if (embedding) {
          // Store embedding
          await supabase.from("document_embeddings").insert({
            document_id: documentId,
            content: extractedText,
            embedding,
          })

          console.log("Embeddings generated and stored successfully")
        }
      } catch (embeddingError) {
        console.error("Error generating embeddings:", embeddingError)
        // Continue without embeddings - don't fail the whole process
      }
    } else {
      // For server-side text extraction (to be implemented)
      console.log("No pre-extracted text provided, document will be processed asynchronously")
    }

    return NextResponse.json({ success: true, documentId })
  } catch (error: any) {
    console.error("Error processing document:", error)
    return NextResponse.json(
      { error: error.message || "An error occurred while processing the document" },
      { status: 500 },
    )
  }
}
