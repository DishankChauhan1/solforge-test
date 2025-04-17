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
  prUrl: string;
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
  
  // Create a clean data object without undefined values
  const bountyData: any = {
    title: data.title,
    description: data.description,
    amount: data.amount,
    issueUrl: data.issueUrl,
    repositoryUrl: data.repositoryUrl, 
    createdBy: data.createdBy,
    status: data.status,
    createdAt: now,
    updatedAt: now
  };
  
  // Only add tokenMint if defined
  if (data.tokenMint) {
    bountyData.tokenMint = data.tokenMint;
  }

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
export const updateBountyWithPR = async (bountyId: string, prUrl: string, githubUsername?: string): Promise<void> => {
  const db = getDb();
  const bountyRef = db.collection('bounties').doc(bountyId);
  const now = admin.firestore.Timestamp.now();
  
  const updateData: any = {
    claimPR: prUrl,
    updatedAt: now
  };
  
  if (githubUsername) {
    updateData.prSubmitterGithubUsername = githubUsername;
  }
  
  await bountyRef.update(updateData);
};

/**
 * Update payment information for a bounty
 * This tracks payment status, transactions, and error handling
 */
export const updateBountyPayment = async (
  bountyId: string,
  paymentData: Record<string, any>
): Promise<void> => {
  const db = getDb();
  const bountyRef = db.collection('bounties').doc(bountyId);
  const now = admin.firestore.Timestamp.now();
  
  // Create payment tracking structure if it doesn't exist
  const updateData = {
    updatedAt: now,
    payment: {
      ...paymentData,
      updatedAt: now
    }
  };
  
  await bountyRef.update(updateData);
  
  // Also update a separate payment history record for audit
  const paymentHistoryRef = db.collection('payment_history').doc();
  await paymentHistoryRef.set({
    bountyId,
    ...paymentData,
    createdAt: now,
    updatedAt: now
  });
  
  // Log the payment update
  console.log(`Updated payment information for bounty ${bountyId}:`, paymentData);
};

/**
 * Submit a claim for a bounty (supports multiple submissions per bounty)
 */
export const submitClaim = async (
  bountyId: string,
  userId: string,
  pullRequestUrl: string,
  description: string = ''
): Promise<{submission: any, bounty: Bounty}> => {
  const db = getDb();
  const bountyRef = db.collection('bounties').doc(bountyId);
  const now = admin.firestore.Timestamp.now();

  // Get bounty to verify it's open
  const bountyDoc = await bountyRef.get();
  if (!bountyDoc.exists) {
    throw new Error('Bounty not found');
  }
  
  const bountyData = bountyDoc.data() as BountyDocument;
  if (bountyData.status !== 'open') {
    throw new Error('Bounty is not open for submissions');
  }
  
  // Create the submission document
  const submissionData = {
    bountyId,
    userId,
    pullRequestUrl,
    description,
    status: 'submitted',
    createdAt: now,
    updatedAt: now
  };
  
  // Add submission to the submissions collection
  const submissionRef = await db.collection('submissions').add(submissionData);
  
  // Update the bounty to indicate it has submissions
  await bountyRef.update({
    hasSubmissions: true,
    updatedAt: now
  });
  
  // Get the created submission
  const submissionDoc = await submissionRef.get();
  
  return {
    submission: { id: submissionDoc.id, ...submissionDoc.data() },
    bounty: { id: bountyDoc.id, ...bountyData }
  };
};

/**
 * Get all submissions for a bounty
 */
export const getBountySubmissions = async (bountyId: string): Promise<any[]> => {
  const db = getDb();
  
  const submissionsSnapshot = await db.collection('submissions')
    .where('bountyId', '==', bountyId)
    .orderBy('createdAt', 'desc')
    .get();
  
  return submissionsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};

/**
 * Approve a submission and process payment
 */
export const approveSubmission = async (
  submissionId: string,
  bountyId: string,
  approverUserId: string
): Promise<{success: boolean, message: string}> => {
  const db = getDb();
  const now = admin.firestore.Timestamp.now();
  
  // Run in a transaction to ensure consistency
  return db.runTransaction(async (transaction) => {
    // Get the submission
    const submissionRef = db.collection('submissions').doc(submissionId);
    const submissionDoc = await transaction.get(submissionRef);
    
    if (!submissionDoc.exists) {
      throw new Error('Submission not found');
    }
    
    const submissionData = submissionDoc.data();
    if (!submissionData) {
      throw new Error('Submission data is empty');
    }
    
    // Get the bounty
    const bountyRef = db.collection('bounties').doc(bountyId);
    const bountyDoc = await transaction.get(bountyRef);
    
    if (!bountyDoc.exists) {
      throw new Error('Bounty not found');
    }
    
    const bountyData = bountyDoc.data();
    if (!bountyData) {
      throw new Error('Bounty data is empty');
    }
    
    // Check if bounty is already completed
    if (bountyData.status === 'completed') {
      throw new Error('Bounty is already completed');
    }
    
    // Update submission status
    transaction.update(submissionRef, {
      status: 'approved',
      approvedBy: approverUserId,
      approvedAt: now,
      updatedAt: now
    });
    
    // Update bounty status
    transaction.update(bountyRef, {
      status: 'completed',
      completedAt: now,
      completedBy: submissionData.userId,
      winningSubmissionId: submissionId,
      updatedAt: now
    });
    
    return {
      success: true,
      message: 'Submission approved and bounty marked as completed',
      submissionId,
      bountyId
    };
  });
};

/**
 * Reject a submission
 */
export const rejectSubmission = async (
  submissionId: string,
  rejectionReason: string = '',
  rejectedBy: string
): Promise<{success: boolean}> => {
  const db = getDb();
  const now = admin.firestore.Timestamp.now();
  
  const submissionRef = db.collection('submissions').doc(submissionId);
  
  await submissionRef.update({
    status: 'rejected',
    rejectionReason,
    rejectedBy,
    rejectedAt: now,
    updatedAt: now
  });
  
  return { success: true };
}; 