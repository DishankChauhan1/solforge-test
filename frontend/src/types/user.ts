import { Timestamp, FieldValue } from 'firebase/firestore';

export type UserRole = 'creator' | 'contributor';

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
  photoURL: string | null;
  role: UserRole;
  createdAt?: Timestamp | FieldValue;
  lastLogin?: Timestamp | FieldValue;
  githubUsername?: string;
  walletAddress?: string;
  githubProfile?: IGithubProfile;
  totalBountiesCreated?: number;
  totalBountiesClaimed?: number;
  reputation?: number;
  bio?: string;
  website?: string;
  twitter?: string;
  discord?: string;
} 