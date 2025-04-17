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
const github_webhooks_1 = require("../routes/github-webhooks");
(0, globals_1.describe)('End-to-End Bounty Workflow Tests', () => {
    // Test data
    const testUser = {
        id: 'test-user-1',
        githubId: '12345',
        username: 'testuser',
        email: 'test@example.com',
        avatarUrl: 'https://github.com/testuser.png'
    };
    const testBountyInput = {
        title: 'Fix Critical Bug',
        description: 'Need to fix a critical performance issue',
        amount: 500,
        tokenMint: process.env.USDC_MINT_ADDRESS || 'mock-usdc-mint',
        issueUrl: 'https://github.com/org/repo/issues/1',
        repositoryUrl: 'https://github.com/org/repo',
        createdBy: testUser.id,
        status: 'open'
    };
    // Mock GitHub webhook payload
    const mockPullRequestPayload = {
        action: 'opened',
        pull_request: {
            number: 1,
            html_url: 'https://github.com/org/repo/pull/1',
            body: 'Fixes #1',
            user: {
                id: testUser.githubId,
                login: testUser.username,
                avatar_url: testUser.avatarUrl
            },
            head: {
                ref: 'fix-branch',
                sha: 'abc123'
            },
            base: {
                ref: 'main'
            }
        },
        repository: {
            full_name: 'org/repo',
            html_url: 'https://github.com/org/repo'
        }
    };
    (0, globals_1.beforeAll)(async () => {
        // Create test user in Firestore
        await admin.firestore().collection('users').doc(testUser.id).set(testUser);
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await admin.firestore().collection('users').doc(testUser.id).delete();
    });
    (0, globals_1.it)('should complete full bounty lifecycle from creation to payment', async () => {
        // 1. Create a new bounty
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        (0, globals_1.expect)(bounty.id).toBeDefined();
        const createdBounty = await (0, firestore_1.getBounty)(bounty.id);
        (0, globals_1.expect)(createdBounty).toMatchObject({
            ...testBountyInput,
            id: bounty.id
        });
        // 2. Simulate pull request creation
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        const prWebhookRequest = {
            headers: {
                'x-github-event': 'pull_request',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mockPullRequestPayload,
            rawBody: Buffer.from(JSON.stringify(mockPullRequestPayload)),
            get: (header) => prWebhookRequest.headers[header.toLowerCase()]
        };
        await (0, github_webhooks_1.githubWebhookHandler)(prWebhookRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
        // 3. Verify bounty status updated to in_progress
        const inProgressBounty = await (0, firestore_1.getBounty)(bounty.id);
        if (!inProgressBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(inProgressBounty.status).toBe('in_progress');
        (0, globals_1.expect)(inProgressBounty.claimedBy).toBe(testUser.id);
        // 4. Simulate pull request merge
        const mergedPrPayload = {
            ...mockPullRequestPayload,
            action: 'closed',
            pull_request: {
                ...mockPullRequestPayload.pull_request,
                merged: true,
                merged_at: new Date().toISOString()
            }
        };
        const mergeWebhookRequest = {
            headers: {
                'x-github-event': 'pull_request',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mergedPrPayload,
            rawBody: Buffer.from(JSON.stringify(mergedPrPayload)),
            get: (header) => mergeWebhookRequest.headers[header.toLowerCase()]
        };
        const mockMergeRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        await (0, github_webhooks_1.githubWebhookHandler)(mergeWebhookRequest, mockMergeRes);
        (0, globals_1.expect)(mockMergeRes.status).toHaveBeenCalledWith(200);
        // 5. Verify final bounty status and payment
        const completedBounty = await (0, firestore_1.getBounty)(bounty.id);
        if (!completedBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(completedBounty.status).toBe('completed');
        // 6. Verify payment record
        const paymentSnapshot = await admin.firestore()
            .collection('payments')
            .where('bountyId', '==', bounty.id)
            .get();
        (0, globals_1.expect)(paymentSnapshot.empty).toBe(false);
        const payment = paymentSnapshot.docs[0].data();
        (0, globals_1.expect)(payment).toMatchObject({
            amount: testBountyInput.amount,
            tokenMint: testBountyInput.tokenMint,
            recipientId: testUser.id,
            status: 'completed'
        });
    });
    (0, globals_1.it)('should handle invalid pull request submissions', async () => {
        // Create a new bounty
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        // Simulate PR from different user
        const invalidPrPayload = {
            ...mockPullRequestPayload,
            pull_request: {
                ...mockPullRequestPayload.pull_request,
                user: {
                    id: 'different-user',
                    login: 'different-user',
                    avatar_url: 'https://github.com/different-user.png'
                }
            }
        };
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        const invalidPrRequest = {
            headers: {
                'x-github-event': 'pull_request',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: invalidPrPayload,
            rawBody: Buffer.from(JSON.stringify(invalidPrPayload)),
            get: (header) => invalidPrRequest.headers[header.toLowerCase()]
        };
        await (0, github_webhooks_1.githubWebhookHandler)(invalidPrRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(400);
        // Verify bounty remains open
        const openBounty = await (0, firestore_1.getBounty)(bounty.id);
        if (!openBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(openBounty.status).toBe('open');
    });
    (0, globals_1.it)('should handle bounty cancellation', async () => {
        // Create a new bounty
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        // Cancel the bounty
        await (0, firestore_1.updateBountyStatus)(bounty.id, 'cancelled');
        // Verify cancelled status
        const cancelledBounty = await (0, firestore_1.getBounty)(bounty.id);
        if (!cancelledBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(cancelledBounty.status).toBe('cancelled');
        // Attempt to submit PR for cancelled bounty
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        const prRequest = {
            headers: {
                'x-github-event': 'pull_request',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mockPullRequestPayload,
            rawBody: Buffer.from(JSON.stringify(mockPullRequestPayload)),
            get: (header) => prRequest.headers[header.toLowerCase()]
        };
        await (0, github_webhooks_1.githubWebhookHandler)(prRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(400);
    });
});
//# sourceMappingURL=bounty-workflow.test.js.map