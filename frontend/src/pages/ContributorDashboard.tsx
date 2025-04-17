import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import TimeAgo from 'react-timeago';

interface Submission {
  id: string;
  bountyId: string;
  userId: string;
  pullRequestUrl: string;
  commitHash: string;
  description?: string;
  status: 'submitted' | 'approved' | 'rejected';
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
  bountyTitle?: string;
  bountyAmount?: number;
  bountyTokenMint?: string;
  rejectionReason?: string;
  paymentStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  paymentSignature?: string;
}

const ContributorDashboard: React.FC = () => {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalEarned: 0,
    approvedSubmissions: 0,
    pendingSubmissions: 0,
    rejectedSubmissions: 0
  });
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setError('You must be logged in to view your submissions');
      setLoading(false);
      return;
    }

    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const getUserSubmissions = httpsCallable(functions, 'getUserSubmissions');
        const result = await getUserSubmissions({});
        const data = result.data as { success: boolean; submissions: Submission[] };

        if (data.success) {
          setSubmissions(data.submissions);
          
          // Calculate stats
          const approved = data.submissions.filter(s => s.status === 'approved');
          const pending = data.submissions.filter(s => s.status === 'submitted');
          const rejected = data.submissions.filter(s => s.status === 'rejected');
          
          // Calculate total earnings
          const totalEarned = approved.reduce((total, s) => {
            return total + (s.bountyAmount || 0);
          }, 0);
          
          setStats({
            totalEarned,
            approvedSubmissions: approved.length,
            pendingSubmissions: pending.length,
            rejectedSubmissions: rejected.length
          });
        } else {
          setError('Failed to fetch submissions');
        }
      } catch (err) {
        console.error('Error fetching submissions:', err);
        setError('Error loading submissions');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user]);

  const formatCurrency = (amount: number, tokenMint?: string) => {
    return `${amount.toLocaleString()} ${tokenMint ? 'Tokens' : 'SOL'}`;
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-solid border-current border-r-transparent align-[-0.125em]"></div>
        <p className="mt-4">Loading your submissions...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <h2 className="text-lg font-medium text-yellow-800">Authentication Required</h2>
          <p className="mt-2 text-sm text-yellow-700">
            You need to log in to view your submission history.
          </p>
          <div className="mt-4">
            <Link 
              to="/login" 
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <h2 className="text-lg font-medium text-red-800">Error</h2>
          <p className="mt-2 text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Your Submissions</h1>
      
      {/* Stats Overview */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Total Earned</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900">
              {formatCurrency(stats.totalEarned)}
            </dd>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Approved Submissions</dt>
            <dd className="mt-1 text-3xl font-semibold text-green-600">
              {stats.approvedSubmissions}
            </dd>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Pending Review</dt>
            <dd className="mt-1 text-3xl font-semibold text-yellow-600">
              {stats.pendingSubmissions}
            </dd>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
            <dd className="mt-1 text-3xl font-semibold text-red-600">
              {stats.rejectedSubmissions}
            </dd>
          </div>
        </div>
      </div>
      
      {/* Submission History */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {submissions.length === 0 ? (
            <li className="px-4 py-6 text-center text-gray-500">
              <p>You haven't submitted any bounty claims yet.</p>
              <Link to="/bounties" className="mt-2 inline-block text-blue-600 hover:text-blue-500">
                Browse available bounties
              </Link>
            </li>
          ) : (
            submissions.map((submission) => (
              <li key={submission.id} className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col flex-grow">
                    <div className="flex items-center">
                      <div className="text-lg font-medium text-blue-600 truncate">
                        {submission.bountyTitle || 'Untitled Bounty'}
                      </div>
                      <div className="ml-2">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          submission.status === 'approved' ? 'bg-green-100 text-green-800' : 
                          submission.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <span className="mr-2">
                        Submitted <TimeAgo date={new Date(submission.createdAt.seconds * 1000)} />
                      </span>
                      {submission.status === 'approved' && (
                        <span className="flex items-center">
                          <span className="mx-1">•</span>
                          <span className="text-green-600 font-medium">
                            {submission.bountyAmount ? formatCurrency(submission.bountyAmount, submission.bountyTokenMint) : 'Reward'} 
                          </span>
                          <span className="ml-1">
                            {submission.paymentStatus === 'completed' 
                              ? '• Payment complete' 
                              : submission.paymentStatus === 'processing' 
                                ? '• Payment processing' 
                                : '• Payment pending'}
                          </span>
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-sm">
                      <a 
                        href={submission.pullRequestUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline mr-4"
                      >
                        View PR
                      </a>
                      {submission.commitHash && (
                        <span className="text-gray-600">
                          Commit: <code className="bg-gray-100 px-2 py-0.5 rounded text-gray-800">{submission.commitHash.substring(0, 8)}</code>
                        </span>
                      )}
                    </div>
                    
                    {submission.rejectionReason && (
                      <div className="mt-2 p-2 bg-red-50 text-sm text-red-700 rounded-md">
                        <strong>Rejection reason:</strong> {submission.rejectionReason}
                      </div>
                    )}
                  </div>
                  
                  <div className="ml-4">
                    <Link 
                      to={`/bounties/${submission.bountyId}`}
                      className="text-blue-600 hover:text-blue-500"
                    >
                      <span className="sr-only">View bounty</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
};

export default ContributorDashboard; 