import { onCall, HttpsError, CallableOptions } from 'firebase-functions/v2/https';
import { getBounty, createBounty, claimBounty, listBounties, submitClaim, getBountySubmissions, approveSubmission, rejectSubmission, updateBountyStatus } from '../services/firestore';
import { cancelBounty, extendDeadline } from '../services/solana';
import { processBountyPayment } from '../services/payment-service';
import { logger } from 'firebase-functions';
import * as admin from 'firebase-admin';

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
    // Create a clean data object without undefined values
    const bountyData = {
      title,
      description,
      amount,
      issueUrl,
      repositoryUrl,
      createdBy: request.auth.uid,
      status: 'open' as const
    };

    // Only add tokenMint if it's defined
    if (tokenMint) {
      Object.assign(bountyData, { tokenMint });
    }

    const bounty = await createBounty(bountyData);
    return { success: true, bounty };
  } catch (error) {
    console.error('Error creating bounty:', error);
    throw new HttpsError(
      'internal',
      'Failed to create bounty'
    );
  }
});

// Create new bounty V2 (fix for undefined values)
export const createBountyHandlerV2 = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      'unauthenticated',
      'User must be authenticated'
    );
  }

  const data = request.data as any;
  
  // Log what we received
  console.log('Received create bounty data:', JSON.stringify(data));

  // Validate required fields
  if (!data.title || !data.description || !data.amount || !data.issueUrl || !data.repositoryUrl) {
    throw new HttpsError(
      'invalid-argument',
      'Missing required fields'
    );
  }

  try {
    // Create a clean data object without undefined values
    const bountyData = {
      title: data.title,
      description: data.description,
      amount: Number(data.amount),
      issueUrl: data.issueUrl,
      repositoryUrl: data.repositoryUrl,
      createdBy: request.auth.uid,
      status: 'open' as const
    };

    // Only add tokenMint if it's defined
    if (data.tokenMint) {
      Object.assign(bountyData, { tokenMint: data.tokenMint });
    }

    console.log('Creating bounty with:', JSON.stringify(bountyData));
    const bounty = await createBounty(bountyData);
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

// Submit a claim for a bounty (supports multiple submissions per bounty)
export const submitClaimHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { bountyId, prLink, description } = data;

  if (!bountyId || !prLink) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    const result = await submitClaim(bountyId, request.auth.uid, prLink, description || '');
    return { success: true, submission: result.submission };
  } catch (error) {
    console.error('Error submitting claim:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to submit claim');
  }
});

// Get all submissions for a bounty
export const getBountySubmissionsHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { bountyId } = data;

  if (!bountyId) {
    throw new HttpsError('invalid-argument', 'Bounty ID is required');
  }

  try {
    // Get the bounty to check permissions
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError('not-found', 'Bounty not found');
    }

    // Only the bounty creator or the claimant can see submissions
    if (bounty.createdBy !== request.auth.uid && bounty.claimedBy !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'You do not have permission to view submissions for this bounty');
    }

    const submissions = await getBountySubmissions(bountyId);
    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting bounty submissions:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to get submissions');
  }
});

// Approve a submission
export const approveSubmissionHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { submissionId, bountyId } = data;

  if (!submissionId || !bountyId) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    // Get the bounty to check permissions
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError('not-found', 'Bounty not found');
    }

    // Only the bounty creator can approve submissions
    if (bounty.createdBy !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Only the bounty creator can approve submissions');
    }
    
    // Approve the submission in Firestore
    const result = await approveSubmission(submissionId, bountyId, request.auth.uid);
    
    if (result.success) {
      // Get the submission to find the contributor's user ID
      const db = admin.firestore();
      const submissionDoc = await db.collection('submissions').doc(submissionId).get();
      
      if (!submissionDoc.exists) {
        logger.error(`Submission ${submissionId} not found during payment processing`);
        throw new HttpsError('not-found', 'Submission not found');
      }
      
      const submissionData = submissionDoc.data();
      
      if (!submissionData?.userId) {
        logger.error(`Submission ${submissionId} has no associated user ID`);
        throw new HttpsError('internal', 'Submission has no associated user ID');
      }
      
      // Process the payment
      logger.info(`Processing payment for approved submission ${submissionId}`);
      const paymentResult = await processBountyPayment(
        bountyId,
        submissionId,
        submissionData.userId
      );
      
      if (paymentResult.success) {
        logger.info(`Payment processed successfully for bounty ${bountyId}`);
        return {
          ...result,
          payment: {
            success: true,
            signature: paymentResult.signature
          }
        };
      } else {
        logger.error(`Payment processing failed: ${paymentResult.message}`);
        return {
          ...result,
          payment: {
            success: false,
            error: paymentResult.message
          }
        };
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error approving submission:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to approve submission');
  }
});

// Reject a submission
export const rejectSubmissionHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { submissionId, rejectionReason } = data;

  if (!submissionId) {
    throw new HttpsError('invalid-argument', 'Submission ID is required');
  }

  try {
    const result = await rejectSubmission(submissionId, rejectionReason || '', request.auth.uid);
    return result;
  } catch (error) {
    console.error('Error rejecting submission:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to reject submission');
  }
});

// Cancel a bounty
export const cancelBountyHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { bountyId } = data;

  if (!bountyId) {
    throw new HttpsError('invalid-argument', 'Bounty ID is required');
  }

  try {
    // Get the bounty to check permissions
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError('not-found', 'Bounty not found');
    }

    // Only the creator can cancel a bounty
    if (bounty.createdBy !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Only the bounty creator can cancel it');
    }

    // Check if bounty can be cancelled (only open bounties can be cancelled)
    if (bounty.status !== 'open') {
      throw new HttpsError('failed-precondition', 'Only open bounties can be cancelled');
    }

    // Call the Solana service to cancel the bounty
    const result = await cancelBounty((bounty as any).bountyAccount || bounty.id);
    
    if (result.success) {
      // Update bounty status in Firestore
      await updateBountyStatus(bountyId, 'cancelled', {
        cancelledAt: new Date().toISOString(),
        cancelledBy: request.auth.uid,
        signature: result.signature
      });
      
      return { success: true, signature: result.signature };
    } else {
      throw new HttpsError('internal', 'Failed to cancel bounty on blockchain');
    }
  } catch (error) {
    console.error('Error cancelling bounty:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to cancel bounty');
  }
});

// Extend bounty deadline
export const extendDeadlineHandler = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  const data = request.data;
  const { bountyId, newDeadline } = data;

  if (!bountyId || !newDeadline) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  try {
    // Get the bounty to check permissions
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new HttpsError('not-found', 'Bounty not found');
    }

    // Only the creator can extend the deadline
    if (bounty.createdBy !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Only the bounty creator can extend the deadline');
    }

    // Check if bounty can have its deadline extended (only open bounties)
    if (bounty.status !== 'open') {
      throw new HttpsError('failed-precondition', 'Only open bounties can have their deadline extended');
    }

    // Ensure new deadline is in the future
    const now = Math.floor(Date.now() / 1000);
    if (newDeadline <= now) {
      throw new HttpsError('invalid-argument', 'New deadline must be in the future');
    }

    // Call the Solana service to extend the deadline
    const result = await extendDeadline((bounty as any).bountyAccount || bounty.id, newDeadline);
    
    if (result.success) {
      // Update bounty metadata in Firestore
      await updateBountyStatus(bountyId, 'open', {
        deadline: newDeadline,
        previousDeadline: (bounty as any).deadline || null,
        extendedAt: new Date().toISOString(),
        extendedBy: request.auth.uid,
        signature: result.signature
      });
      
      return { success: true, signature: result.signature };
    } else {
      throw new HttpsError('internal', 'Failed to extend deadline on blockchain');
    }
  } catch (error) {
    console.error('Error extending bounty deadline:', error);
    throw new HttpsError('internal', error instanceof Error ? error.message : 'Failed to extend deadline');
  }
}); 