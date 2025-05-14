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
import type { LegalRequest, Lawyer } from "@/types/supabase"

export default function LegalHelpDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [pendingRequests, setPendingRequests] = useState<LegalRequest[]>([])
  const [activeRequests, setActiveRequests] = useState<(LegalRequest & { lawyer?: Lawyer; matchId?: string })[]>([])
  const [resolvedRequests, setResolvedRequests] = useState<(LegalRequest & { lawyer?: Lawyer; matchId?: string })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchRequests = async () => {
      setIsLoading(false)
      setError(null)

      try {
        // Fetch all legal requests for the user
        const { data: allRequests, error: requestsError } = await supabase
          .from("legal_requests")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (requestsError) throw requestsError

        if (!allRequests || allRequests.length === 0) {
          setPendingRequests([])
          setActiveRequests([])
          setResolvedRequests([])
          setIsLoading(false)
          return
        }

        // Filter requests by status
        const pending = allRequests.filter(
          (req) => req.status === "pending" || (req.status === "assigned" && !req.assigned_lawyer_id),
        )
        setPendingRequests(pending)

        // Get active requests (assigned with a lawyer)
        const active = allRequests.filter(
          (req) => (req.status === "assigned" || req.status === "in_progress") && req.assigned_lawyer_id,
        )

        // Get resolved requests
        const resolved = allRequests.filter((req) => req.status === "resolved" || req.status === "closed")

        // For active and resolved requests, we need to fetch the lawyer details and match ID
        if (active.length > 0 || resolved.length > 0) {
          // Get all lawyer IDs
          const lawyerIds = [
            ...active.filter((req) => req.assigned_lawyer_id).map((req) => req.assigned_lawyer_id),
            ...resolved.filter((req) => req.assigned_lawyer_id).map((req) => req.assigned_lawyer_id),
          ].filter((id): id is string => id !== undefined && id !== null)

          // Fetch lawyer details if there are any assigned lawyers
          let lawyersData: Lawyer[] = []
          if (lawyerIds.length > 0) {
            const { data: lawyers, error: lawyersError } = await supabase
              .from("lawyers")
              .select("*")
              .in("id", lawyerIds)

            if (lawyersError) throw lawyersError
            lawyersData = lawyers || []
          }

          // Get all request IDs
          const requestIds = [...active, ...resolved].map((req) => req.id)

          // Fetch matches for these requests to get match IDs for chat links
          const { data: matches, error: matchesError } = await supabase
            .from("lawyer_matches")
            .select("id, legal_request_id, lawyer_id, status")
            .in("legal_request_id", requestIds)
            .in("status", ["accepted", "completed"])

          if (matchesError) throw matchesError

          // Enhance active requests with lawyer details and match ID
          const enhancedActive = active.map((request) => {
            const lawyer = lawyersData.find((l) => l.id === request.assigned_lawyer_id)
            const match = matches?.find(
              (m) => m.legal_request_id === request.id && m.lawyer_id === request.assigned_lawyer_id,
            )
            return {
              ...request,
              lawyer,
              matchId: match?.id,
            }
          })

          // Enhance resolved requests with lawyer details and match ID
          const enhancedResolved = resolved.map((request) => {
            const lawyer = lawyersData.find((l) => l.id === request.assigned_lawyer_id)
            const match = matches?.find(
              (m) => m.legal_request_id === request.id && m.lawyer_id === request.assigned_lawyer_id,
            )
            return {
              ...request,
              lawyer,
              matchId: match?.id,
            }
          })

          setActiveRequests(enhancedActive)
          setResolvedRequests(enhancedResolved)
        } else {
          setActiveRequests([])
          setResolvedRequests([])
        }
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
      supabase.removeChannel(requestsSubscription)
      supabase.removeChannel(matchesSubscription)
    }
  }, [user, router, supabase])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sky-700">Legal Help Dashboard</h1>
          <p className="text-gray-600">Track your legal help requests and connect with lawyers</p>
        </div>
        <Button onClick={() => router.push("/legal-help/request")} className="bg-sky-600 hover:bg-sky-700">
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
        <TabsList className="grid w-full grid-cols-3 bg-sky-50">
          <TabsTrigger value="pending" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            Pending Requests{" "}
            {pendingRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-sky-200 text-sky-800">
                {pendingRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            Active Cases{" "}
            {activeRequests.length > 0 && (
              <Badge variant="secondary" className="ml-2 bg-sky-200 text-sky-800">
                {activeRequests.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="resolved" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            Resolved Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingRequests.length === 0 ? (
            <Card className="border-sky-100">
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">You don't have any pending legal help requests.</p>
                <Button onClick={() => router.push("/legal-help/request")} className="mt-4 bg-sky-600 hover:bg-sky-700">
                  Create a New Request
                </Button>
              </CardContent>
            </Card>
          ) : (
            pendingRequests.map((request) => (
              <Card key={request.id} className="border-sky-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sky-700">{request.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1 text-sky-600" />
                        Submitted on {new Date(request.created_at).toLocaleDateString()}
                        <span className="mx-2">•</span>
                        <Badge
                          variant={request.urgency === "High" ? "destructive" : "outline"}
                          className={request.urgency === "High" ? "" : "border-sky-200 text-sky-700"}
                        >
                          {request.urgency} Priority
                        </Badge>
                      </CardDescription>
                    </div>
                    <Badge className={request.status === "pending" ? "bg-yellow-500" : "bg-sky-600"}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Legal Area</h3>
                      <p className="text-gray-600">{request.legal_area}</p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Description</h3>
                      <p className="text-sm line-clamp-2 text-gray-600">{request.description}</p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Matching Status</h3>
                      <p className="text-sm text-gray-600">
                        {request.status === "pending"
                          ? "Looking for lawyers in your area..."
                          : "Waiting for lawyer acceptance."}
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/legal-help/requests/${request.id}`} className="text-sky-600 hover:underline">
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
            <Card className="border-sky-100">
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">You don't have any active legal cases.</p>
              </CardContent>
            </Card>
          ) : (
            activeRequests.map((request) => (
              <Card key={request.id} className="border-sky-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sky-700">{request.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1 text-sky-600" />
                        Updated on {new Date(request.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge className="bg-green-600">In Progress</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Legal Area</h3>
                      <p className="text-gray-600">{request.legal_area}</p>
                    </div>
                    {request.lawyer && (
                      <div>
                        <h3 className="font-medium mb-1 text-gray-700">Assigned Lawyer</h3>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1 text-sky-600" />
                          <span className="mr-2 text-gray-600">{request.lawyer.full_name}</span>
                          <Badge variant="outline" className="mr-2 border-sky-200 text-sky-700">
                            {request.lawyer.specialization}
                          </Badge>
                          <Badge variant="outline" className="border-sky-200 text-sky-700">
                            {request.lawyer.experience_years} years exp.
                          </Badge>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <div className="flex space-x-4">
                        {request.matchId && (
                          <Link
                            href={`/legal-help/chat/${request.matchId}`}
                            className="flex items-center text-sky-600 hover:underline"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            Chat with lawyer
                          </Link>
                        )}
                        <Link href={`/legal-help/requests/${request.id}`} className="text-sky-600 hover:underline">
                          View details
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4 mt-6">
          {resolvedRequests.length === 0 ? (
            <Card className="border-sky-100">
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">You don't have any resolved legal cases yet.</p>
              </CardContent>
            </Card>
          ) : (
            resolvedRequests.map((request) => (
              <Card key={request.id} className="border-sky-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sky-700">{request.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1 text-sky-600" />
                        Resolved on {new Date(request.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="border-sky-200 text-sky-700">
                      Resolved
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Legal Area</h3>
                      <p className="text-gray-600">{request.legal_area}</p>
                    </div>
                    {request.lawyer && (
                      <div>
                        <h3 className="font-medium mb-1 text-gray-700">Lawyer</h3>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1 text-sky-600" />
                          <span className="text-gray-600">{request.lawyer.full_name}</span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/legal-help/requests/${request.id}`} className="text-sky-600 hover:underline">
                        View details
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}