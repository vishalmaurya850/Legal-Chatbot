"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { User, LogOut, Settings, Moon, Sun, Scale, MessageSquare, FileText } from "lucide-react"
import { useTheme } from "next-themes"

export function Navbar() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()

  return (
    <header className="border-b bg-background">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center gap-4 md:gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold">Legal Chatbot</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            <Link
              href="/dashboard"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === "/dashboard" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Dashboard
            </Link>
            <Link
              href="/chat"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === "/chat" || pathname.startsWith("/chat/") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MessageSquare className="inline-block h-4 w-4 mr-1" />
              AI Chat
            </Link>
            <Link
              href="/documents"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === "/documents" || pathname.startsWith("/documents/")
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              <FileText className="inline-block h-4 w-4 mr-1" />
              Documents
            </Link>
            <Link
              href="/legal-help/dashboard"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname.startsWith("/legal-help") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Scale className="inline-block h-4 w-4 mr-1" />
              Legal Help
            </Link>
          </nav>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem className="font-medium">
                  Hi, {user.user_metadata?.full_name || "User"}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/lawyers/dashboard">
                    <Scale className="mr-2 h-4 w-4" />
                    <span>Lawyer Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}