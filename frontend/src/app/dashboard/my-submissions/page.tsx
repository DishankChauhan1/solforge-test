'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { IBountySubmission, SubmissionStatus } from '@/types/submission';
import { getSubmissions } from '@/lib/firebase';
import { Timestamp } from 'firebase/firestore';

export default function MySubmissionsPage() {
  const [submissions, setSubmissions] = useState<IBountySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const router = useRouter();
  const wallet = useWallet();

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    async function fetchSubmissions() {
      try {
        const userSubmissions = await getSubmissions({ userId: user?.uid });
        setSubmissions(userSubmissions || []);
      } catch (error) {
        console.error('Error fetching submissions:', error);
        setSubmissions([]);
      } finally {
        setLoading(false);
      }
    }

    if (user?.uid) {
      fetchSubmissions();
    }
  }, [user, router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Submissions</h1>
      
      {submissions.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-gray-900">No submissions yet</h3>
          <p className="mt-2 text-gray-500">
            Start contributing to bounties to see your submissions here.
          </p>
          <div className="mt-6">
            <Link
              href="/bounties"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700"
            >
              Browse Bounties
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid gap-6">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="bg-white shadow rounded-lg p-6 border border-gray-200"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    <Link href={`/bounties/${submission.bountyId}`} className="hover:text-purple-600">
                      Bounty #{submission.bountyId}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Submitted {submission.createdAt instanceof Timestamp 
                      ? new Date(submission.createdAt.seconds * 1000).toLocaleDateString()
                      : new Date(submission.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-sm font-medium rounded-full ${
                    submission.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800'
                      : submission.status === 'approved'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                </span>
              </div>
              
              <div className="mt-4">
                <a
                  href={submission.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-600 hover:text-purple-500"
                >
                  View Pull Request →
                </a>
              </div>

              {submission.reviewerComments && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <h4 className="text-sm font-medium text-gray-900">Reviewer Comments:</h4>
                  <p className="mt-1 text-sm text-gray-500">{submission.reviewerComments}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 