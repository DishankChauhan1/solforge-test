'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthProvider';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { validatePRForClaim } from '@/lib/github';
import { claimBountyFunction } from '@/lib/firebase';
import { IBounty } from '@/types/bounty';
import { Transaction } from '@solana/web3.js';
import { claimBountyInstruction } from '@/lib/solana/instructions';
import { PaymentStatus } from '@/components/payment/PaymentStatus';

interface ClaimBountyFormProps {
  bounty: IBounty;
}

interface ClaimBountyResult {
  success: boolean;
  error?: string;
  txHash?: string;
}

export function ClaimBountyForm({ bounty }: ClaimBountyFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  
  const [prUrl, setPrUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationStatus, setValidationStatus] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<'pending' | 'confirming' | 'confirmed' | null>(null);
  const [automatedPayment, setAutomatedPayment] = useState(true);
  const [automatedPaymentStatus, setAutomatedPaymentStatus] = useState<'pending' | 'processing' | 'completed' | 'failed' | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setValidationStatus('Validating pull request...');

    try {
      if (!user || !publicKey) {
        throw new Error('Please connect your wallet first');
      }

      // Validate PR and check if it can be claimed
      const validation = await validatePRForClaim(prUrl, bounty.issueUrl);
      if (!validation.canClaim) {
        throw new Error(validation.error || 'Invalid pull request');
      }

      setValidationStatus('Creating claim transaction...');
      setTxStatus('pending');
      
      // Check if we should use automated payments
      if (automatedPayment) {
        setAutomatedPaymentStatus('pending');
        setValidationStatus('Registering for automated payment...');
        
        // Call Firebase Function to register for automated payment
        const registerForAutomatedPayment = claimBountyFunction();
        try {
          const response = await registerForAutomatedPayment({
            bountyId: bounty.id,
            prUrl,
            claimerId: user.uid,
            claimerWallet: publicKey.toBase58(),
            txHash: 'pending-auto-complete', // Marker for automated processing
          });
          
          // Cast the response data to our expected type
          const result = (response?.data || {}) as ClaimBountyResult;
          
          if (result.success) {
            setAutomatedPaymentStatus('processing');
            setValidationStatus('Registration successful! Payment will be processed automatically when the PR is merged.');
            router.push('/dashboard/claimed-bounties');
          } else {
            setAutomatedPaymentStatus('failed');
            setPaymentError(result.error || 'Failed to register for automated payment');
            // Fall back to manual claiming
            setAutomatedPayment(false);
          }
        } catch (error: any) {
          console.error('Error registering for automated payment:', error);
          setAutomatedPaymentStatus('failed');
          setPaymentError(error?.message || 'Failed to register for automated payment');
          // Fall back to manual claiming
          setAutomatedPayment(false);
        }
        
        // If we're not falling back to manual claiming, finish here
        if (automatedPayment) {
          setLoading(false);
          setValidationStatus(null);
          return;
        }
      }
      
      // Manual payment flow (existing code)
      // Create and send transaction
      const transaction = new Transaction();
      const claimInstruction = await claimBountyInstruction({
        issueHash: bounty.issueHash,
        amount: bounty.amount,
        currency: bounty.currency,
        creator: bounty.creatorWallet,
        claimer: publicKey,
      });
      
      transaction.add(claimInstruction);

      // Simulate transaction
      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        throw new Error(`Transaction simulation failed: ${simulation.value.err.toString()}`);
      }

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
      setValidationStatus('Updating bounty status...');

      // Call Firebase Function to update bounty status
      const claimBounty = claimBountyFunction();
      await claimBounty({
        bountyId: bounty.id,
        prUrl,
        claimerId: user.uid,
        claimerWallet: publicKey.toBase58(),
        txHash: txHash.toString(),
      });

      router.push('/dashboard/claimed-bounties');
    } catch (err: any) {
      console.error('Error claiming bounty:', err);
      setError(err?.message || 'Failed to claim bounty');
      setTxStatus(null);
      setAutomatedPaymentStatus('failed');
    } finally {
      setLoading(false);
      setValidationStatus(null);
    }
  };

  if (!publicKey) {
    return (
      <div className="text-center">
        <p className="mb-4 text-gray-600">Connect your wallet to claim this bounty</p>
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

      {validationStatus && (
        <div className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-3 rounded-md">
          {validationStatus}
        </div>
      )}

      {txStatus && (
        <div className="bg-blue-50 border border-blue-200 text-blue-600 px-4 py-3 rounded-md">
          {txStatus === 'pending' && 'Waiting for transaction approval...'}
          {txStatus === 'confirming' && 'Confirming transaction...'}
          {txStatus === 'confirmed' && 'Transaction confirmed! Updating bounty status...'}
        </div>
      )}

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio h-4 w-4 text-indigo-600"
              name="paymentMethod"
              checked={automatedPayment}
              onChange={() => setAutomatedPayment(true)}
            />
            <span className="ml-2 text-sm text-gray-700">Automatic (when PR is merged)</span>
          </label>
          <label className="inline-flex items-center">
            <input
              type="radio"
              className="form-radio h-4 w-4 text-indigo-600"
              name="paymentMethod"
              checked={!automatedPayment}
              onChange={() => setAutomatedPayment(false)}
            />
            <span className="ml-2 text-sm text-gray-700">Manual</span>
          </label>
        </div>
      </div>

      {automatedPaymentStatus && (
        <PaymentStatus
          status={automatedPaymentStatus}
          errorMessage={paymentError || undefined}
        />
      )}

      <div>
        <label htmlFor="prUrl" className="block text-sm font-medium text-gray-700">
          Pull Request URL*
        </label>
        <input
          type="url"
          id="prUrl"
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/1"
          className="mt-1 block w-full rounded-md border border-gray-300 py-2 px-3 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          required
        />
        <p className="mt-1 text-sm text-gray-500">
          The pull request must be merged and reference the bounty issue
        </p>
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
          {loading ? 'Processing...' : 'Claim Bounty'}
        </button>
      </div>
    </form>
  );
} 