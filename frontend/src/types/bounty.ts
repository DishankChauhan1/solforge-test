import { Timestamp } from 'firebase/firestore';
import { IUser } from './user';
import { ReactNode } from 'react';

export type BountyStatus = 'open' | 'in_progress' | 'completed' | 'claimed';
export type BountyCurrency = 'SOL' | 'USDC';

export interface IBounty {
  id: string;
  title: string;
  issueUrl: string;
  issueHash: string;
  repositoryUrl: string;
  description: string;
  amount: number;
  currency: BountyCurrency;
  status: BountyStatus;
  creatorId: string;
  creatorWallet: string;
  locked: boolean;
  txHash?: string;
  deadline: string | Timestamp;
  createdAt: string | Timestamp;
  updatedAt: string | Timestamp;
  claimedBy?: string;
  claimedAt?: string | Timestamp;
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