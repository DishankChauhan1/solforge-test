'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { getBountyById } from '@/lib/firebase';
import { IBounty } from '@/types/bounty';
import { formatCurrency } from '@/utils/currency';

export default function BountyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { connected } = useWallet();
  const [bounty, setBounty] = useState<IBounty | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBounty() {
      if (!id) return;
      try {
        const bountyData = await getBountyById(id as string);
        setBounty(bountyData);
      } catch (error) {
        console.error('Error fetching bounty:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBounty();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700" />
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
        <div className="max-w-max mx-auto">
          <main className="sm:flex">
            <p className="text-4xl font-bold text-purple-600 sm:text-5xl">404</p>
            <div className="sm:ml-6">
              <div className="sm:border-l sm:border-gray-200 sm:pl-6">
                <h1 className="text-4xl font-bold text-gray-900 tracking-tight sm:text-5xl">
                  Bounty not found
                </h1>
                <p className="mt-1 text-base text-gray-500">
                  Please check the URL and try again.
                </p>
              </div>
              <div className="mt-10 flex space-x-3 sm:border-l sm:border-transparent sm:pl-6">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                >
                  Go back to dashboard
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const canSubmit = bounty.status === 'open' && user && connected;
  const isCreator = user?.uid === bounty.creatorId;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-2xl font-bold leading-6 text-gray-900">
              {bounty.title}
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Created by {bounty.creatorId} on{' '}
              {bounty.createdAt.toDate().toLocaleDateString()}
            </p>
          </div>
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Description</dt>
                <dd className="mt-1 text-sm text-gray-900">{bounty.description}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Status</dt>
                <dd className="mt-1">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full
                    ${bounty.status === 'open' ? 'bg-green-100 text-green-800' :
                      bounty.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
                      bounty.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                    {bounty.status.replace('_', ' ')}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Reward</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatCurrency(bounty.amount, bounty.currency)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Links</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  <div className="space-y-2">
                    <div>
                      <Link
                        href={bounty.repositoryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-500"
                      >
                        View Repository →
                      </Link>
                    </div>
                    <div>
                      <Link
                        href={bounty.issueUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-600 hover:text-purple-500"
                      >
                        View Issue →
                      </Link>
                    </div>
                  </div>
                </dd>
              </div>
            </dl>
          </div>
          <div className="bg-gray-50 px-4 py-5 sm:px-6">
            {!user ? (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">
                  Sign in to submit your work
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
                >
                  Sign In
                </button>
              </div>
            ) : !connected ? (
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-4">
                  Connect your wallet to submit work
                </p>
                <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
              </div>
            ) : canSubmit ? (
              <div className="text-center">
                <Link
                  href={`/submit/${bounty.id}`}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
                >
                  Submit Work
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
} 