import { Timestamp } from 'firebase/firestore';
import { IBounty } from './bounty';
import { IUser } from './user';

export type SubmissionStatus = 'pending' | 'approved' | 'rejected';

export interface ISubmission {
  id: string;
  bountyId: string;
  bounty?: IBounty;
  submitterId: string;
  submitter?: IUser;
  prUrl: string;
  status: SubmissionStatus;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  reviewedAt?: Timestamp;
  reviewerId?: string;
  reviewer?: IUser;
  comments?: string;
  zkProof?: string;
  commitHash?: string;
  branchName?: string;
  files?: {
    filename: string;
    additions: number;
    deletions: number;
    changes: number;
  }[];
}

export interface IBountySubmission {
  id: string;
  bountyId: string;
  submitterId: string;
  prUrl: string;
  status: SubmissionStatus;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  reviewerId?: string;
  reviewerComments?: string;
} 