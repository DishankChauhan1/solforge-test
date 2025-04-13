'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { GitHubLoginButton } from '@/components/GitHubLoginButton';
import { Hero } from "@/components/Hero"

export default function Home() {
  return (
    <main>
      <Hero />
    </main>
  );
} 