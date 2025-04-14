import { onCall, HttpsError, CallableOptions } from 'firebase-functions/v2/https';
import { getBounty, createBounty, claimBounty, listBounties } from '../services/firestore';

interface CreateBountyData {
  title: string;
  description: string;
  amount: number;
  tokenMint?: string;
  issueUrl: string;
  repositoryUrl: string;
}

interface BountyActionData {
  bountyId: string;
  prLink?: string;
}

const functionConfig: CallableOptions = {
  enforceAppCheck: false,
  cors: ['http://localhost:3000', 'https://coingate-3b632.web.app', 'https://coingate-3b632.firebaseapp.com'],
  maxInstances: 10,
  region: 'us-central1'
};

// Get all bounties
export const getAllBounties = onCall(functionConfig, async (request) => {
  try {
    const bounties = await listBounties();
    return bounties;
  } catch (error) {
    console.error('Error getting bounties:', error);
    throw new HttpsError('internal', 'Error fetching bounties');
  }
});

// Get bounty by ID
export const getBountyById = onCall(functionConfig, async (request) => {
  try {
    const data = request.data as BountyActionData;
    const { bountyId } = data;
    if (!bountyId) {
      throw new HttpsError('invalid-argument', 'Bounty ID is required');
    }

    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError('not-found', 'Bounty not found');
    }

    return bounty;
  } catch (error) {
    console.error('Error getting bounty:', error);
    throw new HttpsError('internal', 'Error fetching bounty');
  }
});

// Create new bounty
export const createBountyHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const data = request.data as CreateBountyData;
  const { title, description, amount, tokenMint, issueUrl, repositoryUrl } = data;

  if (!title || !description || !amount || !issueUrl || !repositoryUrl) {
    throw new HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  try {
    const bounty = await createBounty({
      title,
      description,
      amount,
      tokenMint,
      issueUrl,
      repositoryUrl,
      createdBy: request.auth.uid,
      status: 'open'
    });

    return { success: true, bounty };
  } catch (error) {
    console.error('Error creating bounty:', error);
    throw new HttpsError(
      'internal',
      'Failed to create bounty'
    );
  }
});

// Claim a bounty
export const claimBountyHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const data = request.data as BountyActionData;
  const { bountyId, prLink } = data;

  if (!bountyId) {
    throw new HttpsError(
      'invalid-argument',
      'Missing bounty ID'
    );
  }

  try {
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError(
        'not-found',
        'Bounty not found'
      );
    }

    if (bounty.status !== 'open') {
      throw new HttpsError(
        'failed-precondition',
        'Bounty is not available for claiming'
      );
    }

    const updatedBounty = await claimBounty(bountyId, request.auth.uid, prLink || '');

    return { success: true, bounty: updatedBounty };
  } catch (error) {
    console.error('Error claiming bounty:', error);
    throw new HttpsError(
      'internal',
      'Failed to claim bounty'
    );
  }
});

export const verifyPR = onCall(functionConfig, (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const data = request.data as BountyActionData;
  const { bountyId, prLink } = data;

  if (!bountyId || !prLink) {
    throw new HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  // Rest of the verification logic...
}); 