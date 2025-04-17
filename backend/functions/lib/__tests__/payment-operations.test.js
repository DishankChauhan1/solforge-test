"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("../services/firestore");
const solana_1 = require("../services/solana");
// Mock the Solana service
globals_1.jest.mock('../services/solana', () => ({
    completeBounty: globals_1.jest.fn().mockImplementation((bountyId, walletAddress) => Promise.resolve({
        signature: 'mock-transaction-signature-' + bountyId
    }))
}));
(0, globals_1.describe)('Payment Operations Tests', () => {
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
        status: 'open'
    };
    let bountyId;
    (0, globals_1.beforeAll)(async () => {
        // Create test user
        await admin.firestore().collection('users').doc(testUser.id).set(testUser);
        // Create a test bounty
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        bountyId = bounty.id;
        // Set PR URL and status (as if it was claimed and completed)
        await admin.firestore().collection('bounties').doc(bountyId).update({
            prUrl: 'https://github.com/org/repo/pull/3',
            claimedBy: testUser.id,
            claimedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    });
    (0, globals_1.afterAll)(async () => {
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
    (0, globals_1.it)('should initialize payment tracking when bounty status is set to completed', async () => {
        // Update bounty to completed status
        await (0, firestore_1.updateBountyStatus)(bountyId, 'completed', {
            completedAt: new Date().toISOString()
        });
        // Verify payment status was initialized
        const paymentsSnapshot = await admin.firestore()
            .collection('payments')
            .where('bountyId', '==', bountyId)
            .get();
        (0, globals_1.expect)(paymentsSnapshot.empty).toBe(false);
        (0, globals_1.expect)(paymentsSnapshot.size).toBe(1);
        const payment = paymentsSnapshot.docs[0].data();
        (0, globals_1.expect)(payment.status).toBe('pending');
        (0, globals_1.expect)(payment.amount).toBe(testBountyInput.amount);
        (0, globals_1.expect)(payment.recipientId).toBe(testUser.id);
    });
    (0, globals_1.it)('should update payment status during payment processing', async () => {
        // Update payment status to processing
        await (0, firestore_1.updateBountyPayment)(bountyId, {
            status: 'processing',
            processingStartedAt: new Date().toISOString()
        });
        // Verify status was updated
        const paymentsSnapshot = await admin.firestore()
            .collection('payments')
            .where('bountyId', '==', bountyId)
            .get();
        const payment = paymentsSnapshot.docs[0].data();
        (0, globals_1.expect)(payment.status).toBe('processing');
        (0, globals_1.expect)(payment.processingStartedAt).toBeDefined();
    });
    (0, globals_1.it)('should complete payment successfully', async () => {
        // Call the mocked completeBounty function directly
        const result = await (0, solana_1.completeBounty)(bountyId, testUser.walletAddress, 'https://github.com/org/repo/pull/3');
        // Verify mock was called
        (0, globals_1.expect)(solana_1.completeBounty).toHaveBeenCalledWith(bountyId, testUser.walletAddress, 'https://github.com/org/repo/pull/3');
        // Verify result has signature
        (0, globals_1.expect)(result.signature).toBe(`mock-transaction-signature-${bountyId}`);
        // Update payment status to completed
        await (0, firestore_1.updateBountyPayment)(bountyId, {
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
        (0, globals_1.expect)(payment.status).toBe('completed');
        (0, globals_1.expect)(payment.completedAt).toBeDefined();
        (0, globals_1.expect)(payment.transactionSignature).toBe(result.signature);
    });
    (0, globals_1.it)('should handle payment failures', async () => {
        // First, reset the bounty status
        await (0, firestore_1.updateBountyStatus)(bountyId, 'open');
        // Create a new bounty for failure testing
        const failureBounty = await (0, firestore_1.createBounty)({
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
        solana_1.completeBounty.mockImplementationOnce(() => Promise.reject(new Error('Payment processing failed')));
        // Attempt to complete the bounty but expect failure
        try {
            await (0, solana_1.completeBounty)(failureBounty.id, testUser.walletAddress, 'https://github.com/org/repo/pull/4');
            // Should not reach here
            (0, globals_1.expect)(true).toBe(false);
        }
        catch (error) {
            (0, globals_1.expect)(error.message).toBe('Payment processing failed');
        }
        // Mark payment as failed
        await (0, firestore_1.updateBountyPayment)(failureBounty.id, {
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
        (0, globals_1.expect)(payment.status).toBe('failed');
        (0, globals_1.expect)(payment.failedAt).toBeDefined();
        (0, globals_1.expect)(payment.lastError).toBe('Payment processing failed');
        // Clean up
        await admin.firestore().collection('bounties').doc(failureBounty.id).delete();
        // Reset the mock
        solana_1.completeBounty.mockClear();
    });
});
//# sourceMappingURL=payment-operations.test.js.map