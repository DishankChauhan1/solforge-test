'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFunctions, Functions, httpsCallable } from 'firebase/functions';
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
  Timestamp
} from 'firebase/firestore';
import { IBounty } from '@/types/bounty';
import { ISubmission, SubmissionStatus } from '@/types/submission';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase only on client side and if not already initialized
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;
let functions: Functions | undefined;

function initializeFirebase() {
  if (typeof window === "undefined") return; // Skip initialization on server

  if (!app) {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    
    auth = getAuth(app);
    db = getFirestore(app);
    functions = getFunctions(app);
  }
  
  return {
    app,
    auth,
    db,
    functions
  };
}

// Initialize Firebase on module load
if (typeof window !== "undefined") {
  initializeFirebase();
}

// Helper function to check if Firebase is initialized
export function getFirebaseApp() {
  initializeFirebase();
  if (!app) {
    throw new Error('Firebase is not initialized');
  }
  return app;
}

// Helper function to get auth instance
export function getFirebaseAuth() {
  initializeFirebase();
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  return auth;
}

// Helper function to get firestore instance
export function getFirebaseFirestore() {
  initializeFirebase();
  if (!db) {
    throw new Error('Firestore is not initialized');
  }
  return db;
}

// Helper function to get functions instance
export function getFirebaseFunctions() {
  initializeFirebase();
  if (!functions) {
    throw new Error('Firebase Functions is not initialized');
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
    console.log('Using mock bounty data as Firestore is not initialized');
    return getMockBounties(status);
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
    return getMockBounties(status);
  }
}

// Helper function to get a single bounty by ID
export async function getBountyById(bountyId: string): Promise<IBounty | null> {
  if (!db) {
    console.log('Using mock bounty data as Firestore is not initialized');
    return getMockBounties()[0];
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

// Helper function to generate mock bounty data for development
function getMockBounties(status?: string): IBounty[] {
  const now = Timestamp.fromDate(new Date());
  const mockBounties: IBounty[] = [
    {
      id: '1',
      title: 'Fix navigation bug in header',
      description: 'The dropdown menu in the header doesn\'t close when clicking outside',
      amount: 0.5,
      currency: 'SOL',
      status: 'open',
      repositoryUrl: 'https://github.com/user/repo',
      issueUrl: 'https://github.com/user/repo/issues/1',
      createdAt: now,
      creatorId: 'user1',
      updatedAt: now,
      createdBy: undefined
    },
    {
      id: '2',
      title: 'Implement dark mode',
      description: 'Add dark mode support to the application',
      amount: 1.2,
      currency: 'SOL',
      status: 'in_progress',
      repositoryUrl: 'https://github.com/user/repo',
      issueUrl: 'https://github.com/user/repo/issues/2',
      createdAt: now,
      creatorId: 'user2',
      updatedAt: now,
      createdBy: undefined
    },
  ];
  
  if (status) {
    return mockBounties.filter(bounty => bounty.status === status);
  }
  
  return mockBounties;
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
    throw new Error('Not authenticated');
  }

  try {
    const submissionCollection = collection(db, 'submissions');
    let submissionQuery = query(submissionCollection);

    if (userId) {
      // Get submissions where user is either submitter or reviewer
      submissionQuery = query(
        submissionCollection, 
        where('submitterId', '==', userId)
      );
    } else if (bountyId) {
      // Get submissions for a specific bounty if user is creator or submitter
      submissionQuery = query(
        submissionCollection, 
        where('bountyId', '==', bountyId)
      );
    }

    // Add orderBy to sort by most recent first
    submissionQuery = query(submissionQuery, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(submissionQuery);
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    })) as ISubmission[];
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return [];
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
    const submissionDoc = await getDoc(submissionRef);

    if (!submissionDoc.exists()) {
      throw new Error('Submission not found');
    }

    await updateDoc(submissionRef, {
      status,
      reviewerId,
      reviewerComments: reviewerComments || null,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating submission status:', error);
    throw error;
  }
}

// Export the initialized services
export { app, auth, db, functions };

// Export types
export type { Functions };

// Export Firebase Functions
export const createBountyFunction = httpsCallable(functions!, 'createBounty');
export const claimBountyFunction = httpsCallable(functions!, 'claimBounty');
export const verifyPRFunction = httpsCallable(functions!, 'verifyPR');
export const getAllBountiesFunction = httpsCallable(functions!, 'getAllBounties');
export const getBountyByIdFunction = httpsCallable(functions!, 'getBountyById'); 