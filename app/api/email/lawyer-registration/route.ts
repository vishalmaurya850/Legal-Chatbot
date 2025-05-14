import { NextResponse } from "next/server"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { sendLawyerRegistrationEmail } from "@/lib/email-service"

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseClient()
    const { lawyerId } = await request.json()

    if (!lawyerId) {
      return NextResponse.json({ error: "Lawyer ID is required" }, { status: 400 })
    }

    // Get lawyer data
    const { data: lawyer, error: lawyerError } = await (await supabase).from("lawyers").select("*").eq("id", lawyerId).single()

    if (lawyerError || !lawyer) {
      console.error("Error fetching lawyer data:", lawyerError)
      return NextResponse.json({ error: "Lawyer not found" }, { status: 404 })
    }

    // Send email
    const emailSent = await sendLawyerRegistrationEmail(lawyer)

    if (!emailSent) {
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error in lawyer registration email API:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}