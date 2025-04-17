import React, { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';

interface SubmitClaimFormProps {
  bountyId: string;
  onSubmitSuccess?: () => void;
}

const SubmitClaimForm: React.FC<SubmitClaimFormProps> = ({ 
  bountyId, 
  onSubmitSuccess 
}) => {
  const [prLink, setPrLink] = useState('');
  const [commitHash, setCommitHash] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prLinkError, setPrLinkError] = useState('');
  const [commitHashError, setCommitHashError] = useState('');

  const validatePrLink = (url: string) => {
    if (!url) {
      return 'Pull request URL is required';
    }
    
    try {
      const urlObj = new URL(url);
      if (!urlObj.hostname.includes('github.com') || !url.includes('/pull/')) {
        return 'Please enter a valid GitHub pull request URL';
      }
      return '';
    } catch (e) {
      return 'Please enter a valid URL';
    }
  };

  const validateCommitHash = (hash: string) => {
    if (!hash) {
      return 'Commit hash is required';
    }
    
    // SHA-1 hashes are 40 characters long, but we'll accept at least 7 characters (short hash)
    const validHashRegex = /^[0-9a-f]{7,40}$/i;
    if (!validHashRegex.test(hash)) {
      return 'Please enter a valid commit hash (at least 7 characters)';
    }
    
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    const prError = validatePrLink(prLink);
    const commitError = validateCommitHash(commitHash);
    
    if (prError) {
      setPrLinkError(prError);
      return;
    }
    
    if (commitError) {
      setCommitHashError(commitError);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const submitClaim = httpsCallable(functions, 'submitClaimHandler');
      const result = await submitClaim({
        bountyId,
        prLink,
        commitHash,
        description
      });
      
      const data = result.data as { success: boolean; submission: any };
      
      if (data.success) {
        alert('Your submission has been recorded and is awaiting review');
        
        // Reset form
        setPrLink('');
        setCommitHash('');
        setDescription('');
        
        // Callback to parent
        if (onSubmitSuccess) {
          onSubmitSuccess();
        }
      }
    } catch (error: any) {
      console.error('Error submitting claim:', error);
      alert(error.message || 'An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <label htmlFor="prLink" className="block text-sm font-medium text-gray-700 mb-1">
            GitHub Pull Request URL <span className="text-red-500">*</span>
          </label>
          <input
            id="prLink"
            type="url"
            placeholder="https://github.com/owner/repo/pull/123"
            value={prLink}
            onChange={(e) => {
              setPrLink(e.target.value);
              setPrLinkError('');
            }}
            className={`w-full px-3 py-2 border rounded-md ${prLinkError ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {prLinkError && <p className="mt-1 text-sm text-red-600">{prLinkError}</p>}
        </div>
        
        <div>
          <label htmlFor="commitHash" className="block text-sm font-medium text-gray-700 mb-1">
            Commit Hash <span className="text-red-500">*</span>
            <span className="ml-1 text-xs text-gray-500">(The SHA of your main commit)</span>
          </label>
          <input
            id="commitHash"
            type="text"
            placeholder="e.g. 8d1c942a7b1b9545dc23b9e62c52c234f9d1b8a4"
            value={commitHash}
            onChange={(e) => {
              setCommitHash(e.target.value);
              setCommitHashError('');
            }}
            className={`w-full px-3 py-2 border rounded-md ${commitHashError ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-blue-500`}
          />
          {commitHashError && <p className="mt-1 text-sm text-red-600">{commitHashError}</p>}
          <p className="mt-1 text-xs text-gray-500">
            You can find this by running <code className="bg-gray-100 px-1 py-0.5 rounded">git rev-parse HEAD</code> in your repository.
          </p>
        </div>
        
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Description <span className="text-gray-500 text-xs">(Optional)</span>
          </label>
          <textarea
            id="description"
            placeholder="Briefly describe your solution and any implementation details worth mentioning..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full px-4 py-2 text-white font-medium rounded-md ${
            isSubmitting 
              ? 'bg-blue-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
          }`}
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Submitting...
            </span>
          ) : 'Submit Claim'}
        </button>
      </div>
    </form>
  );
};

export default SubmitClaimForm; 