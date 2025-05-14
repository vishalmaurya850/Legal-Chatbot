"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut, User, Settings, HelpCircle } from "lucide-react"

export function Navbar() {
  const { user, signOut } = useAuth()
  const pathname = usePathname()

  // Get initials from user's email
  const getInitials = () => {
    if (!user?.email) return "U"
    return user.email
      .split("@")[0]
      .split(".")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2)
  }

  return (
    <header className="sticky top-0 z-30 flex h-26 items-center border-b border-sky-100 bg-white px-4 md:px-6">
      <div className="flex flex-1 items-center justify-between h-[10vh]">
        <div className="flex items-center">
          <Link href="/dashboard" className="flex items-center">
            <h1 className="ml-10 md:ml-0 text-xl font-bold text-sky-700">VIDHI 7</h1>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden md:flex md:items-center md:gap-4">
            {/* <Link href="/chat">
              <Button
                variant={pathname.startsWith("/chat") ? "default" : "ghost"}
                className={
                  pathname.startsWith("/chat") ? "bg-sky-600 hover:bg-sky-700" : "text-gray-700 hover:text-sky-700"
                }
              >
                AI Chat
              </Button>
            </Link> */}
            <Link href="/documents">
              <Button
                variant={pathname.startsWith("/documents") ? "default" : "ghost"}
                className={
                  pathname.startsWith("/documents") ? "bg-sky-600 hover:bg-sky-700" : "text-gray-700 hover:text-sky-700"
                }
              >
                Documents
              </Button>
            </Link>
            <Link href="/legal-help/dashboard">
              <Button
                variant={pathname.startsWith("/legal-help") ? "default" : "ghost"}
                className={
                  pathname.startsWith("/legal-help")
                    ? "bg-sky-600 hover:bg-sky-700"
                    : "text-gray-700 hover:text-sky-700"
                }
              >
                Legal Help
              </Button>
            </Link>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                <Avatar className="h-10 w-10 border border-sky-200">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} alt={user?.email || "User"} />
                  <AvatarFallback className="bg-sky-100 text-sky-700">{getInitials()}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex w-full cursor-pointer items-center">
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex w-full cursor-pointer items-center">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/help" className="flex w-full cursor-pointer items-center">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Help
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex cursor-pointer items-center text-red-600 focus:text-red-600"
                onClick={() => signOut()}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}