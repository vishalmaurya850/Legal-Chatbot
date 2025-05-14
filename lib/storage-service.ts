import { getSupabaseClient } from "@/lib/supabase/client"
import { v4 as uuidv4 } from "uuid"

// File size limit in bytes (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024

// Supported file types
export const SUPPORTED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]

export const SUPPORTED_AUDIO_TYPES = ["audio/wav", "audio/webm", "audio/mp3", "audio/mpeg"]

export type UploadResult = {
  success: boolean
  filePath?: string
  fileUrl?: string
  error?: string
}

/**
 * Uploads a file to Supabase Storage
 */
export async function uploadFile(
  file: File | Blob,
  bucket: string,
  folder: string,
  userId: string,
): Promise<UploadResult> {
  const supabase = getSupabaseClient()

  try {
    if (file.size > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
      }
    }

    let fileName: string
    let originalFileName: string
    if (file instanceof File) {
      originalFileName = file.name
      const fileExt = file.name.split(".").pop() || "bin"
      fileName = `${uuidv4()}.${fileExt}`
    } else {
      originalFileName = `blob-${uuidv4()}`
      const fileType = file.type || "audio/wav"
      const ext = fileType.split("/")[1] || "bin"
      fileName = `${uuidv4()}.${ext}`
    }

    const filePath = `${userId}/${fileName}`

    console.log(`Uploading file to bucket: ${bucket}, path: ${filePath}, userId: ${userId}`)
    const { error: uploadError, data } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "application/octet-stream",
      })

    if (uploadError) {
      console.error("Storage upload error:", uploadError)
      return {
        success: false,
        error: uploadError.message || "Failed to upload file",
      }
    }

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath)

    console.log("File uploaded successfully:", { path: data.path, url: urlData.publicUrl })

    return {
      success: true,
      filePath,
      fileUrl: urlData.publicUrl,
    }
  } catch (error: any) {
    console.error("Error in uploadFile:", error)
    return {
      success: false,
      error: error.message || "An unexpected error occurred during file upload",
    }
  }
}

/**
 * Uploads an audio file to Supabase Storage
 */
export async function uploadAudio(file: File | Blob, userId: string): Promise<UploadResult> {
  let fileToUpload: File | Blob = file

  if (file instanceof Blob && !(file instanceof File)) {
    if (!file.type || file.type === "") {
      fileToUpload = new Blob([file], { type: "audio/wav" })
    }
  } else if (file instanceof File) {
    if (!SUPPORTED_AUDIO_TYPES.includes(file.type) && file.type !== "") {
      return {
        success: false,
        error: `Unsupported audio format. Supported formats: ${SUPPORTED_AUDIO_TYPES.join(", ")}`,
      }
    }
  }

  return uploadFile(fileToUpload, "audio", "recordings", userId)
}

/**
 * Uploads a document file to Supabase Storage and logs to documents table
 */
export async function uploadDocument(file: File, userId: string): Promise<UploadResult> {
  const supabase = getSupabaseClient()

  if (!SUPPORTED_DOCUMENT_TYPES.includes(file.type)) {
    return {
      success: false,
      error: `Unsupported document format. Supported formats: PDF, DOC, DOCX, TXT`,
    }
  }

  try {
    const uploadResult = await uploadFile(file, "documents", "uploads", userId)

    if (!uploadResult.success || !uploadResult.filePath) {
      return uploadResult
    }

    console.log("Inserting document record for user:", userId, "path:", uploadResult.filePath)
    const { error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        title: file.name,
        file_path: uploadResult.filePath,
        file_type: file.type,
        file_size: file.size,
        status: "pending",
        message_id: null, // Set initially to null
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error("Error inserting document record:", dbError)
      await supabase.storage.from("documents").remove([uploadResult.filePath])
      return {
        success: false,
        error: dbError.message || "Failed to log document in database",
      }
    }

    console.log("Document record inserted successfully")
    return uploadResult
  } catch (error: any) {
    console.error("Error in uploadDocument:", error)
    return {
      success: false,
      error: error.message || "Failed to upload and log document",
    }
  }
}