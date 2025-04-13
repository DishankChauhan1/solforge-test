"use client"

import { useState, useEffect } from "react"
import { signInWithGithub, signInWithGoogle, signInWithEmailAndPassword } from "@/lib/auth"
import { useRouter } from "next/navigation"
import { Github } from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/AuthProvider"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { user, forceRefresh } = useAuth()
  
  // Redirect if already logged in
  useEffect(() => {
    console.log("Login page - auth state:", { user })
    if (user) {
      console.log("User already authenticated, redirecting to dashboard")
      router.push("/dashboard")
    }
  }, [user, router])

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError("Please enter both email and password")
      return
    }
    
    setLoading(true)
    setError("")

    try {
      await signInWithEmailAndPassword(email, password)
      console.log("Email login successful")
      
      // Force a refresh of the auth state
      forceRefresh()
      
      // Manually redirect 
      router.push("/dashboard")
    } catch (err: any) {
      console.error("Login error:", err)
      setError(err.message || "Invalid email or password")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setLoading(true)
    setError("")

    try {
      await signInWithGoogle()
      console.log("Google login successful")
      
      // Force a refresh of the auth state
      forceRefresh()
      
      // Manually redirect
      router.push("/dashboard")
    } catch (err: any) {
      console.error("Google login error:", err)
      setError(err.message || "Failed to sign in with Google")
    } finally {
      setLoading(false)
    }
  }

  const handleGithubSignIn = async () => {
    setLoading(true)
    setError("")

    try {
      await signInWithGithub()
      console.log("GitHub login successful")
      
      // Force a refresh of the auth state
      forceRefresh()
      
      // Manually redirect
      router.push("/dashboard")
    } catch (err: any) {
      console.error("GitHub login error:", err)
      setError(err.message || "Failed to sign in with GitHub")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Image
            src="/logo.png"
            alt="SolForge Logo"
            width={64}
            height={64}
            className="rounded-lg"
          />
        </div>
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Or{" "}
          <Link
            href="/register"
            className="font-medium text-purple-500 hover:text-purple-400"
          >
            create a new account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-card px-4 py-8 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleEmailSignIn}>
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-foreground"
              >
                Email address
              </label>
              <div className="mt-1">
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full appearance-none rounded-md"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-foreground"
              >
                Password
              </label>
              <div className="mt-1">
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full appearance-none rounded-md"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-500">
                {error}
              </div>
            )}

            <div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                onClick={handleGoogleSignIn}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Image
                  src="/google.svg"
                  alt="Google"
                  width={20}
                  height={20}
                  className="mr-2"
                />
                Google
              </Button>

              <Button
                onClick={handleGithubSignIn}
                disabled={loading}
                variant="outline"
                className="w-full"
              >
                <Github className="mr-2 h-5 w-5" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 