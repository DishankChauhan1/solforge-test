import { Timestamp, FieldValue } from 'firebase/firestore';

export interface IGithubProfile {
  login: string;
  name: string;
  avatar_url: string;
}

export type UserRole = 'creator' | 'contributor';

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
  isMaintainer?: boolean;
} 