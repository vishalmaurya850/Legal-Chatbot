export function logSessionInfo() {
  if (typeof window === "undefined") return

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
}