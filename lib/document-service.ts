import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateEmbedding } from "@/lib/rag/gemini";
import { extractTextFromFile } from "@/lib/text-extraction";

// Supported MIME types
const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
];

type ProcessDocumentResult = {
  success: boolean;
  documentId?: string;
  error?: string;
};

export async function processDocument(
  filePath: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  userId: string,
  generateEmbeddings = true,
  extractText: boolean = true,
  extractedText?: string,
): Promise<ProcessDocumentResult> {
  console.log("processDocument called with:", { filePath, fileName, fileType, fileSize, userId, hasExtractedText: !!extractedText });
  const supabase = await createServerSupabaseClient();

  if (!SUPPORTED_DOCUMENT_TYPES.includes(fileType)) {
    const error = `Unsupported file type: ${fileType}`;
    console.error(error);
    return { success: false, error };
  }

  try {
    const { data: documentData, error: documentError } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        title: fileName,
        file_path: filePath,
        file_type: fileType,
        file_size: fileSize,
        status: "processing",
        processed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (documentError || !documentData) {
      console.error("Error creating document record:", JSON.stringify(documentError, null, 2));
      return {
        success: false,
        error: documentError?.message || "Failed to create document record",
      };
    }

    const documentId = documentData.id;

    let text: string;
    if (["image/png", "image/jpeg", "image/jpg"].includes(fileType) && extractedText) {
      console.log("Using client-extracted text for image");
      text = extractedText;
    } else if (extractText) {
      console.log("Downloading file from storage:", filePath);
      const { data: fileData, error: fileError } = await supabase.storage
        .from("documents")
        .download(filePath);

      if (fileError || !fileData) {
        console.error("Error downloading file:", JSON.stringify(fileError, null, 2));
        await supabase
          .from("documents")
          .update({ status: "failed", error_message: fileError?.message || "Failed to download file" })
          .eq("id", documentId);
        return {
          success: false,
          error: fileError?.message || "Failed to download file",
        };
      }

      const file = new File([fileData], fileName, { type: fileType });
      console.log("Calling extractTextFromFile for:", fileName);
      const textResult = await extractTextFromFile(file);
      if (!textResult.success || !textResult.text) {
        console.error("Text extraction failed:", textResult.error);
        await supabase
          .from("documents")
          .update({
            status: "failed",
            error_message: textResult.error || "Failed to extract text from document",
          })
          .eq("id", documentId);
        return {
          success: false,
          error: textResult.error || "Failed to extract text from document",
        };
      }
      text = textResult.text;
    } else {
      text = "";
    }

    console.log("Updating document with extracted text, length:", text.length);
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        content: text,
        status: generateEmbeddings ? "embedding" : "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    if (updateError) {
      console.error("Error updating document with text:", JSON.stringify(updateError, null, 2));
      await supabase
        .from("documents")
        .update({ status: "failed", error_message: "Failed to update document with text" })
        .eq("id", documentId);
      return {
        success: false,
        error: updateError.message || "Failed to update document with text",
      };
    }

    if (!generateEmbeddings) {
      console.log("No embeddings requested, marking document as completed");
      await supabase
        .from("documents")
        .update({ processed: true, status: "completed", updated_at: new Date().toISOString() })
        .eq("id", documentId);
      return {
        success: true,
        documentId,
      };
    }

    const chunkSize = 1000;
    const overlap = 200;
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const chunk = text.substring(i, i + chunkSize).trim();
      if (chunk.length > 100) {
        chunks.push(chunk);
      }
    }
    console.log("Text split into", chunks.length, "chunks");

    const embeddingPromises = chunks.map(async (chunk, index) => {
      try {
        console.log(`Generating embedding for chunk ${index}`);
        const embedding = await generateEmbedding(chunk);
        if (!embedding || !Array.isArray(embedding) || embedding.length !== 1024) {
          throw new Error("Invalid embedding: must be a 1024-dimensional array");
        }

        const { error: embedError } = await supabase
          .from("document_embeddings")
          .insert({
            document_id: documentId,
            content: chunk,
            embedding: embedding,
            chunk_index: index,
            metadata: {
              file_name: fileName,
              file_type: fileType,
              chunk_length: chunk.length,
              created_at: new Date().toISOString(),
            },
            created_at: new Date().toISOString(),
          });

        if (embedError) {
          console.error(`Error storing embedding for chunk ${index}:`, JSON.stringify(embedError, null, 2));
          return { success: false, chunkIndex: index, error: embedError.message };
        }
        return { success: true, chunkIndex: index };
      } catch (error: any) {
        console.error(`Error generating embedding for chunk ${index}:`, error);
        return { success: false, chunkIndex: index, error: error.message || "Embedding generation failed" };
      }
    });

    const concurrencyLimit = 5;
    const embeddingResults: { success: boolean; chunkIndex: number; error?: string }[] = [];
    for (let i = 0; i < embeddingPromises.length; i += concurrencyLimit) {
      const batch = embeddingPromises.slice(i, i + concurrencyLimit);
      embeddingResults.push(...(await Promise.all(batch)));
    }

    const failedChunks = embeddingResults.filter((result: { success: boolean }) => !result.success);
    if (failedChunks.length > 0) {
      console.warn(`Embedding failed for ${failedChunks.length} chunks:`, failedChunks);
      await supabase
        .from("documents")
        .update({
          status: failedChunks.length === chunks.length ? "failed" : "completed",
          error_message:
            failedChunks.length === chunks.length
              ? "Failed to generate any embeddings"
              : `Failed to generate embeddings for ${failedChunks.length} chunks`,
          processed: failedChunks.length < chunks.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    } else {
      console.log("All embeddings generated successfully");
      await supabase
        .from("documents")
        .update({
          status: "completed",
          processed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", documentId);
    }

    return {
      success: true,
      documentId,
    };
  } catch (error: any) {
    console.error("Error processing document:", JSON.stringify(error, null, 2));
    return {
      success: false,
      error: error.message || "An unexpected error occurred during document processing",
    };
  }
}