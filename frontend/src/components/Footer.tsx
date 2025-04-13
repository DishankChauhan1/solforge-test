"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Github, Twitter, Send, ExternalLink } from "lucide-react"
import Link from "next/link"

export function Footer() {
  return (
    <footer className="relative border-t bg-background text-foreground transition-colors duration-300">
      <div className="container mx-auto px-4 py-12 md:px-6 lg:px-8">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <h2 className="mb-4 text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">
              Join SolForge
            </h2>
            <p className="mb-6 text-muted-foreground">
              Subscribe to our newsletter for the latest bounties and project updates.
            </p>
            <form className="relative">
              <Input
                type="email"
                placeholder="Enter your email"
                className="pr-12 backdrop-blur-sm"
              />
              <Button
                type="submit"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white transition-transform hover:scale-105"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Subscribe</span>
              </Button>
            </form>
            <div className="absolute -right-4 top-0 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" />
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Quick Links</h3>
            <nav className="space-y-2 text-sm">
              <Link href="/bounties" className="block transition-colors hover:text-purple-500">
                Explore Bounties
              </Link>
              <Link href="/create" className="block transition-colors hover:text-purple-500">
                Create Bounty
              </Link>
              <Link href="/projects" className="block transition-colors hover:text-purple-500">
                Projects
              </Link>
              <Link href="/contributions" className="block transition-colors hover:text-purple-500">
                My Contributions
              </Link>
              <Link href="/profile" className="block transition-colors hover:text-purple-500">
                Profile
              </Link>
            </nav>
          </div>
          <div>
            <h3 className="mb-4 text-lg font-semibold">Resources</h3>
            <nav className="space-y-2 text-sm">
              <a 
                href="https://docs.solana.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-purple-500"
              >
                Solana Docs
                <ExternalLink className="h-3 w-3" />
              </a>
              <a 
                href="https://github.com/solana-labs" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 transition-colors hover:text-purple-500"
              >
                Solana GitHub
                <ExternalLink className="h-3 w-3" />
              </a>
              <Link href="/faq" className="block transition-colors hover:text-purple-500">
                FAQ
              </Link>
              <Link href="/docs" className="block transition-colors hover:text-purple-500">
                Documentation
              </Link>
              <Link href="/support" className="block transition-colors hover:text-purple-500">
                Support
              </Link>
            </nav>
          </div>
          <div className="relative">
            <h3 className="mb-4 text-lg font-semibold">Connect With Us</h3>
            <div className="mb-6 flex space-x-4">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a 
                      href="https://github.com/solforge" 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="icon" className="rounded-full">
                        <Github className="h-4 w-4" />
                        <span className="sr-only">GitHub</span>
                      </Button>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow us on GitHub</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <a 
                      href="https://twitter.com/solforge" 
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="icon" className="rounded-full">
                        <Twitter className="h-4 w-4" />
                        <span className="sr-only">Twitter</span>
                      </Button>
                    </a>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Follow us on Twitter</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">Contact Support:</p>
              <a 
                href="mailto:support@solforge.dev"
                className="block transition-colors hover:text-purple-500"
              >
                support@solforge.dev
              </a>
            </div>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 text-center md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2024 SolForge. All rights reserved.
          </p>
          <nav className="flex gap-4 text-sm">
            <Link href="/privacy" className="transition-colors hover:text-purple-500">
              Privacy Policy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-purple-500">
              Terms of Service
            </Link>
            <Link href="/cookies" className="transition-colors hover:text-purple-500">
              Cookie Policy
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  )
} 