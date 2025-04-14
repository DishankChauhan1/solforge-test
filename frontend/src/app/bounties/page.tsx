'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { getAllBountiesFunction } from '@/lib/firebase';
import { IBounty } from '@/types/bounty';
import Link from 'next/link';

export default function BountiesPage() {
  const [bounties, setBounties] = useState<IBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const wallet = useWallet();

  useEffect(() => {
    async function fetchBounties() {
      try {
        const getAllBounties = getAllBountiesFunction();
        const { data } = await getAllBounties();
        setBounties(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching bounties:', error);
        setBounties([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBounties();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Open Bounties</h1>
        {user && wallet.connected && (
          <Link
            href="/bounties/create"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
          >
            Create Bounty
          </Link>
        )}
      </div>

      {bounties.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No bounties available</h3>
          <p className="mt-2 text-gray-500">
            Check back later or create a new bounty.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {bounties.map((bounty) => (
            <div
              key={bounty.id}
              className="bg-white shadow rounded-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-lg font-medium text-gray-900">
                  <Link href={`/bounties/${bounty.id}`} className="hover:text-purple-600">
                    {bounty.title}
                  </Link>
                </h3>
                <span
                  className={`px-2 py-1 text-sm font-medium rounded-full ${
                    bounty.status === 'open'
                      ? 'bg-green-100 text-green-800'
                      : bounty.status === 'in_progress'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {bounty.status.replace('_', ' ').charAt(0).toUpperCase() + 
                   bounty.status.slice(1).replace('_', ' ')}
                </span>
              </div>

              <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                {bounty.description}
              </p>

              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-purple-600">{bounty.amount} {bounty.currency}</span>
                </div>
                <div className="flex space-x-2">
                  <a
                    href={bounty.repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                  </a>
                  <a
                    href={bounty.issueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 