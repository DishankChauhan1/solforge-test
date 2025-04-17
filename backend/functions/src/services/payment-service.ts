import * as admin from 'firebase-admin';
import { logger } from 'firebase-functions';
import { PublicKey } from '@solana/web3.js';
import {  transferSOL, transferSPLToken } from './solana';
import { getUser, getBounty, updateBountyPayment } from './firestore';

/**
 * Process payment for a completed bounty
 * This is called when a PR is merged or when a bounty is manually approved
 * 
 * @param bountyId The Firestore ID of the bounty
 * @param submissionId The Firestore ID of the submission
 * @param userId The user ID of the contributor
 * @returns Promise with payment details
 */
export const processBountyPayment = async (
  bountyId: string,
  submissionId: string,
  userId: string
): Promise<{ success: boolean; message: string; signature?: string }> => {
  logger.info(`Processing payment for bounty ${bountyId} to user ${userId}`);
  
  try {
    // Get the bounty data
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      throw new Error(`Bounty ${bountyId} not found`);
    }
    
    // Check if bounty has already been paid
    if (bounty.payment && bounty.payment.status === 'completed') {
      logger.info(`Bounty ${bountyId} has already been paid`);
      return { 
        success: true, 
        message: 'Payment has already been processed',
        signature: bounty.payment.signature
      };
    }
    
    // Get the contributor's user data
    const user = await getUser(userId);
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    // Check if user has a wallet address
    if (!user.walletAddress) {
      logger.error(`User ${userId} does not have a wallet address`);
      await updateBountyPayment(bountyId, {
        status: 'failed',
        error: 'Contributor does not have a wallet address',
        attemptedAt: new Date().toISOString()
      });
      return { 
        success: false, 
        message: 'Contributor does not have a wallet address' 
      };
    }
    
    // Update payment status to processing
    await updateBountyPayment(bountyId, {
      status: 'processing',
      contributorId: userId,
      contributorWallet: user.walletAddress,
      amount: bounty.amount,
      tokenMint: bounty.tokenMint || null,
      processingStartedAt: new Date().toISOString()
    });
    
    let signature;
    // Check if this is a token or SOL bounty
    if (bounty.tokenMint) {
      // This is a token bounty
      logger.info(`Processing token payment of ${bounty.amount} tokens to ${user.walletAddress}`);
      
      try {
        const tokenMint = new PublicKey(bounty.tokenMint);
        const recipientWallet = new PublicKey(user.walletAddress);
        
        // Use admin wallet as sender (defined in the transferSPLToken function)
        signature = await transferSPLToken(
          new PublicKey('ignored'), // This is replaced with admin wallet in the function
          recipientWallet,
          tokenMint,
          bounty.amount
        );
      } catch (error) {
        logger.error(`Error processing token payment: ${error}`);
        await updateBountyPayment(bountyId, {
          status: 'failed',
          error: `Token transfer failed: ${error}`,
          attemptedAt: new Date().toISOString()
        });
        throw error;
      }
    } else {
      // This is a SOL bounty
      logger.info(`Processing SOL payment of ${bounty.amount} lamports to ${user.walletAddress}`);
      
      try {
        const recipientWallet = new PublicKey(user.walletAddress);
        
        // Convert SOL amount to lamports (if not already in lamports)
        const lamports = bounty.amount;
        
        // Use admin wallet as sender (defined in the transferSOL function)
        signature = await transferSOL(
          new PublicKey('ignored'), // This is replaced with admin wallet in the function
          recipientWallet,
          lamports
        );
      } catch (error) {
        logger.error(`Error processing SOL payment: ${error}`);
        await updateBountyPayment(bountyId, {
          status: 'failed',
          error: `SOL transfer failed: ${error}`,
          attemptedAt: new Date().toISOString()
        });
        throw error;
      }
    }
    
    // Update bounty payment record with successful transaction
    await updateBountyPayment(bountyId, {
      status: 'completed',
      signature,
      completedAt: new Date().toISOString()
    });
    
    // Update user statistics (increment total earned, completed bounties)
    await updateUserStats(userId, bounty);
    
    // Award any applicable badges
    await checkAndAwardBadges(userId);
    
    return {
      success: true,
      message: 'Payment processed successfully',
      signature
    };
  } catch (error) {
    logger.error(`Error processing payment: ${error}`);
    return {
      success: false,
      message: `Payment failed: ${error}`
    };
  }
};

/**
 * Update user statistics after successful bounty completion
 */
async function updateUserStats(userId: string, bounty: any): Promise<void> {
  const db = admin.firestore();
  const userRef = db.collection('users').doc(userId);
  
  // Get current stats
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    logger.error(`User ${userId} not found when updating stats`);
    return;
  }
  
  const userData = userDoc.data() || {};
  
  // Initialize stats object if not exists
  if (!userData.stats) {
    userData.stats = {
      totalEarned: 0,
      completedBounties: 0,
      totalSubmissions: 0
    };
  }
  
  // Update stats
  const stats = userData.stats;
  stats.totalEarned = (stats.totalEarned || 0) + bounty.amount;
  stats.completedBounties = (stats.completedBounties || 0) + 1;
  
  // Update user document
  await userRef.update({
    stats,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  logger.info(`Updated stats for user ${userId}: completed bounties = ${stats.completedBounties}, total earned = ${stats.totalEarned}`);
}

/**
 * Check for badge achievements and award them
 */
async function checkAndAwardBadges(userId: string): Promise<void> {
  const db = admin.firestore();
  
  // Get user data with their current stats
  const userDoc = await db.collection('users').doc(userId).get();
  if (!userDoc.exists) return;
  
  const userData = userDoc.data() || {};
  const stats = userData.stats || {};
  
  // Get current badges
  const currentBadges = userData.badges || [];
  const newBadges = [];
  
  // Check for first bounty badge
  if (stats.completedBounties >= 1 && !currentBadges.includes('first_bounty')) {
    newBadges.push({
      id: 'first_bounty',
      name: 'First Bounty',
      description: 'Completed your first bounty',
      awardedAt: new Date().toISOString()
    });
  }
  
  // Check for 5 bounties badge
  if (stats.completedBounties >= 5 && !currentBadges.includes('five_bounties')) {
    newBadges.push({
      id: 'five_bounties',
      name: 'Bounty Hunter',
      description: 'Completed 5 bounties',
      awardedAt: new Date().toISOString()
    });
  }
  
  // Check for 10 bounties badge
  if (stats.completedBounties >= 10 && !currentBadges.includes('ten_bounties')) {
    newBadges.push({
      id: 'ten_bounties',
      name: 'Bounty Expert',
      description: 'Completed 10 bounties',
      awardedAt: new Date().toISOString()
    });
  }
  
  // If we have new badges to award, update the user
  if (newBadges.length > 0) {
    // Add new badge IDs to the existing badge IDs
    const updatedBadgeIds = [
      ...currentBadges,
      ...newBadges.map(badge => badge.id)
    ];
    
    // Add detailed badge objects to the badges collection
    for (const badge of newBadges) {
      await db.collection('users').doc(userId)
        .collection('badges').doc(badge.id).set(badge);
      
      logger.info(`Awarded badge "${badge.name}" to user ${userId}`);
    }
    
    // Update the user's badge IDs list
    await db.collection('users').doc(userId).update({
      badges: updatedBadgeIds,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
} 