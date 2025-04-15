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
  createdAt?: string;
  updatedAt?: string;
  processingStartedAt?: string;
  completedAt?: string;
  failedAt?: string;
  transactionSignature?: string;
  attempt?: number;
  lastError?: string;
  lastErrorAt?: string;
  nextRetryAt?: string;
  notificationSent?: boolean;
  notificationSentAt?: string;
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