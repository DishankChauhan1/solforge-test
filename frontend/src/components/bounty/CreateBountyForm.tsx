'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { createBountyFunction } from '@/lib/firebase';
import { createHash } from 'crypto';
import { PublicKey, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { createBountyInstruction } from '@/lib/solana/instructions';
import { BountyStatus } from '@/types/bounty';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { validateAndFetchIssue } from '@/lib/github';

interface FormData {
  issueUrl: string;
  repoUrl: string;
  amount: string;
  currency: 'SOL' | 'USDC';
  description: string;
  deadline: string;
}

// Add USDC mint constant
const USDC_MINT = new PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr'); // Devnet USDC

export function CreateBountyForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'pending' | 'confirming' | 'confirmed' | null>(null);
  const [isValidatingIssue, setIsValidatingIssue] = useState(false);
  const [issueValidationError, setIssueValidationError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<FormData>({
    issueUrl: '',
    repoUrl: '',
    amount: '',
    currency: 'SOL',
    description: '',
    deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  });

  const handleIssueUrlChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    setFormData(prev => ({ ...prev, issueUrl: value }));
    setIssueValidationError(null);

    if (value) {
      setIsValidatingIssue(true);
      try {
        const { isValid, issue, error } = await validateAndFetchIssue(value);
        if (isValid && issue) {
          setFormData(prev => ({
            ...prev,
            description: issue.body || '',
            repoUrl: issue.repository_url.replace('api.github.com/repos', 'github.com')
          }));
        } else if (error) {
          setIssueValidationError(error);
        }
      } catch (err: any) {
        setIssueValidationError(err.message || 'Failed to validate GitHub issue');
      } finally {
        setIsValidatingIssue(false);
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'issueUrl') {
      handleIssueUrlChange(e as React.ChangeEvent<HTMLInputElement>);
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const checkBalance = async (amount: number, currency: 'SOL' | 'USDC'): Promise<boolean> => {
    try {
      if (currency === 'SOL') {
        const balance = await connection.getBalance(publicKey!);
        // Add extra 0.01 SOL for transaction fees
        return balance >= (amount + 0.01 * LAMPORTS_PER_SOL);
      } else {
        const ata = await getAssociatedTokenAddress(USDC_MINT, publicKey!);
        const tokenAccount = await connection.getTokenAccountBalance(ata);
        return Number(tokenAccount.value.amount) >= amount;
      }
    } catch (err) {
      console.error('Error checking balance:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setTxStatus('pending');

    try {
      if (!user || !publicKey) {
        throw new Error('Please connect your wallet first');
      }

      // Validate form data
      if (!formData.issueUrl || !formData.repoUrl || !formData.amount || !formData.deadline) {
        throw new Error('Please fill in all required fields');
      }

      // Create issue hash
      const issueHash = createHash('sha256').update(formData.issueUrl).digest('hex');

      // Convert amount to lamports/smallest unit
      const amount = formData.currency === 'SOL' 
        ? Math.floor(parseFloat(formData.amount) * LAMPORTS_PER_SOL)
        : Math.floor(parseFloat(formData.amount) * 1e6); // USDC has 6 decimals

      // Check balance
      const hasBalance = await checkBalance(amount, formData.currency);
      if (!hasBalance) {
        throw new Error(`Insufficient ${formData.currency} balance`);
      }

      // Create and send transaction
      const transaction = new Transaction();
      const lockInstruction = await createBountyInstruction({
        issueHash,
        amount,
        currency: formData.currency,
        creator: publicKey,
      });
      
      transaction.add(lockInstruction);
      
      // Simulate transaction
      try {
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Transaction simulation failed: ${simulation.value.err.toString()}`);
        }
      } catch (err) {
        console.error('Simulation error:', err);
        throw new Error('Failed to simulate transaction. Please try again.');
      }

      setTxStatus('pending');
      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      const txHash = await sendTransaction(transaction, connection, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });
      
      setTxStatus('confirming');
      const confirmation = await connection.confirmTransaction({
        signature: txHash,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      
      if (confirmation.value.err) {
        throw new Error('Transaction failed to confirm');
      }
      
      setTxStatus('confirmed');

      // Extract title from issue URL
      const title = formData.issueUrl.split('/').pop() || 'Untitled Bounty';

      // Call Firebase Function to create bounty with metadata
      const createBounty = createBountyFunction();
      const { data } = await createBounty({
        title,
        issueUrl: formData.issueUrl,
        issueHash,
        repositoryUrl: formData.repoUrl,
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        status: 'open' as BountyStatus,
        creatorId: user.uid,
        creatorWallet: publicKey.toBase58(),
        locked: true,
        txHash: txHash.toString(),
        deadline: new Date(formData.deadline).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('Bounty creation result:', data);
      router.push('/bounties');
    } catch (err: any) {
      console.error('Error creating bounty:', err);
      setError(err?.message || err?.details || 'Failed to create bounty. Please try again.');
      setTxStatus(null);
    } finally {
      setLoading(false);
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center">
        <p className="mb-4 text-gray-600">Connect your wallet to create a bounty</p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      {issueValidationError && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {issueValidationError}
        </div>
      )}

      {txStatus && (
        <div className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-3 rounded-md">
          {txStatus === 'pending' && 'Waiting for transaction approval...'}
          {txStatus === 'confirming' && 'Confirming transaction...'}
          {txStatus === 'confirmed' && 'Transaction confirmed! Creating bounty...'}
        </div>
      )}

      <div>
        <label htmlFor="issueUrl" className="block text-sm font-medium text-gray-700">
          GitHub Issue URL*
        </label>
        <div className="relative">
          <input
            type="url"
            id="issueUrl"
            name="issueUrl"
            value={formData.issueUrl}
            onChange={handleChange}
            placeholder="https://github.com/owner/repo/issues/1"
            className={`mt-1 block w-full rounded-md border py-2 px-3 shadow-sm focus:outline-none focus:ring-1 ${
              issueValidationError
                ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                : 'border-gray-300 focus:border-indigo-500 focus:ring-indigo-500'
            }`}
            required
          />
          {isValidatingIssue && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <svg className="animate-spin h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>
        {issueValidationError && (
          <p className="mt-1 text-sm text-red-600">{issueValidationError}</p>
        )}
      </div>

      <div>
        <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-700">
          Repository URL*
        </label>
        <input
          type="url"
          id="repoUrl"
          name="repoUrl"
          value={formData.repoUrl}
          onChange={handleChange}
          placeholder="https://github.com/owner/repo"
          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount*
          </label>
          <input
            type="number"
            id="amount"
            name="amount"
            value={formData.amount}
            onChange={handleChange}
            min="0"
            step="0.000001"
            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
        </div>

        <div>
          <label htmlFor="currency" className="block text-sm font-medium text-gray-700">
            Currency
          </label>
          <select
            id="currency"
            name="currency"
            value={formData.currency}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="SOL">SOL</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
          Deadline*
        </label>
        <input
          type="date"
          id="deadline"
          name="deadline"
          value={formData.deadline}
          onChange={handleChange}
          min={new Date().toISOString().split('T')[0]}
          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          rows={4}
          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Describe the bounty requirements and acceptance criteria..."
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={loading || txStatus !== null}
          className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
            loading || txStatus !== null
              ? 'bg-indigo-400 cursor-not-allowed' 
              : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          }`}
        >
          {loading ? 'Creating...' : txStatus ? 'Processing...' : 'Create Bounty'}
        </button>
      </div>
    </form>
  );
} 