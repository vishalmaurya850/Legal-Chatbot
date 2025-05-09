"use client"

import type React from "react"
import { createContext, useContext, useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase/client"
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
  const supabase = getSupabaseClient()

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        // First get the session
        const { data: sessionData } = await supabase.auth.getSession()
        setSession(sessionData.session)

        // Then get the authenticated user
        if (sessionData.session) {
          const { data: userData } = await supabase.auth.getUser()
          setUser(userData.user)
        } else {
          setUser(null)
        }
      } catch (error) {
        console.error("Error initializing auth:", error)
        setUser(null)
        setSession(null)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, newSession: Session | null) => {
      console.log("Auth state changed:", event, newSession?.user?.id)

      setSession(newSession)

      if (newSession) {
        try {
          const { data: userData } = await supabase.auth.getUser()
          setUser(userData.user)
        } catch (error) {
          console.error("Error getting user on auth state change:", error)
          setUser(null)
        }
      } else {
        setUser(null)
      }

      setIsLoading(false)
      router.refresh()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, router])

  const signIn = async (email: string, password: string) => {
    try {
      setIsLoading(true)
      const { error, data } = await supabase.auth.signInWithPassword({ email, password })

      if (!error && data.session) {
        setUser(data.user)
        setSession(data.session)
        router.refresh()
      }

      return { error }
    } catch (error) {
      console.error("Sign in error:", error)
      return { error }
    } finally {
      setIsLoading(false)
    }
  }

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      setIsLoading(true)
      const { error: signUpError, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (signUpError) {
        console.error("Sign up error:", signUpError)
        return { error: signUpError }
      }

      // Handle case where session is null (e.g., email verification required)
      if (data.session) {
        setUser(data.user)
        setSession(data.session)
        router.refresh()
      } else {
        console.log("No session returned from signUp, likely due to email verification")
        setSession(null)
        setUser(null)
      }

      return { error: null }
    } catch (error: any) {
      console.error("Unexpected error during sign up:", error)
      return { error: error.message || "Failed to sign up" }
    } finally {
      setIsLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setIsLoading(true)
      await supabase.auth.signOut()
      setUser(null)
      setSession(null)
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Sign out error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      return { error }
    } catch (error) {
      console.error("Reset password error:", error)
      return { error }
    }
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