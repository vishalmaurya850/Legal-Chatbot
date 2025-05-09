// Simple utility to check if the network is available
export async function checkNetworkStatus(): Promise<boolean> {
    try {
      // Try to fetch a small resource to check network connectivity
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
  
      const response = await fetch(process.env.NEXT_PUBLIC_SUPABASE_URL || "https://www.google.com", {
        method: "HEAD",
        signal: controller.signal,
        cache: "no-store",
      })
  
      clearTimeout(timeoutId)
      return response.ok
    } catch (error) {
      console.error("Network check failed:", error)
      return false
    }
  }  