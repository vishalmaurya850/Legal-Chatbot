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
import { LEGAL_SPECIALIZATIONS } from "@/types/supabase"
import { Loader2 } from "lucide-react"

export default function LawyerRegistrationPage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = getSupabaseClient()

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    specialization: "",
    experienceYears: "",
    bio: "",
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
      setError("You must be logged in to register as a lawyer")
      return
    }

    // Basic validation
    if (
      !formData.fullName ||
      !formData.email ||
      !formData.specialization ||
      !formData.experienceYears ||
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

      // Insert lawyer data
      const { data, error: insertError } = await supabase.from("lawyers").insert({
        user_id: user.id,
        full_name: formData.fullName,
        email: formData.email,
        phone: formData.phone || null,
        specialization: formData.specialization,
        experience_years: Number.parseInt(formData.experienceYears),
        bio: formData.bio || null,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        country: formData.country,
        postal_code: formData.postalCode || null,
        latitude,
        longitude,
        is_verified: false,
        is_available: true,
      })

      if (insertError) {
        throw insertError
      }

      // Update user location data
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

      setSuccess(
        "Your lawyer profile has been submitted for verification. We'll review your information and get back to you soon.",
      )

      // Clear form after successful submission
      setFormData({
        fullName: "",
        email: "",
        phone: "",
        specialization: "",
        experienceYears: "",
        bio: "",
        address: "",
        city: "",
        state: "",
        country: "",
        postalCode: "",
      })

      // Redirect to dashboard after a short delay
      setTimeout(() => {
        router.push("/lawyers/dashboard")
      }, 3000)
    } catch (err: any) {
      console.error("Error registering lawyer:", err)
      setError(err.message || "An unexpected error occurred while registering your profile")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Register as a Lawyer</h1>

      <Card>
        <CardHeader>
          <CardTitle>Lawyer Registration</CardTitle>
          <CardDescription>
            Fill out this form to register as a lawyer on our platform. Your information will be reviewed for
            verification.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="john.doe@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="specialization">Legal Specialization *</Label>
                <Select
                  value={formData.specialization}
                  onValueChange={(value) => handleSelectChange("specialization", value)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select specialization" />
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
                <Label htmlFor="experienceYears">Years of Experience *</Label>
                <Input
                  id="experienceYears"
                  name="experienceYears"
                  type="number"
                  min="0"
                  max="70"
                  value={formData.experienceYears}
                  onChange={handleChange}
                  placeholder="5"
                  required
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="bio">Professional Bio</Label>
                <Textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="Tell us about your professional background, education, and expertise..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
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
              "Register as Lawyer"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}