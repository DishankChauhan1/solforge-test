import { Timestamp, FieldValue } from 'firebase/firestore';

export type UserRole = 'contributor' | 'creator' | 'admin';

export interface IGithubProfile {
  login: string;
  name: string;
  avatar_url: string;
  bio?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
  html_url: string;
}

export interface IUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
  role: UserRole;
  website?: string;
  bio?: string;
  twitter?: string;
  discord?: string;
  githubUsername?: string;
  totalBountiesCreated?: number;
  totalBountiesClaimed?: number;
  lastLogin?: Timestamp | FieldValue;
  walletAddress?: string;
  githubProfile?: IGithubProfile;
  reputation?: number;
} 