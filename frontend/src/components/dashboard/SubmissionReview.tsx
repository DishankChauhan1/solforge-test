'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { getSubmissions, updateSubmissionStatus } from '@/lib/firebase';
import { ISubmission } from '@/types/submission';
import { formatDistanceToNow } from 'date-fns';

type ReviewFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function SubmissionReview() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<ISubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        // Get submissions for bounties created by the current user
        const fetchedSubmissions = await getSubmissions({ userId: user.uid });
        setSubmissions(fetchedSubmissions);
      } catch (err) {
        setError('Failed to fetch submissions');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user]);

  const filteredSubmissions = submissions.filter(submission => {
    if (filter === 'all') return true;
    return submission.status === filter;
  });

  const handleReview = async (submissionId: string, status: 'approved' | 'rejected', comments?: string) => {
    if (!user) return;

    try {
      await updateSubmissionStatus({
        submissionId,
        status,
        reviewerId: user.uid,
        reviewerComments: comments
      });

      setSubmissions(submissions.map(s => 
        s.id === submissionId ? { ...s, status, reviewerId: user.uid, reviewerComments: comments } : s
      ));
    } catch (err) {
      setError('Failed to update submission status');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ReviewFilter)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        >
          <option value="all">All Submissions</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {filteredSubmissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No submissions found
          </div>
        ) : (
          filteredSubmissions.map(submission => (
            <div
              key={submission.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-4"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-medium">Pull Request</h3>
                  <a
                    href={submission.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-500 text-sm"
                  >
                    {submission.prUrl}
                  </a>
                  <p className="text-sm text-gray-500 mt-1">
                    Submitted {formatDistanceToNow(
                      submission.createdAt && 'seconds' in submission.createdAt 
                        ? new Date(submission.createdAt.seconds * 1000) 
                        : new Date(submission.createdAt),
                      { addSuffix: true }
                    )}
                  </p>
                </div>
                <div className="flex gap-2">
                  {submission.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleReview(submission.id, 'approved')}
                        className="px-3 py-1 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => handleReview(submission.id, 'rejected')}
                        className="px-3 py-1 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700"
                      >
                        Reject
                      </button>
                    </>
                  )}
                  {submission.status !== 'pending' && (
                    <span className={`px-2 py-1 text-sm rounded-md ${
                      submission.status === 'approved' 
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                    </span>
                  )}
                </div>
              </div>
              {submission.reviewerComments && (
                <div className="mt-3 text-sm text-gray-600">
                  <p className="font-medium">Review Comments:</p>
                  <p className="mt-1">{submission.reviewerComments}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
} 