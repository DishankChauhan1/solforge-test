import { Timestamp } from 'firebase/firestore';
import { IUser } from './user';
import { ReactNode } from 'react';

export type BountyStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type BountyCurrency = 'SOL' | 'USDC';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface IPaymentInfo {
  status: PaymentStatus;
  attempt?: number;
  transactionSignature?: string;
  completedAt?: string;
  failedAt?: string;
  lastError?: string;
  processingStartedAt?: string;
  updatedAt?: string;
}

export interface IBounty {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: BountyCurrency;
  status: BountyStatus;
  issueUrl: string;
  issueHash: string;
  repositoryUrl: string;
  creatorId: string;
  creatorWallet: string;
  locked: boolean;
  txHash?: string;
  deadline: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  claimedBy?: string;
  claimedAt?: Timestamp;
  prUrl?: string;
  payment?: IPaymentInfo;
}

export interface IBountySubmission {
  id: string;
  bountyId: string;
  bounty?: IBounty;
  submitterId: string;
  submitter?: IUser;
  prUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewerId?: string;
  reviewer?: IUser;
  comments?: string;
  zkProof?: string;
} 