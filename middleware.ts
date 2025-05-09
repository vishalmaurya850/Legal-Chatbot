import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  // Create a Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value
        },
        set(name, value, options) {
          res.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name, options) {
          res.cookies.set({
            name,
            value: "",
            ...options,
          })
        },
      },
    },
  )

  try {
    // Refresh the session
    await supabase.auth.getSession()

    // Get the session - this will use the cookies automatically
    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Define protected and auth routes
    const isProtectedRoute =
      req.nextUrl.pathname.startsWith("/dashboard") ||
      req.nextUrl.pathname.startsWith("/chat") ||
      req.nextUrl.pathname.startsWith("/documents") ||
      req.nextUrl.pathname.startsWith("/settings") ||
      req.nextUrl.pathname.startsWith("/legal-help") ||
      req.nextUrl.pathname.startsWith("/lawyers")

    const isAuthRoute =
      req.nextUrl.pathname === "/login" ||
      req.nextUrl.pathname === "/signup" ||
      req.nextUrl.pathname === "/forgot-password" ||
      req.nextUrl.pathname === "/reset-password"

    // Skip middleware for public routes and API routes
    const isPublicRoute =
      req.nextUrl.pathname === "/" ||
      req.nextUrl.pathname.startsWith("/public") ||
      req.nextUrl.pathname.startsWith("/_next") ||
      req.nextUrl.pathname.startsWith("/favicon.ico")

    // Skip middleware for API routes
    const isApiRoute = req.nextUrl.pathname.startsWith("/api/")

    if (isPublicRoute || isApiRoute) {
      return res
    }

    // Debug information
    console.log("Middleware check:", {
      path: req.nextUrl.pathname,
      hasSession: !!session,
      isProtectedRoute,
      isAuthRoute,
    })

    // Redirect logic
    if (isProtectedRoute && !session) {
      const redirectUrl = new URL("/login", req.url)
      redirectUrl.searchParams.set("redirect", req.nextUrl.pathname)
      return NextResponse.redirect(redirectUrl)
    }

    if (isAuthRoute && session) {
      return NextResponse.redirect(new URL("/dashboard", req.url))
    }

    return res
  } catch (error) {
    console.error("Middleware error:", error)
    // If there's an error in the middleware, allow the request to continue
    // This prevents authentication errors from blocking the entire application
    return res
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}