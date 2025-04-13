import { DocumentData, Timestamp } from 'firebase-admin/firestore';

export interface User {
  githubUsername: string;
  githubAvatar: string;
  walletAddress: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Bounty {
  issueLink: string;
  repoLink: string;
  solanaTxId: string;
  creatorId: string;
  amount: number;
  claimedBy?: string;
  claimPR?: string;
  status: 'open' | 'claimed' | 'approved';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserDocument extends DocumentData, User {
  id: string;
}

export interface BountyDocument extends DocumentData, Bounty {
  id: string;
} 