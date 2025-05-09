import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { generateGeminiResponse, getRelevantContext } from "@/lib/rag/gemini"
import { cookies } from "next/headers"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()

    // Validate user with getUser()
    const { data: userData, error: userError } = await (await supabase).auth.getUser()
    if (userError || !userData.user) {
      console.error("Error validating user:", userError)
      // if (userError?.message.includes("Auth session missing")) {
      //   return NextResponse.json({ error: "Unauthorized: Session missing" }, { status: 401 })
      // }
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

    const { chatId, message, userId } = await request.json()

    // Verify userId matches authenticated user
    if (userId !== userData.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check for empty message
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 })
    }

    // Check for harmful content in the user message
    const sensitiveContentPatterns = [
      /porn|sex|nude|naked|xxx/i,
      /hack|exploit|steal|illegal/i,
      /terrorist|bomb|attack|kill/i,
      /hate|racist|nazi|supremacy/i,
    ]

    const containsSensitiveContent = sensitiveContentPatterns.some((pattern) => pattern.test(message))

    if (containsSensitiveContent) {
      // Save user message
      const { error: userMessageError } = await (await supabase).from("messages").insert({
        chat_session_id: chatId,
        user_id: userId,
        content: message,
        is_bot: false,
      })

      if (userMessageError) {
        console.error("Error saving user message:", userMessageError)
        return NextResponse.json({ error: "Failed to save user message" }, { status: 500 })
      }

      // Save bot response about sensitive content
      const { data: botMessage, error: botMessageError } = await supabase
        .from("messages")
        .insert({
          chat_session_id: chatId,
          user_id: userId,
          content:
            "I apologize, but I cannot respond to queries that may involve sensitive, harmful, or inappropriate content. Please ask a question related to the Indian Constitution.",
          is_bot: true,
        })
        .select()
        .single()

      if (botMessageError) {
        console.error("Error saving bot message:", botMessageError)
        return NextResponse.json({ error: "Failed to save bot message" }, { status: 500 })
      }

      return NextResponse.json({ message: botMessage })
    }

    // Get chat history
    const { data: messagesData } = await supabase
      .from("messages")
      .select("content, is_bot")
      .eq("chat_session_id", chatId)
      .order("created_at", { ascending: true })
      .limit(10) // Limit to recent messages for context window

    const chatHistory =
      messagesData?.map((msg) => ({
        role: msg.is_bot ? "assistant" : ("user" as "assistant" | "user"),
        content: msg.content,
      })) || []

    // Get relevant context for the query
    const context = await getRelevantContext(message)

    // Generate response using Gemini
    const { text } = await generateGeminiResponse(message, context, chatHistory)

    // Save user message
    const { error: userMessageError } = await supabase.from("messages").insert({
      chat_session_id: chatId,
      user_id: userId,
      content: message,
      is_bot: false,
    })

    if (userMessageError) {
      console.error("Error saving user message:", userMessageError)
      return NextResponse.json({ error: "Failed to save user message" }, { status: 500 })
    }

    // Save bot response
    const { data: botMessage, error: botMessageError } = await supabase
      .from("messages")
      .insert({
        chat_session_id: chatId,
        user_id: userId,
        content: text,
        is_bot: true,
      })
      .select()
      .single()

    if (botMessageError) {
      console.error("Error saving bot message:", botMessageError)
      return NextResponse.json({ error: "Failed to save bot message" }, { status: 500 })
    }

    // Update chat title if it's the first message
    if (messagesData?.length === 0 || messagesData?.length === 1) {
      const title = message.substring(0, 30) + (message.length > 30 ? "..." : "")
      await supabase.from("chat_sessions").update({ title }).eq("id", chatId)
    }

    return NextResponse.json({ message: botMessage })
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
} 