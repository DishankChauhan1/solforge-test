'use client';

import Link from 'next/link';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { GitHubLoginButton } from '@/components/GitHubLoginButton';

export default function Home() {
  return (
    <div className="relative">
      {/* Hero section */}
      <div className="relative px-6 lg:px-8">
        <div className="mx-auto max-w-3xl pt-20 pb-32 sm:pt-48 sm:pb-40">
          <div>
            <div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-center sm:text-6xl">
                Accelerate Open Source Development with Bounties
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 sm:text-center">
                Connect your GitHub and Solana wallet to start earning or posting bounties for open source contributions.
              </p>
              <div className="mt-8 flex gap-x-4 sm:justify-center">
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
                <GitHubLoginButton />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature section */}
      <div className="mt-32 sm:mt-56">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl sm:text-center">
            <h2 className="text-base font-semibold leading-7 text-purple-600">Everything you need</h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              No complex setup needed
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600">
              Start earning or posting bounties in minutes with our simple platform.
            </p>
          </div>

          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  Secure Payments
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    All bounties are secured by Solana smart contracts, ensuring safe and transparent transactions.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  GitHub Integration
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Seamlessly connect with GitHub to manage bounties and verify contributions.
                  </p>
                </dd>
              </div>
              <div className="flex flex-col">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  Real-time Updates
                </dt>
                <dd className="mt-1 flex flex-auto flex-col text-base leading-7 text-gray-600">
                  <p className="flex-auto">
                    Get instant notifications about bounty status changes and new opportunities.
                  </p>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
} 