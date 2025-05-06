"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Session, User } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"

type AuthContextType = {
  user: User | null
  session: Session | null
  isLoading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: any }>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error("Error getting session:", sessionError)
          setIsLoading(false)
          return
        }

        if (sessionData.session) {
          // Validate user with getUser()
          const { data: userData, error: userError } = await supabase.auth.getUser()
          if (userError) {
            console.error("Error validating user:", userError)
            setSession(null)
            setUser(null)
          } else {
            setSession(sessionData.session)
            setUser(userData.user)
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session) {
        // Validate user with getUser()
        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error("Error validating user on auth state change:", userError)
          setUser(null)
        } else {
          setUser(userData.user)
        }
      } else {
        setUser(null)
      }
      setIsLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signIn = async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })

      if (!error && data.session) {
        // Set auth cookie
        const authCookie = `base64-${Buffer.from(
          JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        ).toString("base64")}`
        document.cookie = `legal-chatbot-auth=${authCookie}; path=/; secure; samesite=strict`

        // Fetch session and user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error("Error getting session after sign-in:", sessionError)
          return { error: sessionError }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error("Error validating user after sign-in:", userError)
          return { error: userError }
        }

        setSession(sessionData.session)
        setUser(userData.user)
        router.refresh()
      }

      return { error }
    } catch (error) {
      console.error("Sign in error:", error)
      return { error }
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })

      if (signUpError) {
        console.error("Sign up error:", {
          message: signUpError.message,
          status: signUpError.status,
          code: signUpError.code,
          details: signUpError,
        })
        return { error: signUpError }
      }

      if (data.session) {
        // Set auth cookie
        const authCookie = `base64-${Buffer.from(
          JSON.stringify({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          })
        ).toString("base64")}`
        console.log("Setting auth cookie:", authCookie)
        document.cookie = `legal-chatbot-auth=${authCookie}; path=/; secure; samesite=strict`

        // Fetch session and user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          console.error("Error getting session after sign-up:", sessionError)
          return { error: sessionError }
        }

        const { data: userData, error: userError } = await supabase.auth.getUser()
        if (userError) {
          console.error("Error validating user after sign-up:", userError)
          return { error: userError }
        }

        setSession(sessionData.session)
        setUser(userData.user)
        router.refresh()
      } else {
        console.log("No session returned, email verification may be required")
      }

      return { error: null }
    } catch (error: any) {
      console.error("Unexpected error during sign up:", {
        message: error.message,
        stack: error.stack,
        details: error,
      })
      return { error: error.message || "Failed to sign up" }
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    router.push("/login")
    router.refresh()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error }
  }

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}