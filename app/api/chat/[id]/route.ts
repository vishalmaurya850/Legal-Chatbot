import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function DELETE(request: Request, context: { params: { id: string } }) {
  try {
    const { params } = context; // Destructure context
    const chatId = params.id; // Access params.id directly

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First delete all messages associated with this chat
    const { error: messagesError } = await supabase
      .from("messages")
      .delete()
      .eq("chat_session_id", chatId);

    if (messagesError) {
      console.error("Error deleting messages:", messagesError);
      return NextResponse.json({ error: "Failed to delete messages" }, { status: 500 });
    }

    // Then delete the chat session
    const { error: chatError } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", chatId)
      .eq("user_id", session.user.id);

    if (chatError) {
      console.error("Error deleting chat:", chatError);
      return NextResponse.json({ error: "Failed to delete chat" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in delete chat API:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}