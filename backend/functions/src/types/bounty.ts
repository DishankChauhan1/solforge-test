import { Timestamp } from 'firebase-admin/firestore';

export type BountyStatus = 
  | 'open'
  | 'in_progress'
  | 'approved'
  | 'changes_requested'
  | 'completed'
  | 'cancelled'
  | 'claimed';

export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface PaymentInfo {
  status: PaymentStatus;
  amount: number;
  tokenMint?: string;
  recipientId: string;
  transactionSignature?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  failedAt?: string;
  processingStartedAt?: string;
  lastError?: string;
  attempt?: number;
}

export interface Bounty {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: 'SOL' | 'USDC';
  tokenMint?: string;
  issueUrl: string;
  repositoryUrl: string;
  prUrl?: string;
  status: BountyStatus;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  claimedBy?: string;
  claimedAt?: Timestamp;
  claimPR?: string;
  statusMetadata?: Record<string, any>;
  // GitHub username of the PR submitter
  prSubmitterGithubUsername?: string;
  // Payment tracking information
  payment?: PaymentInfo;
} 