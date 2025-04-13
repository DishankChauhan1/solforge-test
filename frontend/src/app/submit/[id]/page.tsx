'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { getBountyById, submitBountyWork } from '@/lib/firebase';
import { IBounty } from '@/types/bounty';

export default function SubmitWorkPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { connected } = useWallet();
  const [bounty, setBounty] = useState<IBounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [prLink, setPrLink] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user || !connected) {
      router.push(`/bounties/${id}`);
      return;
    }

    async function fetchBounty() {
      try {
        const bountyData = await getBountyById(id as string);
        if (!bountyData || bountyData.status !== 'open') {
          router.push('/dashboard/available-bounties');
          return;
        }
        setBounty(bountyData);
      } catch (error) {
        console.error('Error fetching bounty:', error);
        setError('Failed to load bounty details');
      } finally {
        setLoading(false);
      }
    }

    fetchBounty();
  }, [id, user, connected, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prLink.trim()) {
      setError('Please enter a valid PR link');
      return;
    }

    if (!prLink.match(/^https:\/\/github\.com\/.*\/pull\/\d+$/)) {
      setError('Please enter a valid GitHub pull request URL');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await submitBountyWork({
        bountyId: id as string,
        prLink: prLink.trim(),
        userId: user!.uid,
      });
      router.push('/dashboard/my-submissions');
    } catch (error) {
      console.error('Error submitting work:', error);
      setError('Failed to submit work. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700"></div>
      </div>
    );
  }

  if (!bounty) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-16 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8">
        <div className="max-w-max mx-auto text-center">
          <h1 className="text-4xl font-bold text-gray-900">Bounty not found</h1>
          <p className="mt-4 text-gray-500">The bounty you're looking for doesn't exist or has been closed.</p>
          <div className="mt-10">
            <button
              onClick={() => router.push('/dashboard/available-bounties')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
            >
              Go back to bounties
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Submit Work for &quot;{bounty.title}&quot;
            </h3>
            <div className="mt-2 max-w-xl text-sm text-gray-500">
              <p>
                Please provide the link to your pull request. Make sure your PR follows the
                repository&apos;s contribution guidelines.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="mt-5">
              <div className="w-full sm:max-w-xs">
                <label htmlFor="pr-link" className="sr-only">
                  Pull Request URL
                </label>
                <input
                  type="url"
                  name="pr-link"
                  id="pr-link"
                  value={prLink}
                  onChange={(e) => setPrLink(e.target.value)}
                  className="shadow-sm focus:ring-purple-500 focus:border-purple-500 block w-full sm:text-sm border-gray-300 rounded-md"
                  placeholder="https://github.com/owner/repo/pull/123"
                  required
                  pattern="^https:\/\/github\.com\/.*\/pull\/\d+$"
                />
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600" id="pr-link-error">
                  {error}
                </p>
              )}
              <div className="mt-5">
                <button
                  type="submit"
                  disabled={submitting}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                    submitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  {submitting ? 'Submitting...' : 'Submit Work'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 