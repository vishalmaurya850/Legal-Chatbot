"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, MapPin, Clock, User, MessageSquare, PlusCircle } from "lucide-react"
import Link from "next/link"
import type { LegalRequest, LawyerMatch, Lawyer } from "@/types/supabase"

type RequestWithMatches = LegalRequest & {
  matches: (LawyerMatch & {
    lawyers: Lawyer | null
  })[]
}

export default function LegalHelpDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [pendingRequests, setPendingRequests] = useState<RequestWithMatches[]>([])
  const [activeRequests, setActiveRequests] = useState<RequestWithMatches[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<RequestWithMatches[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchRequests = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Fetch pending requests
        const { data: pendingData, error: pendingError } = await supabase
          .from("legal_requests")
          .select(`
            *,
            matches:lawyer_matches(
              *,
              lawyers:lawyer_id(*)
            )
          `)
          .eq("user_id", user.id)
          .in("status", ["pending", "assigned"])
          .is("assigned_lawyer_id", null)
          .order("created_at", { ascending: false })

        if (pendingError) throw pendingError

        // Fetch active requests (assigned to a lawyer)
        const { data: activeData, error: activeError } = await supabase
          .from("legal_requests")
          .select(`
            *,
            matches:lawyer_matches(
              *,
              lawyers:lawyer_id(*)
            )
          `)
          .eq("user_id", user.id)
          .in("status", ["assigned", "in_progress"])
          .not("assigned_lawyer_id", "is", null)
          .order("created_at", { ascending: false })

        if (activeError) throw activeError

        // Fetch resolved requests
        const { data: resolvedData, error: resolvedError } = await supabase
          .from("legal_requests")
          .select(`
            *,
            matches:lawyer_matches(
              *,
              lawyers:lawyer_id(*)
            )
          `)
          .eq("user_id", user.id)
          .in("status", ["resolved", "closed"])
          .order("created_at", { ascending: false })

        if (resolvedError) throw resolvedError

        setPendingRequests(pendingData || [])
        setActiveRequests(activeData || [])
        setResolvedRequests(resolvedData || [])
      } catch (err: any) {
        console.error("Error fetching legal requests:", err)
        setError(err.message || "An error occurred while fetching your legal requests")
      } finally {
        setIsLoading(false)
      }
    }

    fetchRequests()

    // Set up real-time subscription for updates
    const requestsSubscription = supabase
      .channel("legal_requests_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "legal_requests",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh data when changes occur
          fetchRequests()
        },
      )
      .subscribe()

    const matchesSubscription = supabase
      .channel("lawyer_matches_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lawyer_matches",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Refresh data when changes occur
          fetchRequests()
        },
      )
      .subscribe()

    return () => {
      requestsSubscription.unsubscribe()
      matchesSubscription.unsubscribe()
    }
  }, [user, router, supabase])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Legal Help Dashboard</h1>
          <p className="text-muted-foreground">Track your legal help requests and connect with lawyers</p>
        </div>
        <Button onClick={() => router.push("/legal-help/request")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          New Legal Help Request
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="pending">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Pending Requests{" "}
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active">
            Active Cases{" "}
            {activeRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved">Resolved Cases</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">You don't have any pending legal help requests.</p>
                <Button onClick={() => router.push("/legal-help/request")} className="mt-4">
                  Create a New Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{request.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1" />
                        Submitted on {new Date(request.created_at).toLocaleDateString()}
                        <span className="mx-2">•</span>
                        <Badge variant={request.urgency === "High" ? "destructive" : "outline"}>
                          {request.urgency} Priority
                        </Badge>
                      </CardDescription>
                    </div>
                    <Badge>{request.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">Legal Area</h3>
                      <p>{request.legal_area}</p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Description</h3>
                      <p className="text-sm line-clamp-2">{request.description}</p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-1">Matching Status</h3>
                      <p className="text-sm">
                        {request.matches && request.matches.length > 0
                          ? `Matched with ${request.matches.length} lawyer${
                              request.matches.length > 1 ? "s" : ""
                            }, waiting for acceptance.`
                          : "Looking for lawyers in your area..."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4 mr-1" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/legal-help/requests/${request.id}`} className="text-primary hover:underline">
                        View details
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="active" className="space-y-4 mt-6">
          {activeRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">You don't have any active legal cases.</p>
              </CardContent>
            </Card>
          ) : (
            activeRequests.map((request) => {
              // Find the accepted match
              const acceptedMatch = request.matches?.find((match) => match.status === "accepted")
              const lawyer = acceptedMatch?.lawyers

              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{request.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <Clock className="h-4 w-4 mr-1" />
                          Updated on {new Date(request.updated_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="default">In Progress</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-1">Legal Area</h3>
                        <p>{request.legal_area}</p>
                      </div>
                      {lawyer && (
                        <div>
                          <h3 className="font-medium mb-1">Assigned Lawyer</h3>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            <span className="mr-2">{lawyer.full_name}</span>
                            <Badge variant="outline" className="mr-2">
                              {lawyer.specialization}
                            </Badge>
                            <Badge variant="outline">{lawyer.experience_years} years exp.</Badge>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-1" />
                          {request.city}, {request.state}
                        </div>
                        <div className="flex space-x-4">
                          {acceptedMatch && (
                            <Link
                              href={`/legal-help/chat/${acceptedMatch.id}`}
                              className="flex items-center text-primary hover:underline"
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              Chat with lawyer
                            </Link>
                          )}
                          <Link href={`/legal-help/requests/${request.id}`} className="text-primary hover:underline">
                            View details
                          </Link>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4 mt-6">
          {resolvedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">You don't have any resolved legal cases yet.</p>
              </CardContent>
            </Card>
          ) : (
            resolvedRequests.map((request) => {
              // Find the completed match
              const completedMatch = request.matches?.find((match) => match.status === "completed")
              const lawyer = completedMatch?.lawyers

              return (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle>{request.title}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <Clock className="h-4 w-4 mr-1" />
                          Resolved on {new Date(request.updated_at).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <Badge variant="outline">Resolved</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-medium mb-1">Legal Area</h3>
                        <p>{request.legal_area}</p>
                      </div>
                      {lawyer && (
                        <div>
                          <h3 className="font-medium mb-1">Lawyer</h3>
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-1" />
                            <span>{lawyer.full_name}</span>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-1" />
                          {request.city}, {request.state}
                        </div>
                        <Link href={`/legal-help/requests/${request.id}`} className="text-primary hover:underline">
                          View details
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}