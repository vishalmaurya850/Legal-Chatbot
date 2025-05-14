import { createServerSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Upload, Clock, Check } from "lucide-react"

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return null
  }

  // Check if user exists in the users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from("users")
    .select("*")
    .eq("id", session.user.id)
    .single()

  // If user doesn't exist, create them
  if (userRecordError || !userRecord) {
    console.error("User not found in users table:", userRecordError)

    // Create user record
    const { error: insertError } = await supabase.from("users").insert({
      id: session.user.id,
      full_name: session.user.email || "Unknown User",
    })

    if (insertError) {
      console.error("Error creating user record:", insertError)
      return (
        <div className="p-8 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error Setting Up Your Account</h1>
          <p className="mb-4">We encountered an issue while setting up your account. Please try refreshing the page.</p>
          <Button onClick={() => window.location.reload()}>Refresh Page</Button>
        </div>
      )
    }
  }

  // Get user documents
  const { data: documents } = await supabase
    .from("user_documents")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Manage your uploaded legal documents</p>
        </div>
        <Link href="/documents/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </Link>
      </div>

      {documents && documents.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg truncate" title={doc.file_name}>
                    {doc.file_name}
                  </CardTitle>
                  <div className="flex items-center">
                    {doc.processed ? (
                      <Check className="h-5 w-5 text-green-600" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-600" />
                    )}
                  </div>
                </div>
                <CardDescription>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    <span>{(doc.file_size / 1024 / 1024).toFixed(2)} MB</span>
                    <span className="mx-1">•</span>
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
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground mb-4">
              Upload legal documents to enhance your research and get more accurate answers.
            </p>
            <Link href="/documents/upload">
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Your First Document
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}