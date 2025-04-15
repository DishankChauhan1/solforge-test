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
    // Option 1: Check against GitHub PR URL (requires setup elsewhere to associate PRs with users)
    // This is the proper way, but requires more work to implement
    const isAssociatedWithPR = await verifyUserOwnsGitHubPR(userId, prUrl);
    if (!isAssociatedWithPR) {
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

// Helper function to verify the user owns the GitHub PR
// This is a placeholder function - in production, this would validate with GitHub API
async function verifyUserOwnsGitHubPR(userId: string, prUrl: string): Promise<boolean> {
  if (!db) {
    return false;
  }
  
  try {
    // Get the user's GitHub information from their profile
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      console.error('User not found');
      return false;
    }
    
    const userData = userDoc.data();
    const githubUsername = userData.githubUsername;
    
    if (!githubUsername) {
      console.error('User has no associated GitHub username');
      return false;
    }
    
    // Extract the PR owner username from the PR URL
    // Example PR URL: https://github.com/username/repo/pull/123
    const prUrlParts = prUrl.split('/');
    const prOwnerIndex = prUrlParts.indexOf('github.com') + 1;
    
    if (prOwnerIndex < 1 || prOwnerIndex >= prUrlParts.length) {
      console.error('Invalid PR URL format');
      return false;
    }
    
    // In a real implementation, you would make a GitHub API call to verify
    // For now, we'll just check if the PR is associated with the bounty
    const bountyCollection = collection(db, 'bounties');
    const bountyQuery = query(
      bountyCollection,
      where('claimPR', '==', prUrl)
    );
    
    const bountySnapshot = await getDocs(bountyQuery);
    if (bountySnapshot.empty) {
      console.error('No bounty found with this PR URL');
      return false;
    }
    
    // For now, we'll allow the claim as long as the PR is associated with a bounty
    // In production, you should validate against GitHub API
    return true;
  } catch (error) {
    console.error('Error verifying PR ownership:', error);
    return false;
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