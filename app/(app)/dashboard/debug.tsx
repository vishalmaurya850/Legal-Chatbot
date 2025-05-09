"use client"

import { useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function SessionDebug() {
  const { user, session } = useAuth()

  useEffect(() => {
    // Log session info on component mount
    console.group("Session Debug Info")

    // Log all cookies
    console.log("Cookies:")
    document.cookie.split(";").forEach((cookie) => {
      console.log(`- ${cookie.trim()}`)
    })

    // Check localStorage
    try {
      const sessionStr = localStorage.getItem("supabase-session")
      if (sessionStr) {
        const session = JSON.parse(sessionStr)
        console.log("Session from localStorage:", {
          userId: session.user?.id,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : "N/A",
        })
      } else {
        console.log("No session in localStorage")
      }
    } catch (e) {
      console.error("Error reading localStorage:", e)
    }

    console.groupEnd()
  }, [])

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle>Session Debug</CardTitle>
        <CardDescription>Current authentication state</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div>
            <strong>User ID:</strong> {user?.id || "Not logged in"}
          </div>
          <div>
            <strong>Email:</strong> {user?.email || "N/A"}
          </div>
          <div>
            <strong>Session Active:</strong> {session ? "Yes" : "No"}
          </div>
          {session && (
            <div>
              <strong>Expires:</strong> {new Date(session.expires_at! * 1000).toLocaleString()}
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => {
              console.group("Session Debug Info")

              // Log all cookies
              console.log("Cookies:")
              document.cookie.split(";").forEach((cookie) => {
                console.log(`- ${cookie.trim()}`)
              })

              // Check localStorage
              try {
                const sessionStr = localStorage.getItem("supabase-session")
                if (sessionStr) {
                  const session = JSON.parse(sessionStr)
                  console.log("Session from localStorage:", {
                    userId: session.user?.id,
                    expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : "N/A",
                  })
                } else {
                  console.log("No session in localStorage")
                }
              } catch (e) {
                console.error("Error reading localStorage:", e)
              }

              console.groupEnd()
            }}
          >
            Log Session Info
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}