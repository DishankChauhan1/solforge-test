import * as admin from 'firebase-admin';
import { User, UserDocument } from '../types/schema';
import { Query, CollectionReference } from 'firebase-admin/firestore';
import { BountyStatus } from '../types/bounty';

// Get Firestore instance
const getDb = () => {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
  return admin.firestore();
};

// User Operations
export const createUser = async (
  userId: string,
  userData: Omit<User, 'createdAt' | 'updatedAt'>
): Promise<UserDocument> => {
  const db = getDb();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  const user = {
    ...userData,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await db.collection('users').doc(userId).set(user);
  const userDoc = await db.collection('users').doc(userId).get();
  return { id: userDoc.id, ...userDoc.data() } as UserDocument;
};

export const updateUser = async (
  userId: string,
  userData: Partial<User>
): Promise<UserDocument> => {
  const db = getDb();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('users').doc(userId).update({
    ...userData,
    updatedAt: timestamp,
  });

  const userDoc = await db.collection('users').doc(userId).get();
  return { id: userDoc.id, ...userDoc.data() } as UserDocument;
};

export const getUser = async (userId: string): Promise<UserDocument | null> => {
  const db = getDb();
  const userDoc = await db.collection('users').doc(userId).get();
  return userDoc.exists ? { id: userDoc.id, ...userDoc.data() } as UserDocument : null;
};

// Bounty Operations
export interface Bounty {
  id: string;
  title: string;
  description: string;
  amount: number;
  tokenMint?: string;
  issueUrl: string;
  repositoryUrl: string;
  createdBy: string;
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  status: 'open' | 'claimed' | 'completed';
  claimedBy?: string;
  claimedAt?: admin.firestore.Timestamp;
  claimPR?: string;
}

export type BountyDocument = Omit<Bounty, 'id'>;

export const getBounty = async (bountyId: string): Promise<Bounty | null> => {
  const db = getDb();
  const bountyDoc = await db.collection('bounties').doc(bountyId).get();
  if (!bountyDoc.exists) {
    return null;
  }
  const data = bountyDoc.data() as BountyDocument;
  return { id: bountyDoc.id, ...data };
};

export const createBounty = async (data: {
  title: string;
  description: string;
  amount: number;
  tokenMint?: string;
  issueUrl: string;
  repositoryUrl: string;
  createdBy: string;
  status: 'open';
}): Promise<Bounty> => {
  const db = getDb();
  const now = admin.firestore.Timestamp.now();
  const bountyData: BountyDocument = {
    ...data,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await db.collection('bounties').add(bountyData);
  const doc = await docRef.get();
  const savedData = doc.data() as BountyDocument;
  return { id: doc.id, ...savedData };
};

export const listBounties = async (status?: 'open' | 'claimed' | 'approved'): Promise<BountyDocument[]> => {
  const db = getDb();
  let query: Query | CollectionReference = db.collection('bounties');
  
  if (status) {
    query = query.where('status', '==', status);
  }
  
  query = query.orderBy('createdAt', 'desc');
  const bounties = await query.get();
  return bounties.docs.map(doc => ({ id: doc.id, ...doc.data() }) as unknown as BountyDocument);
};

export const claimBounty = async (
  bountyId: string,
  userId: string,
  pullRequestUrl: string
): Promise<Bounty> => {
  const db = getDb();
  const bountyRef = db.collection('bounties').doc(bountyId);
  const now = admin.firestore.Timestamp.now();

  const updateData = {
    status: 'claimed' as const,
    claimedBy: userId,
    claimedAt: now,
    claimPR: pullRequestUrl,
    updatedAt: now,
  };

  await bountyRef.update(updateData);

  const updatedDoc = await bountyRef.get();
  const updatedData = updatedDoc.data() as BountyDocument;
  return { id: updatedDoc.id, ...updatedData };
};

export const approveBounty = async (bountyId: string): Promise<BountyDocument> => {
  const db = getDb();
  const timestamp = admin.firestore.FieldValue.serverTimestamp();
  await db.collection('bounties').doc(bountyId).update({
    status: 'approved',
    updatedAt: timestamp,
  });

  const bountyDoc = await db.collection('bounties').doc(bountyId).get();
  return { id: bountyDoc.id, ...bountyDoc.data() } as unknown as BountyDocument;
};

export const getBountyByPR = async (prUrl: string): Promise<Bounty | null> => {
  const db = getDb();
  const bountySnapshot = await db.collection('bounties')
    .where('claimPR', '==', prUrl)
    .limit(1)
    .get();
  
  if (bountySnapshot.empty) {
    return null;
  }
  
  const doc = bountySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Bounty;
};

export async function updateBountyStatus(
  bountyId: string,
  status: BountyStatus,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    const bountyRef = getDb().collection('bounties').doc(bountyId);
    
    await bountyRef.update({
      status,
      updatedAt: admin.firestore.Timestamp.now(),
      ...(metadata && { statusMetadata: metadata })
    });
  } catch (error) {
    console.error('Error updating bounty status:', error);
    throw error;
  }
}

// Get a bounty by its issue URL
export const getBountyByIssueUrl = async (issueUrl: string): Promise<Bounty | null> => {
  const db = getDb();
  const bountySnapshot = await db.collection('bounties')
    .where('issueUrl', '==', issueUrl)
    .limit(1)
    .get();
  
  if (bountySnapshot.empty) {
    return null;
  }
  
  const doc = bountySnapshot.docs[0];
  return { id: doc.id, ...doc.data() } as Bounty;
};

// Get bounties by repository URL
export const getBountyByRepo = async (repositoryUrl: string): Promise<Bounty[]> => {
  const db = getDb();
  const bountySnapshot = await db.collection('bounties')
    .where('repositoryUrl', '==', repositoryUrl)
    .get();
  
  if (bountySnapshot.empty) {
    return [];
  }
  
  return bountySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  })) as Bounty[];
};

// Update a bounty with PR information
export const updateBountyWithPR = async (bountyId: string, prUrl: string): Promise<void> => {
  const db = getDb();
  const bountyRef = db.collection('bounties').doc(bountyId);
  const now = admin.firestore.Timestamp.now();
  
  await bountyRef.update({
    claimPR: prUrl,
    updatedAt: now
  });
}; 