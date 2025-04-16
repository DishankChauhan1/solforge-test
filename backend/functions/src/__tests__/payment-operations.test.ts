import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';

import { createBounty, updateBountyStatus, updateBountyPayment } from '../services/firestore';
import { completeBounty } from '../services/solana';

// Mock the Solana service
jest.mock('../services/solana', () => ({
  completeBounty: jest.fn().mockImplementation((bountyId, walletAddress) => 
    Promise.resolve({
      signature: 'mock-transaction-signature-' + bountyId
    })
  )
}));

describe('Payment Operations Tests', () => {
  const testUser = {
    id: 'test-payment-user',
    githubUsername: 'paymentuser',
    githubAvatar: 'https://github.com/paymentuser.png',
    walletAddress: 'wallet123payment'
  };

  const testBountyInput = {
    title: 'Payment Test Bounty',
    description: 'Testing payment operations',
    amount: 1000,
    tokenMint: process.env.USDC_MINT_ADDRESS || 'mock-usdc-mint',
    issueUrl: 'https://github.com/org/repo/issues/3',
    repositoryUrl: 'https://github.com/org/repo',
    createdBy: testUser.id,
    status: 'open' as const
  };

  let bountyId: string;

  beforeAll(async () => {
    // Create test user
    await admin.firestore().collection('users').doc(testUser.id).set(testUser);
    
    // Create a test bounty
    const bounty = await createBounty(testBountyInput);
    bountyId = bounty.id;
    
    // Set PR URL and status (as if it was claimed and completed)
    await admin.firestore().collection('bounties').doc(bountyId).update({
      prUrl: 'https://github.com/org/repo/pull/3',
      claimedBy: testUser.id,
      claimedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  afterAll(async () => {
    // Clean up test data
    await admin.firestore().collection('users').doc(testUser.id).delete();
    
    // Delete test bounty and any related payments
    if (bountyId) {
      await admin.firestore().collection('bounties').doc(bountyId).delete();
      
      // Delete any payments for this bounty
      const paymentsSnapshot = await admin.firestore()
        .collection('payments')
        .where('bountyId', '==', bountyId)
        .get();
      
      const deletePromises = paymentsSnapshot.docs.map(doc => doc.ref.delete());
      await Promise.all(deletePromises);
    }
  });

  it('should initialize payment tracking when bounty status is set to completed', async () => {
    // Update bounty to completed status
    await updateBountyStatus(bountyId, 'completed', {
      completedAt: new Date().toISOString()
    });
    
    // Verify payment status was initialized
    const paymentsSnapshot = await admin.firestore()
      .collection('payments')
      .where('bountyId', '==', bountyId)
      .get();
    
    expect(paymentsSnapshot.empty).toBe(false);
    expect(paymentsSnapshot.size).toBe(1);
    
    const payment = paymentsSnapshot.docs[0].data();
    expect(payment.status).toBe('pending');
    expect(payment.amount).toBe(testBountyInput.amount);
    expect(payment.recipientId).toBe(testUser.id);
  });

  it('should update payment status during payment processing', async () => {
    // Update payment status to processing
    await updateBountyPayment(bountyId, {
      status: 'processing',
      processingStartedAt: new Date().toISOString()
    });
    
    // Verify status was updated
    const paymentsSnapshot = await admin.firestore()
      .collection('payments')
      .where('bountyId', '==', bountyId)
      .get();
    
    const payment = paymentsSnapshot.docs[0].data();
    expect(payment.status).toBe('processing');
    expect(payment.processingStartedAt).toBeDefined();
  });

  it('should complete payment successfully', async () => {
    // Call the mocked completeBounty function directly
    const result = await completeBounty(bountyId, testUser.walletAddress, 'https://github.com/org/repo/pull/3');
    
    // Verify mock was called
    expect(completeBounty).toHaveBeenCalledWith(bountyId, testUser.walletAddress, 'https://github.com/org/repo/pull/3');
    
    // Verify result has signature
    expect(result.signature).toBe(`mock-transaction-signature-${bountyId}`);
    
    // Update payment status to completed
    await updateBountyPayment(bountyId, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      transactionSignature: result.signature
    });
    
    // Verify payment was marked as completed
    const paymentsSnapshot = await admin.firestore()
      .collection('payments')
      .where('bountyId', '==', bountyId)
      .get();
    
    const payment = paymentsSnapshot.docs[0].data();
    expect(payment.status).toBe('completed');
    expect(payment.completedAt).toBeDefined();
    expect(payment.transactionSignature).toBe(result.signature);
  });

  it('should handle payment failures', async () => {
    // First, reset the bounty status
    await updateBountyStatus(bountyId, 'open');
    
    // Create a new bounty for failure testing
    const failureBounty = await createBounty({
      ...testBountyInput,
      title: 'Payment Failure Test'
    });
    
    // Set PR URL and status
    await admin.firestore().collection('bounties').doc(failureBounty.id).update({
      prUrl: 'https://github.com/org/repo/pull/4',
      claimedBy: testUser.id,
      claimedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Configure the mock to fail for this specific bounty
    (completeBounty as jest.Mock).mockImplementationOnce(() => 
      Promise.reject(new Error('Payment processing failed'))
    );
    
    // Attempt to complete the bounty but expect failure
    try {
      await completeBounty(failureBounty.id, testUser.walletAddress, 'https://github.com/org/repo/pull/4');
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toBe('Payment processing failed');
    }
    
    // Mark payment as failed
    await updateBountyPayment(failureBounty.id, {
      status: 'failed',
      failedAt: new Date().toISOString(),
      lastError: 'Payment processing failed'
    });
    
    // Verify payment was marked as failed
    const paymentsSnapshot = await admin.firestore()
      .collection('payments')
      .where('bountyId', '==', failureBounty.id)
      .get();
    
    const payment = paymentsSnapshot.docs[0].data();
    expect(payment.status).toBe('failed');
    expect(payment.failedAt).toBeDefined();
    expect(payment.lastError).toBe('Payment processing failed');
    
    // Clean up
    await admin.firestore().collection('bounties').doc(failureBounty.id).delete();
    
    // Reset the mock
    (completeBounty as jest.Mock).mockClear();
  });
}); 