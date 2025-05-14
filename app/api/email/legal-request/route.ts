import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendLegalRequestToLawyerEmail, sendLegalRequestConfirmationEmail } from "@/lib/email-service"

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { requestId, matches } = await request.json()

    if (!requestId || !matches) {
      return NextResponse.json({ error: "Request ID and matches are required" }, { status: 400 })
    }

    // Get request data
    const { data: legalRequest, error: requestError } = await supabase
      .from("legal_requests")
      .select("*")
      .eq("id", requestId)
      .single()

    if (requestError || !legalRequest) {
      console.error("Error fetching legal request data:", requestError)
      return NextResponse.json({ error: "Legal request not found" }, { status: 404 })
    }

    // Get user data
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("id", legalRequest.user_id)
      .single()

    if (userError || !user) {
      console.error("Error fetching user data:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Send confirmation email to user
    await sendLegalRequestConfirmationEmail(user, legalRequest, matches.length)

    // Send notification emails to lawyers
    for (const match of matches) {
      // Get lawyer data
      const { data: lawyer, error: lawyerError } = await supabase
        .from("lawyers")
        .select("*")
        .eq("id", match.lawyer_id)
        .single()

      if (lawyerError || !lawyer) {
        console.error("Error fetching lawyer data:", lawyerError)
        continue
      }

      // Calculate distance
      const { data: distanceData } = await supabase.rpc("calculate_distance", {
        lat1: legalRequest.latitude,
        lon1: legalRequest.longitude,
        lat2: lawyer.latitude,
        lon2: lawyer.longitude,
      })

      const distance = distanceData || 0

      // Send email to lawyer
      await sendLegalRequestToLawyerEmail(lawyer, legalRequest, user, match.id, distance)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in legal request email API:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}