"use client"

import { LayoutGroup, motion } from "framer-motion"
import { TextRotate } from "./ui/TextRotate"
import { Button } from "./ui/button"
import Link from "next/link"
import { Features } from "./Features"

export function Hero() {
  const rotatingTexts = [
    "Build the Future",
    "Earn Rewards ✨",
    "Code Together",
    "Get Paid",
    "Ship Fast 🚀",
    "Join Now",
  ]

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-start overflow-hidden bg-gradient-to-b from-background to-background/80">
      {/* Background Animation */}
      <div className="absolute inset-0 w-full h-full">
        <div className="absolute inset-0 bg-grid-white/10 bg-grid-16 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      </div>

      {/* Content */}
      <div className="relative z-10 container px-4 md:px-6 pt-32 pb-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <LayoutGroup>
              <motion.h1 
                className="flex flex-col items-center text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-balance"
                layout
              >
                <motion.span
                  layout
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  className="mb-2"
                >
                  SolForge
                </motion.span>
                <motion.div 
                  layout
                  className="flex items-center gap-3 text-gradient bg-clip-text"
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    className="pt-1 sm:pt-2"
                  >
                    Let's
                  </motion.span>
                  <TextRotate
                    texts={rotatingTexts}
                    splitBy="words"
                    staggerFrom="last"
                    staggerDuration={0.025}
                    rotationInterval={2000}
                    transition={{ type: "spring", damping: 30, stiffness: 400 }}
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "-120%" }}
                    mainClassName="px-3 py-1 sm:py-2 bg-gradient-to-r from-purple-500 to-cyan-500 overflow-hidden justify-center rounded-lg text-white"
                    elementLevelClassName="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold"
                    splitLevelClassName="overflow-hidden pb-0.5 sm:pb-1"
                  />
                </motion.div>
              </motion.h1>
            </LayoutGroup>
            <motion.p 
              className="mx-auto max-w-[700px] text-gray-500 md:text-xl dark:text-gray-400"
              layout
            >
              Empower open source development with blockchain-based bounties. Connect, contribute, and earn rewards.
            </motion.p>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-wrap justify-center gap-4"
          >
            <Link href="/bounties">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white"
              >
                Explore Bounties
              </Button>
            </Link>
            <Link href="/create">
              <Button
                size="lg"
                variant="outline"
                className="border-2"
              >
                Create Bounty
              </Button>
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-12"
          >
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">500+</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Active Bounties</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">1000+</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Contributors</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">50K+</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">SOL Distributed</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-3xl font-bold text-gradient bg-clip-text text-transparent bg-gradient-to-r from-purple-500 to-cyan-500">200+</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">Projects</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Features Section */}
      <div className="w-full bg-neutral-50/50 dark:bg-neutral-900/50 mt-16">
        <Features />
      </div>
    </div>
  )
} 