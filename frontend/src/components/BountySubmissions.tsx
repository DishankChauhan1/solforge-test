import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import TimeAgo from 'react-timeago';
import { useAuth } from '../contexts/AuthContext';

interface BountySubmission {
  id: string;
  bountyId: string;
  userId: string;
  pullRequestUrl: string;
  description: string;
  status: 'submitted' | 'approved' | 'rejected';
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
  rejectionReason?: string;
}

interface BountySubmissionsProps {
  bountyId: string;
  isCreator: boolean;
  onApprove?: (submission: BountySubmission) => void;
}

const BountySubmissions: React.FC<BountySubmissionsProps> = ({ bountyId, isCreator, onApprove }) => {
  const [submissions, setSubmissions] = useState<BountySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!bountyId) return;
    
    const fetchSubmissions = async () => {
      try {
        setLoading(true);
        const getBountySubmissions = httpsCallable(functions, 'getBountySubmissionsHandler');
        const result = await getBountySubmissions({ bountyId });
        const data = result.data as { success: boolean; submissions: BountySubmission[] };
        
        if (data.success) {
          setSubmissions(data.submissions);
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
  }, [bountyId]);

  const handleApprove = async (submissionId: string) => {
    try {
      const approveSubmission = httpsCallable(functions, 'approveSubmissionHandler');
      const result = await approveSubmission({ submissionId, bountyId });
      const data = result.data as { success: boolean; message: string };
      
      if (data.success) {
        // Success notification would be shown here
        // We're avoiding Chakra's toast
        alert('Submission approved. The payment process has been initiated.');
        
        // Update local state to show approval
        setSubmissions(prevSubmissions => 
          prevSubmissions.map(sub => 
            sub.id === submissionId ? { ...sub, status: 'approved' } : sub
          )
        );
        
        if (onApprove) {
          onApprove(submissions.find(s => s.id === submissionId)!);
        }
      }
    } catch (err) {
      console.error('Error approving submission:', err);
      alert('Failed to approve submission');
    }
  };

  const handleReject = async (submissionId: string, reason: string = '') => {
    try {
      const rejectSubmission = httpsCallable(functions, 'rejectSubmissionHandler');
      const result = await rejectSubmission({ submissionId, rejectionReason: reason });
      const data = result.data as { success: boolean };
      
      if (data.success) {
        alert('Submission rejected');
        
        // Update local state to show rejection
        setSubmissions(prevSubmissions => 
          prevSubmissions.map(sub => 
            sub.id === submissionId ? { ...sub, status: 'rejected', rejectionReason: reason } : sub
          )
        );
      }
    } catch (err) {
      console.error('Error rejecting submission:', err);
      alert('Failed to reject submission');
    }
  };

  if (loading) {
    return (
      <div className="text-center py-6">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
        <p className="mt-4">Loading submissions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-800 rounded-md">
        <p>{error}</p>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-md">
        <p>No submissions yet for this bounty.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 w-full">
      <h2 className="text-xl font-bold mb-2">
        Submissions ({submissions.length})
      </h2>
      
      {submissions.map((submission) => (
        <div 
          key={submission.id} 
          className={`p-4 border rounded-md ${
            submission.status === 'approved' ? 'border-green-200 bg-green-50' : 
            submission.status === 'rejected' ? 'border-red-200 bg-red-50' : 
            'border-gray-200 bg-white'
          }`}
        >
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <div className="flex items-center">
                <a 
                  href={submission.pullRequestUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-bold mr-2 text-blue-600 hover:underline"
                >
                  {new URL(submission.pullRequestUrl).pathname.split('/').pop()}
                </a>
                <span 
                  className={`text-xs px-2 py-1 rounded-full ${
                    submission.status === 'approved' ? 'bg-green-100 text-green-800' : 
                    submission.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                    'bg-blue-100 text-blue-800'
                  }`}
                >
                  {submission.status}
                </span>
              </div>
              
              <p className="text-sm text-gray-600">
                Submitted <TimeAgo date={new Date(submission.createdAt.seconds * 1000)} />
              </p>
              
              {submission.description && (
                <p className="mt-2">{submission.description}</p>
              )}
              
              {submission.rejectionReason && (
                <div className="mt-2 p-2 bg-red-100 rounded-md">
                  <p className="font-bold">Rejection reason:</p>
                  <p>{submission.rejectionReason}</p>
                </div>
              )}
            </div>
            
            {isCreator && submission.status === 'submitted' && (
              <div className="flex">
                <button 
                  className="px-3 py-1 mr-2 text-sm bg-green-500 hover:bg-green-600 text-white rounded"
                  onClick={() => handleApprove(submission.id)}
                >
                  Approve
                </button>
                <button 
                  className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded"
                  onClick={() => handleReject(submission.id)}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default BountySubmissions; 