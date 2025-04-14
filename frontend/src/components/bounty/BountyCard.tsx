'use client';

import Link from 'next/link';
import { IBounty } from '@/types/bounty';
import { formatCurrency } from '@/utils/currency';

interface BountyCardProps {
  bounty: IBounty;
}

export function BountyCard({ bounty }: BountyCardProps) {
  return (
    <div className="bg-white overflow-hidden shadow rounded-lg divide-y divide-gray-200">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">
          <Link href={`/bounties/${bounty.id}`} className="hover:text-purple-600">
            {bounty.title}
          </Link>
        </h3>
        <p className="mt-1 text-sm text-gray-500 line-clamp-2">
          {bounty.description}
        </p>
      </div>
      <div className="px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
              bounty.status === 'open' ? 'bg-green-100 text-green-800' :
              bounty.status === 'in_progress' ? 'bg-yellow-100 text-yellow-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {bounty.status.charAt(0).toUpperCase() + bounty.status.slice(1).replace('_', ' ')}
            </span>
            <span className="ml-2 px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
              {formatCurrency(bounty.amount, bounty.currency)}
            </span>
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
    </div>
  );
} 