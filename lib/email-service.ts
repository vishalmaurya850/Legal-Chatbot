import nodemailer from "nodemailer"
import type { Lawyer, LegalRequest, User } from "@/types/supabase"

// Configure Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number.parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
})

/**
 * Sends an email
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  try {
    await transporter.sendMail({
      from: `"VIDHI 7 Legal Assistant" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    })
    return true
  } catch (error) {
    console.error("Error sending email:", error)
    return false
  }
}

/**
 * Sends a lawyer registration confirmation email
 */
export async function sendLawyerRegistrationEmail(lawyer: Lawyer): Promise<boolean> {
  const subject = "Welcome to VIDHI 7 - Lawyer Registration Confirmation"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0ea5e9;">Welcome to VIDHI 7 Legal Network</h2>
      <p>Dear ${lawyer.full_name},</p>
      <p>Thank you for registering as a lawyer on VIDHI 7. Your profile has been submitted for verification.</p>
      <p><strong>Registration Details:</strong></p>
      <ul>
        <li><strong>Name:</strong> ${lawyer.full_name}</li>
        <li><strong>Email:</strong> ${lawyer.email}</li>
        <li><strong>Specialization:</strong> ${lawyer.specialization}</li>
        <li><strong>Experience:</strong> ${lawyer.experience_years} years</li>
      </ul>
      <p>Our team will review your information and verify your credentials. You will receive another email once your profile is verified.</p>
      <p>In the meantime, you can log in to your account to view your dashboard and update your profile if needed.</p>
      <p>Best regards,<br>VIDHI 7 Team</p>
    </div>
  `
  return sendEmail(lawyer.email, subject, html)
}

/**
 * Sends a legal request notification email to a lawyer
 */
export async function sendLegalRequestToLawyerEmail(
  lawyer: Lawyer,
  request: LegalRequest,
  user: User,
  matchId: string,
  distance: number,
): Promise<boolean> {
  const subject = "New Legal Help Request - VIDHI 7"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0ea5e9;">New Legal Help Request</h2>
      <p>Dear ${lawyer.full_name},</p>
      <p>A new legal help request has been submitted that matches your expertise.</p>
      <p><strong>Request Details:</strong></p>
      <ul>
        <li><strong>Title:</strong> ${request.title}</li>
        <li><strong>Legal Area:</strong> ${request.legal_area}</li>
        <li><strong>Urgency:</strong> ${request.urgency}</li>
        <li><strong>Location:</strong> ${request.city}, ${request.state}</li>
        <li><strong>Distance:</strong> ${distance.toFixed(1)} km from your location</li>
      </ul>
      <p>Please log in to your VIDHI 7 dashboard to view the full details and accept or decline this request.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/lawyers/dashboard" style="background-color: #0ea5e9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">View Request</a></p>
      <p>Best regards,<br>VIDHI 7 Team</p>
    </div>
  `
  return sendEmail(lawyer.email, subject, html)
}

/**
 * Sends a legal request confirmation email to a user
 */
export async function sendLegalRequestConfirmationEmail(
  user: User,
  request: LegalRequest,
  matchCount: number,
): Promise<boolean> {
  const subject = "Legal Help Request Confirmation - VIDHI 7"
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0ea5e9;">Legal Help Request Confirmation</h2>
      <p>Dear ${user.full_name},</p>
      <p>Thank you for submitting your legal help request. We have received your request and are working to match you with suitable lawyers.</p>
      <p><strong>Request Details:</strong></p>
      <ul>
        <li><strong>Title:</strong> ${request.title}</li>
        <li><strong>Legal Area:</strong> ${request.legal_area}</li>
        <li><strong>Urgency:</strong> ${request.urgency}</li>
      </ul>
      <p>We have identified ${matchCount} potential lawyer matches in your area. You will be notified when a lawyer accepts your request.</p>
      <p>You can track the status of your request on your dashboard.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/legal-help/dashboard" style="background-color: #0ea5e9; color: white; padding: 10px 15px; text-decoration: none; border-radius: 4px;">View Dashboard</a></p>
      <p>Best regards,<br>VIDHI 7 Team</p>
    </div>
  `
  return sendEmail(user.email || "", subject, html)
}