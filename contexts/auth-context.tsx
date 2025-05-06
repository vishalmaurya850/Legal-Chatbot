"use client";

import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Initialize auth state
    const initializeAuth = async () => {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting session:", sessionError);
          setIsLoading(false);
          return;
        }

        if (sessionData.session) {
          // Validate user with getUser()
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (userError) {
            console.error("Error validating user:", userError);
            setSession(null);
            setUser(null);
          } else {
            setSession(sessionData.session);
            setUser(userData.user);
          }
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Set up auth state listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      if (session) {
        // Validate user with getUser()
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Error validating user on auth state change:", userError);
          setUser(null);
        } else {
          setUser(userData.user);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error) {
        // Fetch session and user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting session after sign-in:", sessionError);
          return { error: sessionError };
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Error validating user after sign-in:", userError);
          return { error: userError };
        }

        setSession(sessionData.session);
        setUser(userData.user);
        router.refresh();
      }

      return { error };
    } catch (error) {
      console.error("Sign in error:", error);
      return { error };
    }
  };

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
      });

      if (signUpError) {
        console.error("Sign up error:", signUpError);
        return { error: signUpError };
      }

      if (data.user) {
        // Check if user exists in users table
        const { data: existingUser, error: selectError } = await supabase
          .from("users")
          .select("id")
          .eq("id", data.user.id)
          .single();

        if (selectError && selectError.code !== "PGRST116") {
          console.error("Error checking existing user:", selectError);
          return { error: selectError };
        }

        if (!existingUser) {
          // Insert into users table
          const { error: insertError } = await supabase.from("users").insert({
            id: data.user.id,
            full_name: fullName,
          });

          if (insertError) {
            console.error("Error inserting user into users table:", insertError);
            return { error: insertError };
          }
        }

        // Fetch session and user
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error("Error getting session after sign-up:", sessionError);
          return { error: sessionError };
        }

        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Error validating user after sign-up:", userError);
          return { error: userError };
        }

        setSession(sessionData.session);
        setUser(userData.user);
        router.refresh();
      }

      return { error: null };
    } catch (error) {
      console.error("Unexpected error during sign up:", error);
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    router.push("/login");
    router.refresh();
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  const value = {
    user,
    session,
    isLoading,
    signIn,
    signUp,
    signOut,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};