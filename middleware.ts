import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => req.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request: req,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Decode the `legal-chatbot-auth` cookie if it exists
  const authCookie = req.cookies.get("legal-chatbot-auth");
  if (authCookie) {
    try {
      const decodedAuth = JSON.parse(Buffer.from(authCookie.value.split("base64-")[1], "base64").toString());
      console.log("Decoded auth cookie:", decodedAuth);

      if (decodedAuth.access_token) {
        await supabase.auth.setSession({
          access_token: decodedAuth.access_token,
          refresh_token: decodedAuth.refresh_token,
        });
      }
    } catch (error) {
      console.error("Failed to decode auth cookie:", error);
    }
  }

  // Get the session to check if a session exists
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    console.error("Error getting session:", sessionError);
  }

  // Refresh session if expired
  if (!session && authCookie) {
    const { data: refreshedSession, error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      console.error("Error refreshing session:", refreshError);
    } else {
      console.log("Refreshed session in middleware:", refreshedSession);
    }
  }

  // Validate user with getUser()
  let user = null;
  if (session) {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error("Error validating user:", userError);
    } else {
      user = userData.user;
    }
  }

  // Check if the user exists in the users table
  if (user) {
    const { data: userRecord, error: userRecordError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (userRecordError || !userRecord) {
      console.error("User not found in users table:", userRecordError || "No user record");
      // Create a user record if missing
      const { error: insertError } = await supabase.from("users").insert({
        id: user.id,
        full_name: user.user_metadata.full_name || "Unknown",
      });

      if (insertError) {
        console.error("Error creating user record:", insertError);
        return NextResponse.redirect(new URL("/error?message=user-not-found", req.url));
      }
    }
  }

  // Check if the request is for a protected route
  const isProtectedRoute =
    req.nextUrl.pathname.startsWith("/dashboard") ||
    req.nextUrl.pathname.startsWith("/chat") ||
    req.nextUrl.pathname.startsWith("/documents") ||
    req.nextUrl.pathname.startsWith("/settings");

  // Check if the request is for an auth route
  const isAuthRoute =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/signup") ||
    req.nextUrl.pathname.startsWith("/forgot-password") ||
    req.nextUrl.pathname.startsWith("/reset-password");

  // Redirect if accessing protected route without a valid user
  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect if accessing auth route with a valid user
  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public|api/public).*)",
  ],
};