'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createBounty } from '@/lib/firebase';

interface BountyFormData {
  title: string;
  description: string;
  amount: string;
  currency: 'SOL' | 'USDC';
  issueUrl: string;
  repoUrl: string;
}

const initialFormData: BountyFormData = {
  title: '',
  description: '',
  amount: '',
  currency: 'SOL',
  issueUrl: '',
  repoUrl: '',
};

export default function CreateBountyPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { connected } = useWallet();
  const [formData, setFormData] = useState<BountyFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!user || !connected) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-900">
                {!user ? 'Sign in to create bounties' : 'Connect your wallet'}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {!user
                  ? 'You need to sign in with GitHub first'
                  : 'Connect your wallet to create bounties'}
              </p>
              <div className="mt-4">
                {!user ? (
                  <button
                    onClick={() => router.push('/login')}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700"
                  >
                    Sign In
                  </button>
                ) : (
                  <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700 w-full" />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.issueUrl.match(/^https:\/\/github\.com\/.*\/issues\/\d+$/)) {
      setError('Please enter a valid GitHub issue URL');
      return;
    }

    if (!formData.repoUrl.match(/^https:\/\/github\.com\/.*\/.*$/)) {
      setError('Please enter a valid GitHub repository URL');
      return;
    }

    if (isNaN(parseFloat(formData.amount)) || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setSubmitting(true);

    try {
      await createBounty({
        ...formData,
        amount: parseFloat(formData.amount),
        creatorId: user.uid,
        createdBy: user.githubUsername || user.displayName,
        repositoryUrl: ''
      });
      router.push('/dashboard/my-bounties');
    } catch (error) {
      console.error('Error creating bounty:', error);
      setError('Failed to create bounty. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg">
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">
                Create a New Bounty
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Fill in the details below to create a new bounty for your open source issue.
              </p>
            </div>

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                Title
              </label>
              <input
                type="text"
                name="title"
                id="title"
                required
                value={formData.title}
                onChange={handleChange}
                className="mt-1 block w-full shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                id="description"
                required
                rows={4}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm border-gray-300 rounded-md"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
                  Amount
                </label>
                <input
                  type="number"
                  name="amount"
                  id="amount"
                  required
                  min="0"
                  step="0.000001"
                  value={formData.amount}
                  onChange={handleChange}
                  className="mt-1 block w-full shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
                  Currency
                </label>
                <select
                  name="currency"
                  id="currency"
                  required
                  value={formData.currency}
                  onChange={handleChange}
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm rounded-md"
                >
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="issueUrl" className="block text-sm font-medium text-gray-700">
                GitHub Issue URL
              </label>
              <input
                type="url"
                name="issueUrl"
                id="issueUrl"
                required
                pattern="^https:\/\/github\.com\/.*\/issues\/\d+$"
                placeholder="https://github.com/owner/repo/issues/123"
                value={formData.issueUrl}
                onChange={handleChange}
                className="mt-1 block w-full shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700">
                GitHub Repository URL
              </label>
              <input
                type="url"
                name="repoUrl"
                id="repoUrl"
                required
                pattern="^https:\/\/github\.com\/.*\/.*$"
                placeholder="https://github.com/owner/repo"
                value={formData.repoUrl}
                onChange={handleChange}
                className="mt-1 block w-full shadow-sm focus:ring-purple-500 focus:border-purple-500 sm:text-sm border-gray-300 rounded-md"
              />
            </div>

            {error && (
              <div className="text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                  submitting ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {submitting ? 'Creating...' : 'Create Bounty'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 