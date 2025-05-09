import { createServerSupabaseClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Upload, Clock, Check } from "lucide-react"
import { cookies } from "next/headers"

export default async function DocumentsPage() {
  const supabase = await createServerSupabaseClient()

  // Validate user with getUser()
  const { data: userData, error: userError } = await (await supabase).auth.getUser()
  if (userError || !userData.user) {
    console.error("Error validating user:", userError)
    return null
  }

  // Verify user exists in users table
  const { data: userRecord, error: userRecordError } = await supabase
    .from("users") // Ensure supabase is awaited
    .select("id")
    .eq("id", userData.user.id)
    .single()

  if (userRecordError || !userRecord) {
    console.error("User not found in users table:", userRecordError)
    return null
  }

  // Get user documents
  const { data: documents } = await supabase
    .from("user_documents") // Ensure supabase is awaited
    .select("*")
    .eq("user_id", userData.user.id)
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
          {documents.map((doc: { id: string; file_name: string; file_size: number; created_at: string; processed: boolean }) => (
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