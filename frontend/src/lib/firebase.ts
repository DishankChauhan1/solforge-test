'use client';

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, Auth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFunctions, Functions, httpsCallable, HttpsCallable } from 'firebase/functions';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  getDocs,
  getDoc,
  doc,
  query,
  where,
  updateDoc,
  addDoc,
  DocumentData,
  QuerySnapshot,
  CollectionReference,
  orderBy,
  serverTimestamp,
  Timestamp,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import { IBounty, BountyStatus } from '@/types/bounty';
import { ISubmission, SubmissionStatus } from '@/types/submission';
import { UserRole } from '@/types/user';
import { Octokit } from 'octokit';

// GitHub API configuration
const GITHUB_API_URL = 'https://api.github.com';
const GITHUB_TOKEN = process.env.NEXT_PUBLIC_GITHUB_TOKEN || '';

// Create authenticated Octokit instance for GitHub API
const octokit = new Octokit({
  auth: GITHUB_TOKEN
});

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Auth instance
export const auth = getAuth(app);

// Set persistence to LOCAL (this keeps the user logged in even after browser refresh)
if (typeof window !== "undefined") {
  setPersistence(auth, browserLocalPersistence)
    .catch((error) => {
      console.error("Error setting auth persistence:", error);
    });
}

let db: Firestore | undefined;
let functions: Functions | undefined;

function initializeFirebase() {
  if (typeof window === "undefined") return; // Skip initialization on server

  if (!db) {
    db = getFirestore(app);
    
    // Enable offline persistence for Firestore
    enableIndexedDbPersistence(db)
      .catch((err) => {
        if (err.code === 'failed-precondition') {
          console.warn('Firestore persistence could not be enabled (multiple tabs open)');
        } else if (err.code === 'unimplemented') {
          console.warn('Firestore persistence is not available in this browser');
        }
      });
      
    functions = getFunctions(app);
  }
  
  return {
    app,
    db,
    functions
  };
}

// Initialize Firebase on module load
if (typeof window !== "undefined") {
  initializeFirebase();
}

// Helper function to get firestore instance
export function getFirebaseFirestore() {
  initializeFirebase();
  if (!db) {
    db = getFirestore(app); // Try to initialize again if not available
  }
  return db;
}

// Helper function to get functions instance
export function getFirebaseFunctions() {
  initializeFirebase();
  if (!functions) {
    functions = getFunctions(app, 'us-central1'); // Set region explicitly
  }
  return functions;
}

// Helper function to create a new bounty
export async function createBounty(bountyData: {
  title: string;
  description: string;
  amount: number;
  currency: string;
  issueUrl: string;
  repositoryUrl: string;
  creatorId: string;
  createdBy: string;
}): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const bountyCollection = collection(db, 'bounties');
  const newBounty = {
    ...bountyData,
    status: 'open',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const docRef = await addDoc(bountyCollection, newBounty);
  return docRef.id;
}

// Helper function to get bounties from Firestore
export async function getBounties({ status }: { status?: string } = {}): Promise<IBounty[]> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const bountyCollection = collection(db, 'bounties') as CollectionReference<IBounty>;
    let bountyQuery = status 
      ? query(bountyCollection, where('status', '==', status))
      : bountyCollection;
    
    const snapshot = await getDocs(bountyQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  } catch (error) {
    console.error('Error fetching bounties:', error);
    throw error;
  }
}

// Helper function to get a single bounty by ID
export async function getBountyById(bountyId: string): Promise<IBounty | null> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const bountyDoc = await getDoc(doc(db, 'bounties', bountyId));
    if (!bountyDoc.exists()) {
      return null;
    }
    return {
      ...bountyDoc.data() as IBounty,
      id: bountyDoc.id
    };
  } catch (error) {
    console.error('Error fetching bounty:', error);
    return null;
  }
}

// Helper function to submit work for a bounty
export async function submitBountyWork({
  bountyId,
  prLink,
  userId
}: {
  bountyId: string;
  prLink: string;
  userId: string;
}): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  const bountyRef = doc(db, 'bounties', bountyId);
  const bountyDoc = await getDoc(bountyRef);

  if (!bountyDoc.exists()) {
    throw new Error('Bounty not found');
  }

  const bountyData = bountyDoc.data() as IBounty;
  if (bountyData.status !== 'open') {
    throw new Error('Bounty is not open for submissions');
  }

  await updateDoc(bountyRef, {
    status: 'submitted',
    submittedBy: userId,
    prLink,
    submittedAt: new Date().toISOString(),
  });
}

// Helper function to get submissions for a user or bounty
export async function getSubmissions({ 
  userId, 
  bountyId 
}: { 
  userId?: string; 
  bountyId?: string;
}): Promise<ISubmission[]> {
  if (!db || !auth?.currentUser) {
    throw new Error('Not authenticated or Firestore is not initialized');
  }

  try {
    const submissionCollection = collection(db, 'submissions');
    let submissionQuery = query(submissionCollection);

    if (userId) {
      // Get submissions where user is the submitter
      submissionQuery = query(
        submissionCollection, 
        where('submitterId', '==', userId)
      );
      // Note: We've removed the orderBy to avoid needing a composite index
    } else if (bountyId) {
      // Get submissions for a specific bounty
      submissionQuery = query(
        submissionCollection, 
        where('bountyId', '==', bountyId)
      );
      // Note: We've removed the orderBy to avoid needing a composite index
    }
    
    const snapshot = await getDocs(submissionQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as ISubmission[];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    throw error;
  }
}

// Helper function to create a new submission
export async function createSubmission({
  bountyId,
  submitterId,
  prUrl,
  files
}: {
  bountyId: string;
  submitterId: string;
  prUrl: string;
  files: string[];
}): Promise<string> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const submissionCollection = collection(db, 'submissions');
    const now = serverTimestamp();
    
    const submissionData = {
      bountyId,
      submitterId,
      prUrl,
      files,
      status: 'pending' as SubmissionStatus,
      createdAt: now,
      updatedAt: now,
      reviewerId: null,
      reviewerComments: null
    };

    const docRef = await addDoc(submissionCollection, submissionData);
    return docRef.id;
  } catch (error) {
    console.error('Error creating submission:', error);
    throw error;
  }
}

// Helper function to update submission status
export async function updateSubmissionStatus({
  submissionId,
  status,
  reviewerId,
  reviewerComments
}: {
  submissionId: string;
  status: SubmissionStatus;
  reviewerId: string;
  reviewerComments?: string;
}): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const submissionRef = doc(db, 'submissions', submissionId);
    await updateDoc(submissionRef, {
      status,
      reviewerId,
      reviewerComments: reviewerComments || null,
      reviewedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    throw error;
  }
}

// Helper function to update user profile
export async function updateUserProfile(
  userId: string,
  profileData: {
    bio?: string;
    website?: string;
    twitter?: string;
    discord?: string;
    githubUsername?: string;
    role?: UserRole;
  }
): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...profileData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

// Helper function to update bounty status
export async function updateBountyStatus(bountyId: string, status: BountyStatus): Promise<void> {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const bountyRef = doc(db, 'bounties', bountyId);
    await updateDoc(bountyRef, {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating bounty status:', error);
    throw error;
  }
}

// Helper function to manually claim a completed bounty
export async function claimCompletedBounty({
  bountyId,
  prUrl,
  userId
}: {
  bountyId: string;
  prUrl: string;
  userId: string;
}): Promise<boolean> {
  if (!db || !auth?.currentUser) {
    throw new Error('Not authenticated or Firestore is not initialized');
  }

  try {
    console.log(`Attempting to claim bounty: ${bountyId} for user: ${userId} with PR: ${prUrl}`);
    
    // 1. Get the bounty
    const bountyRef = doc(db, 'bounties', bountyId);
    const bountyDoc = await getDoc(bountyRef);
    
    if (!bountyDoc.exists()) {
      console.error('Bounty not found');
      return false;
    }
    
    const bountyData = bountyDoc.data();
    console.log('Current bounty data:', bountyData);
    
    // Check if bounty is already claimed
    if (bountyData.claimedBy) {
      console.error('Bounty has already been claimed');
      return false;
    }
    
    // Verify this user is authorized to claim the bounty
    const isAuthorized = await isPRSubmitter(userId, prUrl);
    if (!isAuthorized) {
      console.error('User is not authorized to claim this bounty - not the PR owner');
      return false;
    }
    
    // 2. Create a submission record if one doesn't exist
    const submissionCollection = collection(db, 'submissions');
    const submissionQuery = query(
      submissionCollection,
      where('bountyId', '==', bountyId),
      where('submitterId', '==', userId)
    );
    
    const existingSubmissions = await getDocs(submissionQuery);
    
    // If no submission exists, create one
    if (existingSubmissions.empty) {
      console.log('Creating new submission record');
      const now = serverTimestamp();
      const submissionData = {
        bountyId,
        submitterId: userId,
        prUrl,
        status: 'approved' as SubmissionStatus,
        createdAt: now,
        updatedAt: now,
        files: []
      };
      
      await addDoc(submissionCollection, submissionData);
      console.log('Submission created successfully');
    } else {
      console.log('Submission already exists');
    }
    
    // 3. Update the bounty record if needed
    if (bountyData.status !== 'completed') {
      await updateDoc(bountyRef, {
        status: 'completed',
        claimedBy: userId,
        claimedAt: serverTimestamp(),
        claimPR: prUrl,
        updatedAt: serverTimestamp()
      });
      console.log('Bounty status updated to completed');
    }
    
    return true;
  } catch (error) {
    console.error('Error claiming completed bounty:', error);
    return false;
  }
}

// Production implementation for PR owner verification
// This method uses multiple strategies to verify PR ownership
async function isPRSubmitter(userId: string, prUrl: string): Promise<boolean> {
  if (!db) {
    return false;
  }
  
  try {
    // Get the user's info
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('User not found');
      return false;
    }
    
    // Extract PR information from URL
    const prInfo = extractPRInfo(prUrl);
    if (!prInfo) {
      console.error('Invalid PR URL format');
      return false;
    }
    
    const { owner, repo, number } = prInfo;
    console.log(`Extracted PR info - Owner: ${owner}, Repo: ${repo}, Number: ${number}`);
    
    // Strategy 1: Direct GitHub username comparison
    const userData = userDoc.data();
    const userGithubUsername = userData.githubUsername;
    
    if (userGithubUsername) {
      // Use GitHub API to get PR details
      try {
        const prOwner = await getPROwner(owner, repo, number);
        
        if (prOwner && prOwner.toLowerCase() === userGithubUsername.toLowerCase()) {
          console.log(`PR owner verified via direct GitHub username comparison`);
          return true;
        }
        
        console.log(`GitHub username mismatch: PR owner=${prOwner}, User=${userGithubUsername}`);
      } catch (error) {
        console.error('Error fetching PR from GitHub API:', error);
      }
    }
    
    // Strategy 2: Check metadata from bounty
    console.log('Trying strategy 2: Check bounty metadata for GitHub username');
    const bountyVerification = await verifyThroughBountyMetadata(userId, prUrl);
    if (bountyVerification) {
      return true;
    }
    
    // Strategy 3: Check if the user's email matches the PR submitter's email
    // This requires a GitHub token with appropriate permissions
    if (GITHUB_TOKEN && auth?.currentUser?.email) {
      console.log('Trying strategy 3: Check email association with GitHub');
      try {
        const prOwnerEmail = await getPROwnerEmail(owner, repo, number);
        if (prOwnerEmail && prOwnerEmail === auth.currentUser.email) {
          console.log('PR owner verified via email comparison');
          
          // If verified via email, update the user's GitHub username for future verifications
          const prOwner = await getPROwner(owner, repo, number);
          if (prOwner) {
            await updateDoc(doc(db, 'users', userId), {
              githubUsername: prOwner
            });
            console.log(`Updated user profile with GitHub username: ${prOwner}`);
          }
          
          return true;
        }
      } catch (error) {
        console.error('Error verifying PR through email:', error);
      }
    }
    
    // Fall back to firebase verification during development/testing
    if (process.env.NODE_ENV !== 'production') {
      console.log('DEVELOPMENT MODE: Checking if PR is associated with any bounty');
      const bountyCollection = collection(db, 'bounties');
      const bountyQuery = query(
        bountyCollection,
        where('claimPR', '==', prUrl)
      );
      
      const bountySnapshot = await getDocs(bountyQuery);
      const isPRAssociatedWithBounty = !bountySnapshot.empty;
      
      if (isPRAssociatedWithBounty) {
        console.log('WARNING: Development fallback - allowing claim as PR is associated with a bounty');
        return true;
      }
    }
    
    console.log('All verification strategies failed');
    return false;
  } catch (error) {
    console.error('Error in PR submitter verification:', error);
    return false;
  }
}

async function verifyThroughBountyMetadata(userId: string, prUrl: string): Promise<boolean> {
  if (!db || !auth?.currentUser?.email) return false;
  
  try {
    // Find bounties with this PR URL
    const bountyCollection = collection(db, 'bounties');
    const bountyQuery = query(
      bountyCollection,
      where('claimPR', '==', prUrl)
    );
    
    const bountySnapshot = await getDocs(bountyQuery);
    if (bountySnapshot.empty) return false;
    
    // Check each bounty for metadata
    for (const docSnapshot of bountySnapshot.docs) {
      const bountyData = docSnapshot.data();
      
      // Look for GitHub username in metadata
      if (bountyData.statusMetadata?.githubUsername) {
        const prGithubUsername = bountyData.statusMetadata.githubUsername;
        console.log(`Found GitHub username in bounty metadata: ${prGithubUsername}`);
        
        // Get user's email for comparison
        const userEmail = auth.currentUser.email;
        
        // Try to compare GitHub username with email for verification
        const emailUsername = userEmail.split('@')[0].toLowerCase();
        const githubUsername = prGithubUsername.toLowerCase();
        
        const emailMatch = 
          emailUsername === githubUsername || 
          emailUsername.includes(githubUsername) || 
          githubUsername.includes(emailUsername);
          
        if (emailMatch) {
          console.log('Email username matches GitHub username pattern');
          
          // Update user profile with verified GitHub username
          await updateDoc(doc(db, 'users', userId), {
            githubUsername: prGithubUsername
          });
          
          return true;
        }
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error verifying through bounty metadata:', error);
    return false;
  }
}

// Helper function to extract PR owner, repo and number from URL
function extractPRInfo(prUrl: string): { owner: string; repo: string; number: number } | null {
  try {
    // Match PR URL format: https://github.com/owner/repo/pull/123
    const regex = /https?:\/\/github\.com\/([^\/]+)\/([^\/]+)\/pull\/(\d+)/;
    const match = prUrl.match(regex);
    
    if (!match || match.length < 4) {
      return null;
    }
    
    return {
      owner: match[1],
      repo: match[2],
      number: parseInt(match[3], 10)
    };
  } catch (error) {
    console.error('Error extracting PR info:', error);
    return null;
  }
}

// Helper function to get PR owner using GitHub API
async function getPROwner(repoOwner: string, repoName: string, pullNumber: number): Promise<string | null> {
  try {
    // Use authenticated Octokit client if token available
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullNumber
    });
    
    return pullRequest.user?.login || null;
  } catch (error) {
    console.error('GitHub API error when fetching PR:', error);
    
    // Attempt unauthenticated fetch as fallback
    try {
      const response = await fetch(
        `${GITHUB_API_URL}/repos/${repoOwner}/${repoName}/pulls/${pullNumber}`
      );
      
      if (response.ok) {
        const data = await response.json();
        return data.user?.login || null;
      }
    } catch (fallbackError) {
      console.error('Fallback fetch also failed:', fallbackError);
    }
    
    return null;
  }
}

// Helper function to get PR owner's email (requires token with appropriate permissions)
async function getPROwnerEmail(repoOwner: string, repoName: string, pullNumber: number): Promise<string | null> {
  if (!GITHUB_TOKEN) return null;
  
  try {
    // First get the PR to find the commit SHA
    const { data: pullRequest } = await octokit.rest.pulls.get({
      owner: repoOwner,
      repo: repoName,
      pull_number: pullNumber
    });
    
    if (!pullRequest.head?.sha) return null;
    
    // Get the commit to find the author email
    const { data: commit } = await octokit.rest.git.getCommit({
      owner: repoOwner,
      repo: repoName,
      commit_sha: pullRequest.head.sha
    });
    
    return commit.author?.email || null;
  } catch (error) {
    console.error('Error getting PR owner email:', error);
    return null;
  }
}

// Export the initialized services
export { app, db, functions };

// Export types
export type { Functions };

// Export Firebase Functions
export const createBountyFunction = (): HttpsCallable<any, any> => {
  const functions = getFirebaseFunctions();
  return httpsCallable(functions, 'createBountyHandlerV2');
};

interface ClaimBountyData {
  bountyId: string;
  prUrl: string;
  claimerId: string;
  claimerWallet: string;
  txHash: string;
}

export const claimBountyFunction = () => {
  const functions = getFirebaseFunctions();
  return httpsCallable<ClaimBountyData, { success: boolean }>(
    functions,
    'claimBounty'
  );
};

export const verifyPRFunction = (): HttpsCallable<any, any> => {
  const functions = getFirebaseFunctions();
  return httpsCallable(functions, 'verifyPR');
};

export const getAllBountiesFunction = (): HttpsCallable<any, any> => {
  const functions = getFirebaseFunctions();
  return httpsCallable(functions, 'getAllBounties');
};

export const getBountyByIdFunction = (): HttpsCallable<any, any> => {
  const functions = getFirebaseFunctions();
  return httpsCallable(functions, 'getBountyById');
}; 