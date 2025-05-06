import { supabase } from "./supabase/client"

export async function uploadFile(file: File, messageId: string, userId: string): Promise<{ path: string; error: any }> {
  try {
    const fileExt = file.name.split(".").pop()
    const fileName = `${userId}/${messageId}/${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `attachments/${fileName}`

    const { error } = await supabase.storage.from("attachments").upload(filePath, file)

    if (error) {
      return { path: "", error }
    }

    // Insert into attachments table
    const { error: dbError } = await supabase.from("attachments").insert({
      message_id: messageId,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: filePath,
    })

    return { path: filePath, error: dbError }
  } catch (error) {
    return { path: "", error }
  }
}

export async function getFileUrl(filePath: string): Promise<string> {
  const { data } = await supabase.storage.from("attachments").getPublicUrl(filePath)
  return data.publicUrl
}
