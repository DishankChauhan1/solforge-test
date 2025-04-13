import { Timestamp } from 'firebase/firestore';
import { IUser } from './user';
import { ReactNode } from 'react';

export type BountyStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type BountyCurrency = 'SOL' | 'USDC';

export interface IBounty {
  id: string;
  title: string;
  description: string;
  amount: number;
  currency: BountyCurrency;
  status: BountyStatus;
  creatorId: string;
  creator?: IUser;
  assigneeId?: string;
  assignee?: IUser;
  repositoryUrl: string;
  issueUrl: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt?: Timestamp;
  requirements?: string[];
  tags?: string[];
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