import { notFound } from "next/navigation"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, ArrowLeft, Clock, Check } from "lucide-react"
import { DocumentChat } from "@/components/document-chat"
import { cookies } from "next/headers"

export default async function DocumentPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createServerSupabaseClient(cookies())

  // Validate user with getUser()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) {
    console.error("Error validating user:", userError)
    notFound()
  }

  // Verify user exists in users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from("users")
    .select("id")
    .eq("id", userData.user.id)
    .single()

  if (userRecordError || !userRecord) {
    console.error("User not found in users table:", userRecordError)
    notFound()
  }

  // Check if document exists and belongs to user
  const { data: document, error } = await supabase
    .from("user_documents")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", userData.user.id)
    .single()

  if (error || !document) {
    console.error("Document not found:", error)
    notFound()
  }

  // Get document embedding count
  const { count } = await supabase
    .from("document_embeddings")
    .select("*", { count: "exact", head: true })
    .eq("document_id", document.id)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Link href="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Documents
          </Button>
        </Link>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{document.file_name}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
            <span className="mx-1">•</span>
            <Clock className="h-4 w-4" />
            <span>{new Date(document.created_at).toLocaleDateString()}</span>
            <span className="mx-1">•</span>
            {document.processed ? (
              <span className="flex items-center text-green-600">
                <Check className="h-4 w-4 mr-1" />
                Processed
              </span>
            ) : (
              <span className="flex items-center text-amber-600">
                <Clock className="h-4 w-4 mr-1" />
                Processing...
              </span>
            )}
          </div>
        </div>
      </div>

      {document.processed ? (
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium">File Type</h3>
                  <p className="text-sm text-muted-foreground">{document.file_type}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Uploaded On</h3>
                  <p className="text-sm text-muted-foreground">{new Date(document.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Processing Status</h3>
                  <p className="text-sm text-green-600 flex items-center">
                    <Check className="h-4 w-4 mr-1" />
                    Processed
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-medium">Embeddings</h3>
                  <p className="text-sm text-muted-foreground">{count || 0} chunks processed</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="md:col-span-2">
            <DocumentChat documentId={document.id} />
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Clock className="mx-auto h-12 w-12 text-amber-600 mb-4" />
            <h3 className="text-lg font-medium mb-2">Document is being processed</h3>
            <p className="text-muted-foreground mb-4">
              Your document is currently being processed. This may take a few minutes depending on the size of the
              document. You will be able to chat with your document once processing is complete.
            </p>
            <Button onClick={() => window.location.reload()}>Check Status</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}