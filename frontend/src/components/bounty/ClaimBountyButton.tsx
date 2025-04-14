'use client';

import { useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { IBounty } from '@/types/bounty';
import { useAuth } from '@/context/AuthProvider';
import { claimBountyFunction } from '@/lib/firebase';
import {
  claimBountyInstruction,
  simulateClaimTransaction,
  sendAndConfirmClaimTransaction,
  TransactionError
} from '@/lib/solana/instructions';

interface ClaimBountyButtonProps {
  bounty: IBounty;
  prUrl: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function ClaimBountyButton({
  bounty,
  prUrl,
  onSuccess,
  onError
}: ClaimBountyButtonProps) {
  const { connection } = useConnection();
  const { publicKey, connected } = useWallet();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClaim = async () => {
    if (!publicKey || !connected || !user) {
      setError('Please connect your wallet first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create claim instruction
      const instruction = await claimBountyInstruction({
        issueHash: bounty.issueHash,
        amount: bounty.amount,
        currency: bounty.currency,
        creator: bounty.creatorWallet,
        claimer: publicKey
      });

      // Create and prepare transaction
      const transaction = new Transaction().add(instruction);

      // Simulate transaction first
      await simulateClaimTransaction(connection, transaction, publicKey);

      // Send and confirm transaction
      const signature = await sendAndConfirmClaimTransaction(
        connection,
        transaction,
        publicKey
      );

      // Update bounty status in Firebase
      const claimBounty = claimBountyFunction();
      await claimBounty({
        bountyId: bounty.id,
        prUrl,
        claimerId: user.uid,
        claimerWallet: publicKey.toBase58(),
        txHash: signature
      });

      onSuccess?.();
    } catch (err) {
      console.error('Error claiming bounty:', err);
      
      if (err instanceof TransactionError) {
        switch (err.code) {
          case 'INSUFFICIENT_FUNDS':
            setError('Insufficient funds to complete the transaction');
            break;
          case 'ALREADY_CLAIMED':
            setError('This bounty has already been claimed');
            break;
          case 'USER_REJECTED':
            setError('Transaction was rejected');
            break;
          case 'INVALID_STATE':
            setError('Bounty is in an invalid state');
            break;
          default:
            setError(err.message);
        }
      } else {
        setError('Failed to claim bounty. Please try again.');
      }
      
      onError?.(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}
      
      <button
        onClick={handleClaim}
        disabled={loading || !connected}
        className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
          loading
            ? 'bg-indigo-400 cursor-not-allowed'
            : 'bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
        }`}
      >
        {loading ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
            Processing...
          </div>
        ) : (
          'Claim Bounty'
        )}
      </button>
    </div>
  );
} 