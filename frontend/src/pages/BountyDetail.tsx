import React, { useState, useEffect, useRef } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import TimeAgo from 'react-timeago';
import BountySubmissions from '../components/BountySubmissions';
import SubmitClaimForm from '../components/SubmitClaimForm';

interface Bounty {
  id: string;
  title: string;
  description: string;
  amount: number;
  tokenMint?: string;
  issueUrl: string;
  repositoryUrl: string;
  createdBy: string;
  createdAt: { seconds: number; nanoseconds: number };
  updatedAt: { seconds: number; nanoseconds: number };
  status: 'open' | 'claimed' | 'completed' | 'cancelled';
  claimedBy?: string;
  claimedAt?: { seconds: number; nanoseconds: number };
  hasSubmissions?: boolean;
}

const BountyDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const history = useHistory();
  
  // State for modals and forms
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [isCancelAlertOpen, setIsCancelAlertOpen] = useState(false);
  const [isExtendingDeadline, setIsExtendingDeadline] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [newDeadline, setNewDeadline] = useState('');
  const [activeTab, setActiveTab] = useState(0);
  
  const cancelRef = useRef<HTMLButtonElement>(null);

  const fetchBounty = async () => {
    try {
      setLoading(true);
      const getBountyById = httpsCallable(functions, 'getBountyById');
      const result = await getBountyById({ bountyId: id });
      const data = result.data as Bounty;
      setBounty(data);
    } catch (err) {
      console.error('Error fetching bounty:', err);
      setError('Failed to load bounty details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchBounty();
    }
  }, [id]);

  const handleSubmitSuccess = () => {
    // Refresh bounty data to show updated status
    fetchBounty();
    
    // Change tab back to submissions
    setActiveTab(0);
  };

  const handleCancelBounty = async () => {
    if (!bounty) return;
    
    setIsCancelling(true);
    try {
      const cancelBountyFn = httpsCallable(functions, 'cancelBountyHandler');
      const result = await cancelBountyFn({ bountyId: bounty.id });
      const data = result.data as { success: boolean };
      
      if (data.success) {
        alert('The bounty has been cancelled and funds returned');
        
        // Refresh the bounty data
        fetchBounty();
      }
    } catch (err) {
      console.error('Error cancelling bounty:', err);
      alert('Failed to cancel bounty');
    } finally {
      setIsCancelling(false);
      setIsCancelAlertOpen(false);
    }
  };

  const handleExtendDeadline = async () => {
    if (!bounty || !newDeadline) return;
    
    setIsExtendingDeadline(true);
    try {
      // Convert the date string to a Unix timestamp (seconds)
      const deadlineTimestamp = Math.floor(new Date(newDeadline).getTime() / 1000);
      
      const extendDeadlineFn = httpsCallable(functions, 'extendDeadlineHandler');
      const result = await extendDeadlineFn({ 
        bountyId: bounty.id,
        newDeadline: deadlineTimestamp 
      });
      
      const data = result.data as { success: boolean };
      
      if (data.success) {
        alert('The bounty deadline has been successfully extended');
        
        // Refresh the bounty data
        fetchBounty();
      }
    } catch (err) {
      console.error('Error extending deadline:', err);
      alert('Failed to extend deadline');
    } finally {
      setIsExtendingDeadline(false);
      setIsExtendModalOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-8 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
        <p className="mt-4">Loading bounty details...</p>
      </div>
    );
  }

  if (error || !bounty) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="p-5 shadow-md border border-red-200 rounded-md bg-red-50">
          <h2 className="text-lg font-medium text-red-500">Error</h2>
          <p className="mt-2">{error || 'Bounty not found'}</p>
        </div>
      </div>
    );
  }

  const isCreator = user && user.uid === bounty.createdBy;
  const hasSubmitted = bounty.hasSubmissions;
  const canSubmit = bounty.status === 'open' && user && user.uid !== bounty.createdBy;

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="space-y-6">
        <div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">{bounty.title}</h1>
            <span className={`text-sm px-3 py-1 rounded-full ${
              bounty.status === 'open' ? 'bg-green-100 text-green-800' : 
              bounty.status === 'completed' ? 'bg-blue-100 text-blue-800' : 
              bounty.status === 'claimed' ? 'bg-orange-100 text-orange-800' : 
              'bg-gray-100 text-gray-800'
            }`}>
              {bounty.status}
            </span>
          </div>
          <p className="mt-2 text-sm text-gray-600">
            Created <TimeAgo date={new Date(bounty.createdAt.seconds * 1000)} />
          </p>
        </div>

        <div className="p-4 shadow-md border border-gray-200 rounded-md">
          <h2 className="text-lg font-medium">Description</h2>
          <p className="mt-2 whitespace-pre-wrap">{bounty.description}</p>
          
          <hr className="my-4 border-gray-200" />
          
          <div className="flex justify-between">
            <div>
              <p className="font-bold">Reward</p>
              <p>{bounty.amount} {bounty.tokenMint ? 'Tokens' : 'SOL'}</p>
            </div>
            
            <div>
              <p className="font-bold">Issue</p>
              <a 
                href={bounty.issueUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline"
              >
                View on GitHub
              </a>
            </div>
            
            <div>
              <p className="font-bold">Repository</p>
              <a 
                href={bounty.repositoryUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-blue-600 hover:underline"
              >
                {new URL(bounty.repositoryUrl).pathname.substring(1)}
              </a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border border-gray-200 rounded-md overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setActiveTab(0)}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 0 
                  ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                  : 'bg-gray-50 text-gray-500 hover:text-gray-700'
              }`}
            >
              Submissions
            </button>
            
            {canSubmit && (
              <button 
                onClick={() => setActiveTab(1)}
                className={`px-4 py-2 text-sm font-medium ${
                  activeTab === 1 
                    ? 'bg-white border-b-2 border-blue-500 text-blue-600' 
                    : 'bg-gray-50 text-gray-500 hover:text-gray-700'
                }`}
              >
                Submit Solution
              </button>
            )}
          </div>

          <div className="p-4">
            {activeTab === 0 && (
              <BountySubmissions 
                bountyId={bounty.id} 
                isCreator={isCreator || false} 
                onApprove={() => fetchBounty()}
              />
            )}
            
            {activeTab === 1 && canSubmit && (
              <div className="p-4 border border-gray-200 rounded-md">
                <h2 className="text-lg font-medium mb-4">Submit Your Solution</h2>
                <SubmitClaimForm 
                  bountyId={bounty.id} 
                  onSubmitSuccess={handleSubmitSuccess} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {isCreator && bounty.status === 'open' && (
          <div className="flex justify-end mt-4">
            <button 
              className="px-4 py-2 mr-3 bg-red-600 hover:bg-red-700 text-white rounded-md"
              onClick={() => setIsCancelAlertOpen(true)}
              disabled={isCancelling}
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Bounty'}
            </button>
            <button 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
              onClick={() => setIsExtendModalOpen(true)}
              disabled={isExtendingDeadline}
            >
              {isExtendingDeadline ? 'Extending...' : 'Extend Deadline'}
            </button>
          </div>
        )}
      </div>

      {/* Cancel Bounty Alert Dialog */}
      {isCancelAlertOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-5 mx-auto w-full max-w-md bg-white rounded-md shadow-lg">
            <div className="mt-3">
              <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h3 className="mt-2 text-center text-xl font-medium text-gray-900">Cancel Bounty</h3>
              <p className="mt-2 text-center text-gray-600">
                Are you sure you want to cancel this bounty? This will return the funds to your wallet and cannot be undone.
              </p>
              <div className="flex justify-end mt-4">
                <button
                  ref={cancelRef}
                  className="px-4 py-2 mr-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                  onClick={() => setIsCancelAlertOpen(false)}
                >
                  No, Keep Bounty
                </button>
                <button
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
                  onClick={handleCancelBounty}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Yes, Cancel Bounty'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Extend Deadline Modal */}
      {isExtendModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative p-5 mx-auto w-full max-w-md bg-white rounded-md shadow-lg">
            <h3 className="text-lg font-medium text-gray-900">Extend Bounty Deadline</h3>
            <button 
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-500"
              onClick={() => setIsExtendModalOpen(false)}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="mt-4">
              <div>
                <label htmlFor="newDeadline" className="block text-sm font-medium text-gray-700">New Deadline</label>
                <input
                  id="newDeadline"
                  type="datetime-local"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end">
              <button
                className="px-4 py-2 mr-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md"
                onClick={() => setIsExtendModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={`px-4 py-2 text-white rounded-md ${
                  !newDeadline || isExtendingDeadline 
                    ? 'bg-blue-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
                onClick={handleExtendDeadline}
                disabled={!newDeadline || isExtendingDeadline}
              >
                {isExtendingDeadline ? 'Extending...' : 'Extend Deadline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BountyDetail; 