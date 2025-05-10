"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, MapPin, Clock, User, MessageSquare, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"
import type { Lawyer, LawyerMatch, LegalRequest } from "@/types/supabase"

export default function LawyerDashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [lawyer, setLawyer] = useState<Lawyer | null>(null)
  const [isAvailable, setIsAvailable] = useState(true)
  const [pendingRequests, setPendingRequests] = useState<(LegalRequest & { match: LawyerMatch })[]>([])
  const [activeRequests, setActiveRequests] = useState<(LegalRequest & { match: LawyerMatch })[]>([])
  const [completedRequests, setCompletedRequests] = useState<(LegalRequest & { match: LawyerMatch })[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push("/login")
      return
    }

    const fetchLawyerData = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Check if the user is registered as a lawyer
        const { data: lawyerData, error: lawyerError } = await supabase
          .from("lawyers")
          .select("*")
          .eq("user_id", user.id)
          .single()

        if (lawyerError) {
          if (lawyerError.code === "PGRST116") {
            // Not found error
            router.push("/lawyers/register")
            return
          }
          throw lawyerError
        }

        setLawyer(lawyerData)
        setIsAvailable(lawyerData.is_available)

        // Fetch pending match requests - using separate queries instead of relationships
        const { data: pendingMatchesData, error: pendingMatchesError } = await supabase
          .from("lawyer_matches")
          .select("*")
          .eq("lawyer_id", lawyerData.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })

        if (pendingMatchesError) throw pendingMatchesError

        // Fetch legal requests for pending matches
        if (pendingMatchesData && pendingMatchesData.length > 0) {
          const pendingRequestIds = pendingMatchesData.map((match) => match.legal_request_id)
          const { data: pendingRequestsData, error: pendingRequestsError } = await supabase
            .from("legal_requests")
            .select("*")
            .in("id", pendingRequestIds)

          if (pendingRequestsError) throw pendingRequestsError

          // Combine the data
          const combinedPendingData =
            pendingRequestsData?.map((request) => {
              const match = pendingMatchesData.find((m) => m.legal_request_id === request.id)
              return {
                ...request,
                match: match!,
              }
            }) || []

          setPendingRequests(combinedPendingData)
        } else {
          setPendingRequests([])
        }

        // Fetch active match requests - using separate queries
        const { data: activeMatchesData, error: activeMatchesError } = await supabase
          .from("lawyer_matches")
          .select("*")
          .eq("lawyer_id", lawyerData.id)
          .eq("status", "accepted")
          .order("created_at", { ascending: false })

        if (activeMatchesError) throw activeMatchesError

        // Fetch legal requests for active matches
        if (activeMatchesData && activeMatchesData.length > 0) {
          const activeRequestIds = activeMatchesData.map((match) => match.legal_request_id)
          const { data: activeRequestsData, error: activeRequestsError } = await supabase
            .from("legal_requests")
            .select("*")
            .in("id", activeRequestIds)

          if (activeRequestsError) throw activeRequestsError

          // Combine the data
          const combinedActiveData =
            activeRequestsData?.map((request) => {
              const match = activeMatchesData.find((m) => m.legal_request_id === request.id)
              return {
                ...request,
                match: match!,
              }
            }) || []

          setActiveRequests(combinedActiveData)
        } else {
          setActiveRequests([])
        }

        // Fetch completed match requests - using separate queries
        const { data: completedMatchesData, error: completedMatchesError } = await supabase
          .from("lawyer_matches")
          .select("*")
          .eq("lawyer_id", lawyerData.id)
          .eq("status", "completed")
          .order("created_at", { ascending: false })

        if (completedMatchesError) throw completedMatchesError

        // Fetch legal requests for completed matches
        if (completedMatchesData && completedMatchesData.length > 0) {
          const completedRequestIds = completedMatchesData.map((match) => match.legal_request_id)
          const { data: completedRequestsData, error: completedRequestsError } = await supabase
            .from("legal_requests")
            .select("*")
            .in("id", completedRequestIds)

          if (completedRequestsError) throw completedRequestsError

          // Combine the data
          const combinedCompletedData =
            completedRequestsData?.map((request) => {
              const match = completedMatchesData.find((m) => m.legal_request_id === request.id)
              return {
                ...request,
                match: match!,
              }
            }) || []

          setCompletedRequests(combinedCompletedData)
        } else {
          setCompletedRequests([])
        }
      } catch (err: any) {
        console.error("Error fetching lawyer data:", err)
        setError(err.message || "An error occurred while fetching your lawyer profile")
      } finally {
        setIsLoading(false)
      }
    }

    fetchLawyerData()

    // Set up real-time subscription for new matches
    const matchesSubscription = supabase
      .channel("lawyer_matches_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lawyer_matches",
          filter: lawyer ? `lawyer_id=eq.${lawyer.id}` : undefined,
        },
        () => {
          // Refresh data when changes occur
          fetchLawyerData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(matchesSubscription)
    }
  }, [user, router, supabase, lawyer?.id])

  const handleAvailabilityChange = async () => {
    if (!lawyer) return

    try {
      const newAvailability = !isAvailable
      setIsAvailable(newAvailability)

      const { error: updateError } = await supabase
        .from("lawyers")
        .update({ is_available: newAvailability })
        .eq("id", lawyer.id)

      if (updateError) throw updateError
    } catch (err: any) {
      console.error("Error updating availability:", err)
      setError(err.message || "Failed to update availability status")
      // Revert the UI state if the update failed
      setIsAvailable(!isAvailable)
    }
  }

  const handleAcceptRequest = async (matchId: string, requestId: string) => {
    try {
      // Update match status to accepted
      const { error: matchError } = await supabase
        .from("lawyer_matches")
        .update({ status: "accepted" })
        .eq("id", matchId)

      if (matchError) throw matchError

      // Update request status to assigned
      const { error: requestError } = await supabase
        .from("legal_requests")
        .update({ status: "assigned", assigned_lawyer_id: lawyer?.id })
        .eq("id", requestId)

      if (requestError) throw requestError

      // Refresh data
      setPendingRequests(pendingRequests.filter((req) => req.match.id !== matchId))
      const acceptedRequest = pendingRequests.find((req) => req.match.id === matchId)
      if (acceptedRequest) {
        const updatedRequest = {
          ...acceptedRequest,
          status: "assigned",
          assigned_lawyer_id: lawyer?.id ?? undefined,
          match: {
            ...acceptedRequest.match,
            status: "accepted",
          },
        }
        setActiveRequests([updatedRequest, ...activeRequests])
      }
    } catch (err: any) {
      console.error("Error accepting request:", err)
      setError(err.message || "Failed to accept the request")
    }
  }

  const handleRejectRequest = async (matchId: string) => {
    try {
      // Update match status to rejected
      const { error: matchError } = await supabase
        .from("lawyer_matches")
        .update({ status: "rejected" })
        .eq("id", matchId)

      if (matchError) throw matchError

      // Refresh data
      setPendingRequests(pendingRequests.filter((req) => req.match.id !== matchId))
    } catch (err: any) {
      console.error("Error rejecting request:", err)
      setError(err.message || "Failed to reject the request")
    }
  }

  const handleCompleteRequest = async (matchId: string, requestId: string) => {
    try {
      // Update match status to completed
      const { error: matchError } = await supabase
        .from("lawyer_matches")
        .update({ status: "completed" })
        .eq("id", matchId)

      if (matchError) throw matchError

      // Update request status to resolved
      const { error: requestError } = await supabase
        .from("legal_requests")
        .update({ status: "resolved" })
        .eq("id", requestId)

      if (requestError) throw requestError

      // Refresh data
      setActiveRequests(activeRequests.filter((req) => req.match.id !== matchId))
      const completedRequest = activeRequests.find((req) => req.match.id === matchId)
      if (completedRequest) {
        const updatedRequest = {
          ...completedRequest,
          status: "resolved",
          match: {
            ...completedRequest.match,
            status: "completed",
          },
        }
        setCompletedRequests([updatedRequest, ...completedRequests])
      }
    } catch (err: any) {
      console.error("Error completing request:", err)
      setError(err.message || "Failed to mark the request as completed")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-sky-600" />
      </div>
    )
  }

  if (!lawyer) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="border-sky-100">
          <CardHeader>
            <CardTitle className="text-sky-700">Lawyer Profile Not Found</CardTitle>
            <CardDescription>You need to register as a lawyer to access this dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-700">
              It looks like you haven't registered as a lawyer yet. Register now to start helping clients with their
              legal needs.
            </p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push("/lawyers/register")} className="bg-sky-600 hover:bg-sky-700">
              Register as a Lawyer
            </Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-sky-700">Lawyer Dashboard</h1>
          <p className="text-gray-600">Manage your legal assistance requests and client communications</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Switch id="availability" checked={isAvailable} onCheckedChange={handleAvailabilityChange} />
            <Label htmlFor="availability">Available for new requests</Label>
          </div>
          <Button onClick={() => router.push("/lawyers/profile")} className="bg-sky-600 hover:bg-sky-700">
            Edit Profile
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card className="border-sky-100">
        <CardHeader>
          <CardTitle className="text-sky-700">Your Lawyer Profile</CardTitle>
          <CardDescription>Your professional information and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2 text-gray-700">Profile Status</h3>
              <div className="flex items-center space-x-2">
                <Badge
                  variant={lawyer.is_verified ? "default" : "secondary"}
                  className={lawyer.is_verified ? "bg-sky-600" : ""}
                >
                  {lawyer.is_verified ? "Verified" : "Pending Verification"}
                </Badge>
                <Badge
                  variant={isAvailable ? "default" : "outline"}
                  className={isAvailable ? "bg-green-600" : "border-gray-300 text-gray-700"}
                >
                  {isAvailable ? "Available" : "Unavailable"}
                </Badge>
              </div>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-gray-700">Specialization</h3>
              <p className="text-gray-600">{lawyer.specialization}</p>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-gray-700">Experience</h3>
              <p className="text-gray-600">{lawyer.experience_years} years</p>
            </div>
            <div>
              <h3 className="font-medium mb-2 text-gray-700">Location</h3>
              <p className="flex items-center text-gray-600">
                <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                {lawyer.city}, {lawyer.state}, {lawyer.country}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending" className="border-sky-100">
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
          <TabsTrigger value="completed" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            Completed Cases
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4 mt-6">
          {pendingRequests.length === 0 ? (
            <Card className="border-sky-100">
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">No pending requests at the moment.</p>
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
                        {new Date(request.created_at).toLocaleDateString()}
                        <span className="mx-2">•</span>
                        <Badge variant={request.urgency === "High" ? "destructive" : "outline"}>
                          {request.urgency} Priority
                        </Badge>
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRejectRequest(request.match.id)}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleAcceptRequest(request.match.id, request.id)}
                        className="bg-sky-600 hover:bg-sky-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Accept
                      </Button>
                    </div>
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
                      <p className="text-sm text-gray-600">{request.description}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/lawyers/requests/${request.id}`} className="text-sky-600 hover:underline">
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
                <p className="text-gray-600">You don't have any active cases at the moment.</p>
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
                        Accepted on {new Date(request.match.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/lawyers/chat/${request.match.id}`)}
                        className="border-sky-200 text-sky-700 hover:bg-sky-50"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Chat
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleCompleteRequest(request.match.id, request.id)}
                        className="bg-sky-600 hover:bg-sky-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Mark as Completed
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Legal Area</h3>
                      <p className="text-gray-600">{request.legal_area}</p>
                    </div>
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Client</h3>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1 text-sky-600" />
                        <Link href={`/lawyers/clients/${request.user_id}`} className="text-sky-600 hover:underline">
                          View client profile
                        </Link>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/lawyers/requests/${request.id}`} className="text-sky-600 hover:underline">
                        View details
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4 mt-6">
          {completedRequests.length === 0 ? (
            <Card className="border-sky-100">
              <CardContent className="py-8 text-center">
                <p className="text-gray-600">You haven't completed any cases yet.</p>
              </CardContent>
            </Card>
          ) : (
            completedRequests.map((request) => (
              <Card key={request.id} className="border-sky-100">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-sky-700">{request.title}</CardTitle>
                      <CardDescription className="flex items-center mt-1">
                        <Clock className="h-4 w-4 mr-1 text-sky-600" />
                        Completed on {new Date(request.match.updated_at).toLocaleDateString()}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1 text-gray-700">Legal Area</h3>
                      <p className="text-gray-600">{request.legal_area}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-sm text-gray-500">
                        <MapPin className="h-4 w-4 mr-1 text-sky-600" />
                        {request.city}, {request.state}
                      </div>
                      <Link href={`/lawyers/requests/${request.id}`} className="text-sky-600 hover:underline">
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