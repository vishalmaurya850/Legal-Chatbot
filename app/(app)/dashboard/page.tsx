import { createServerSupabaseClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MessageSquare, ThumbsUp, ThumbsDown, Clock, FileText } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { redirect } from "next/navigation"
import { DeleteChatButton } from "@/components/delete-chat-button"

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()

  try {
    // Get the session
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      redirect("/login")
    }

    // Get user stats
    const { count: chatCount } = await supabase
      .from("chat_sessions")
      .select("id", { count: "exact" })
      .eq("user_id", session.user.id)

    const { count: messageCount } = await supabase
      .from("messages")
      .select("id", { count: "exact" })
      .eq("user_id", session.user.id)

    const { count: positiveFeedbackCount } = await supabase
      .from("feedback")
      .select("id", { count: "exact" })
      .eq("user_id", session.user.id)
      .eq("rating", 5)

    const { count: negativeFeedbackCount } = await supabase
      .from("feedback")
      .select("id", { count: "exact" })
      .eq("user_id", session.user.id)
      .eq("rating", 1)

    const { count: documentCount } = await supabase
      .from("user_documents")
      .select("id", { count: "exact" })
      .eq("user_id", session.user.id)

    // Get recent chats
    const { data: recentChats } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(5)

    // Get recent documents
    const { data: recentDocuments } = await supabase
      .from("user_documents")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(3)

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome, {session.user.user_metadata.full_name || "User"}
          </h1>
          <p className="text-muted-foreground">Here&apos;s an overview of your legal chatbot activity</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Chats</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{chatCount || 0}</div>
              <p className="text-xs text-muted-foreground">Chat sessions created</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Messages</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{messageCount || 0}</div>
              <p className="text-xs text-muted-foreground">Messages exchanged</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positive Feedback</CardTitle>
              <ThumbsUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positiveFeedbackCount || 0}</div>
              <p className="text-xs text-muted-foreground">Helpful responses</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Negative Feedback</CardTitle>
              <ThumbsDown className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{negativeFeedbackCount || 0}</div>
              <p className="text-xs text-muted-foreground">Responses needing improvement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documentCount || 0}</div>
              <p className="text-xs text-muted-foreground">Uploaded documents</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <h2 className="text-xl font-bold mb-4">Recent Chats</h2>
            <div className="space-y-4">
              {recentChats && recentChats.length > 0 ? (
                recentChats.map((chat) => (
                  <Card key={chat.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{chat.title}</CardTitle>
                        <DeleteChatButton chatId={chat.id} />
                      </div>
                      <CardDescription>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(chat.created_at).toLocaleDateString()}</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Link href={`/chat/${chat.id}`} className="text-primary hover:underline">
                        Continue this chat
                      </Link>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-center text-muted-foreground">
                      No recent chats found. Start a new chat to get legal assistance.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <Link href="/chat">
                        <Button>Start a New Chat</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-bold mb-4">Recent Documents</h2>
            <div className="space-y-4">
              {recentDocuments && recentDocuments.length > 0 ? (
                recentDocuments.map((doc) => (
                  <Card key={doc.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{doc.file_name}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${doc.processed ? "text-green-600" : "text-amber-600"}`}>
                          {doc.processed ? "Processed" : "Processing..."}
                        </span>
                        <Link href={`/documents/${doc.id}`} className="text-primary hover:underline">
                          View document
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card>
                  <CardContent className="py-4">
                    <p className="text-center text-muted-foreground">
                      No documents found. Upload a document to enhance your legal research.
                    </p>
                    <div className="mt-4 flex justify-center">
                      <Link href="/documents/upload">
                        <Button>Upload Document</Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error) {
    console.error("Error in dashboard page:", error)
    redirect("/login")
  }
}