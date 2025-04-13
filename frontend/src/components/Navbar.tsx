"use client"

import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/context/AuthProvider"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function Navbar() {
  const { user, signOut, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  
  // Ensure we only render on client side and after initial auth check
  useEffect(() => {
    setMounted(true)
    console.log("Navbar - auth state:", { user, loading })
  }, [user, loading])

  return (
    <nav className="bg-white shadow dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="h-16 w-auto">
                <Image 
                  src="/logo.png" 
                  alt="SolForge Logo" 
                  width={240} 
                  height={64} 
                  priority
                  className="h-16 w-auto"
                />
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                href="/dashboard"
                className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              {mounted && user && (
                <>
                  {user.role === "creator" ? (
                    <>
                      <Link
                        href="/dashboard/my-bounties"
                        className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                      >
                        My Bounties
                      </Link>
                      <Link
                        href="/bounties/create"
                        className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                      >
                        Create Bounty
                      </Link>
                    </>
                  ) : (
                    <Link
                      href="/dashboard/my-submissions"
                      className="border-transparent text-gray-500 dark:text-gray-300 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                    >
                      My Submissions
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex items-center">
            {!mounted || loading ? (
              <div className="animate-pulse h-8 w-20 bg-gray-200 rounded"></div>
            ) : user ? (
              <div className="flex items-center space-x-4">
                <span className="hidden md:inline text-sm text-gray-700 dark:text-gray-300">
                  {user.displayName || user.email}
                </span>
                <WalletMultiButton className="phantom-button" />
                <Button
                  onClick={() => signOut()}
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium"
                  variant="ghost"
                >
                  Sign Out
                </Button>
              </div>
            ) : (
              <Link href="/login">
                <Button
                  className="text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-medium"
                  variant="ghost"
                >
                  Sign In
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
} 