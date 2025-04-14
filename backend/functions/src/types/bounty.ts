import { Timestamp } from 'firebase-admin/firestore';

export type BountyStatus = 
  | 'open'
  | 'in_progress'
  | 'approved'
  | 'changes_requested'
  | 'completed'
  | 'cancelled'
  | 'claimed';

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
} 