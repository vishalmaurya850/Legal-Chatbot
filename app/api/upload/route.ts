import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
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

    const formData = await request.formData()
    const file = formData.get("file") as File
    const messageId = formData.get("messageId") as string

    if (!file || !messageId) {
      return NextResponse.json({ error: "File and messageId are required" }, { status: 400 })
    }

    const fileExt = file.name.split(".").pop()
    const fileName = `${userData.user.id}/${messageId}/${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = `attachments/${fileName}`

    const { error: uploadError } = await supabase.storage.from("attachments").upload(filePath, file)

    if (uploadError) {
      console.error("Error uploading file:", uploadError)
      return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
    }

    const { data: attachment, error: dbError } = await supabase
      .from("attachments")
      .insert({
        message_id: messageId,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
      })
      .select()
      .single()

    if (dbError) {
      console.error("Error saving attachment metadata:", dbError)
      return NextResponse.json({ error: "Failed to save attachment metadata" }, { status: 500 })
    }

    return NextResponse.json({ attachment })
  } catch (error) {
    console.error("Error in upload API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}