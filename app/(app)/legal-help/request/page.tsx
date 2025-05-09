"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { getSupabaseClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LEGAL_SPECIALIZATIONS, URGENCY_LEVELS } from "@/types/supabase"
import { Loader2 } from "lucide-react"

export default function LegalHelpRequestPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    legalArea: "",
    urgency: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!user) {
      setError("You must be logged in to submit a legal help request")
      return
    }

    // Basic validation
    if (
      !formData.title ||
      !formData.description ||
      !formData.legalArea ||
      !formData.urgency ||
      !formData.address ||
      !formData.city ||
      !formData.state ||
      !formData.country
    ) {
      setError("Please fill in all required fields")
      return
    }

    setIsSubmitting(true)

    try {
      // Geocode the address to get latitude and longitude
      const geocodeUrl = `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        `${formData.address}, ${formData.city}, ${formData.state}, ${formData.country}`,
      )}&key=YOUR_OPENCAGE_API_KEY`

      let latitude = null
      let longitude = null

      try {
        const response = await fetch(geocodeUrl)
        const data = await response.json()
        if (data.results && data.results.length > 0) {
          latitude = data.results[0].geometry.lat
          longitude = data.results[0].geometry.lng
        }
      } catch (geocodeError) {
        console.error("Error geocoding address:", geocodeError)
        // Continue without coordinates if geocoding fails
      }

      // Insert legal request
      const { data: requestData, error: requestError } = await supabase
        .from("legal_requests")
        .insert({
          user_id: user.id,
          title: formData.title,
          description: formData.description,
          legal_area: formData.legalArea,
          urgency: formData.urgency,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          postal_code: formData.postalCode || null,
          latitude,
          longitude,
          status: "pending",
        })
        .select()
        .single()

      if (requestError) {
        throw requestError
      }

      // Update user location data if not already set
      await supabase
        .from("users")
        .update({
          address: formData.address,
          city: formData.city,
          state: formData.state,
          country: formData.country,
          postal_code: formData.postalCode || null,
          latitude,
          longitude,
        })
        .eq("id", user.id)

      // Find nearby lawyers
      const { data: nearbyLawyers, error: lawyersError } = await supabase.rpc("find_nearby_lawyers", {
        request_id: requestData.id,
        max_distance: 50.0, // 50km radius
      })

      if (lawyersError) {
        console.error("Error finding nearby lawyers:", lawyersError)
        // Continue even if lawyer matching fails
      }

      // Create matches with nearby lawyers
      if (nearbyLawyers && nearbyLawyers.length > 0) {
        const matches = nearbyLawyers.map((lawyer: any) => ({
          legal_request_id: requestData.id,
          lawyer_id: lawyer.lawyer_id,
          user_id: user.id,
          match_score: lawyer.match_score,
          status: "pending",
        }))

        const { error: matchError } = await supabase.from("lawyer_matches").insert(matches)

        if (matchError) {
          console.error("Error creating lawyer matches:", matchError)
          // Continue even if match creation fails
        }
      }

      setSuccess("Your legal help request has been submitted successfully. We'll match you with suitable lawyers soon.")

      // Clear form after successful submission
      setFormData({
        title: "",
        description: "",
        legalArea: "",
        urgency: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/legal-help/dashboard")
      }, 3000)
    } catch (err: any) {
      console.error("Error submitting legal help request:", err)
      setError(err.message || "An unexpected error occurred while submitting your request")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Request Legal Help</h1>

      <Card>
        <CardHeader>
          <CardTitle>Legal Help Request</CardTitle>
          <CardDescription>
            Fill out this form to request legal assistance. We'll match you with qualified lawyers in your area.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert>
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title of your legal issue *</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="E.g., Property dispute with neighbor"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Detailed description *</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Please describe your legal issue in detail..."
                className="min-h-[150px]"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="legalArea">Legal Area *</Label>
                <Select
                  value={formData.legalArea}
                  onValueChange={(value) => handleSelectChange("legalArea", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select legal area" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEGAL_SPECIALIZATIONS.map((specialization) => (
                      <SelectItem key={specialization} value={specialization}>
                        {specialization}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency *</Label>
                <Select
                  value={formData.urgency}
                  onValueChange={(value) => handleSelectChange("urgency", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency level" />
                  </SelectTrigger>
                  <SelectContent>
                    {URGENCY_LEVELS.map((level) => (
                      <SelectItem key={level} value={level}>
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-medium">Your Location</h3>
              <p className="text-sm text-muted-foreground mb-4">
                We'll use this information to match you with lawyers in your area.
              </p>

              <div className="space-y-2">
                <Label htmlFor="address">Address *</Label>
                <Input
                  id="address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="123 Main St"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="city">City *</Label>
                  <Input
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    placeholder="New Delhi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="state">State/Province *</Label>
                  <Input
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    placeholder="Delhi"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="country">Country *</Label>
                  <Input
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    placeholder="India"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">Postal Code</Label>
                  <Input
                    id="postalCode"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleChange}
                    placeholder="110001"
                  />
                </div>
              </div>
            </div>
          </form>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !!success}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Request"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}