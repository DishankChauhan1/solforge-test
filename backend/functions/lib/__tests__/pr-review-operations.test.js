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
(0, globals_1.describe)('Pull Request Review Operations Tests', () => {
    const testUser = {
        id: 'test-user-1',
        githubUsername: 'testuser',
        githubAvatar: 'https://github.com/testuser.png',
        walletAddress: 'test-wallet-1'
    };
    const reviewerUser = {
        id: 'reviewer-user-1',
        githubUsername: 'reviewer',
        githubAvatar: 'https://github.com/reviewer.png',
        walletAddress: 'reviewer-wallet-1'
    };
    const testBountyInput = {
        title: 'Fix Review Bug',
        description: 'Need to fix review functionality',
        amount: 500,
        tokenMint: process.env.USDC_MINT_ADDRESS || 'mock-usdc-mint',
        issueUrl: 'https://github.com/org/repo/issues/2',
        repositoryUrl: 'https://github.com/org/repo',
        createdBy: reviewerUser.id,
        status: 'open'
    };
    // Mock GitHub webhook pull request payload
    const mockPullRequestPayload = {
        action: 'opened',
        pull_request: {
            number: 2,
            html_url: 'https://github.com/org/repo/pull/2',
            body: 'Fixes #2',
            user: {
                id: '12345',
                login: testUser.githubUsername,
                avatar_url: testUser.githubAvatar
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
    // Mock GitHub webhook review payload - Approved
    const mockApprovedReviewPayload = {
        action: 'submitted',
        review: {
            id: 12345,
            node_id: 'node123',
            user: {
                id: '67890',
                login: reviewerUser.githubUsername,
                avatar_url: reviewerUser.githubAvatar
            },
            body: 'LGTM! Approved.',
            commit_id: 'abc123',
            submitted_at: new Date().toISOString(),
            state: 'approved',
            html_url: 'https://github.com/org/repo/pull/2#pullrequestreview-123',
            pull_request_url: 'https://github.com/org/repo/pull/2',
            author_association: 'OWNER',
            _links: {
                html: { href: 'https://github.com/org/repo/pull/2#pullrequestreview-123' },
                pull_request: { href: 'https://github.com/org/repo/pull/2' }
            }
        },
        pull_request: mockPullRequestPayload.pull_request,
        repository: mockPullRequestPayload.repository,
        sender: {
            id: '67890',
            login: reviewerUser.githubUsername,
            avatar_url: reviewerUser.githubAvatar
        }
    };
    // Mock GitHub webhook review payload - Changes Requested
    const mockChangesRequestedReviewPayload = {
        ...mockApprovedReviewPayload,
        review: {
            ...mockApprovedReviewPayload.review,
            id: 12346,
            body: 'Please make the following changes...',
            state: 'changes_requested'
        }
    };
    let bountyId;
    (0, globals_1.beforeAll)(async () => {
        // Create test users
        await admin.firestore().collection('users').doc(testUser.id).set(testUser);
        await admin.firestore().collection('users').doc(reviewerUser.id).set(reviewerUser);
        // Create a bounty that we'll use for all tests
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        bountyId = bounty.id;
        // Link PR to bounty
        await (0, firestore_1.updateBountyWithPR)(bountyId, mockPullRequestPayload.pull_request.html_url, testUser.githubUsername);
        // Set status to in_progress (simulating PR submission)
        await (0, firestore_1.updateBountyStatus)(bountyId, 'in_progress');
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await admin.firestore().collection('users').doc(testUser.id).delete();
        await admin.firestore().collection('users').doc(reviewerUser.id).delete();
        // Delete test bounty
        if (bountyId) {
            const bountyRef = admin.firestore().collection('bounties').doc(bountyId);
            await bountyRef.delete();
        }
    });
    (0, globals_1.it)('should update bounty status to approved when PR is approved', async () => {
        // Create mock response object
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Create mock request with review payload
        const approvedReviewRequest = {
            headers: {
                'x-github-event': 'pull_request_review',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mockApprovedReviewPayload,
            rawBody: Buffer.from(JSON.stringify(mockApprovedReviewPayload)),
            get: (header) => approvedReviewRequest.headers[header.toLowerCase()]
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(approvedReviewRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
        // Verify bounty status was updated to approved
        const approvedBounty = await (0, firestore_1.getBounty)(bountyId);
        if (!approvedBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(approvedBounty.status).toBe('approved');
        // Get the bounty document directly to check metadata
        const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
        const bountyData = bountyDoc.data();
        (0, globals_1.expect)(bountyData?.statusMetadata).toBeDefined();
        (0, globals_1.expect)(bountyData?.statusMetadata?.reviewer).toBe(reviewerUser.githubUsername);
        (0, globals_1.expect)(bountyData?.statusMetadata?.reviewId).toBe(mockApprovedReviewPayload.review.id);
    });
    (0, globals_1.it)('should update bounty status to changes_requested when changes are requested', async () => {
        // Create mock response object
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Create mock request with changes requested payload
        const changesRequestedReviewRequest = {
            headers: {
                'x-github-event': 'pull_request_review',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mockChangesRequestedReviewPayload,
            rawBody: Buffer.from(JSON.stringify(mockChangesRequestedReviewPayload)),
            get: (header) => changesRequestedReviewRequest.headers[header.toLowerCase()]
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(changesRequestedReviewRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
        // Verify bounty status was updated to changes_requested
        const changesRequestedBounty = await (0, firestore_1.getBounty)(bountyId);
        if (!changesRequestedBounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(changesRequestedBounty.status).toBe('changes_requested');
        // Get the bounty document directly to check metadata
        const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
        const bountyData = bountyDoc.data();
        (0, globals_1.expect)(bountyData?.statusMetadata).toBeDefined();
        (0, globals_1.expect)(bountyData?.statusMetadata?.reviewer).toBe(reviewerUser.githubUsername);
        (0, globals_1.expect)(bountyData?.statusMetadata?.reviewId).toBe(mockChangesRequestedReviewPayload.review.id);
    });
    (0, globals_1.it)('should handle PR comments without changing bounty status', async () => {
        // First, set the bounty back to in_progress
        await (0, firestore_1.updateBountyStatus)(bountyId, 'in_progress');
        // Verify the status was reset
        let bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(bounty.status).toBe('in_progress');
        // Create comment review payload
        const mockCommentReviewPayload = {
            ...mockApprovedReviewPayload,
            review: {
                ...mockApprovedReviewPayload.review,
                id: 12347,
                body: 'Just a comment, not approval or rejection',
                state: 'commented'
            }
        };
        // Create mock response object
        const mockRes = {
            status: globals_1.jest.fn().mockReturnThis(),
            json: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Create mock request with comment payload
        const commentReviewRequest = {
            headers: {
                'x-github-event': 'pull_request_review',
                'x-hub-signature-256': 'sha256=mock_signature'
            },
            body: mockCommentReviewPayload,
            rawBody: Buffer.from(JSON.stringify(mockCommentReviewPayload)),
            get: (header) => commentReviewRequest.headers[header.toLowerCase()]
        };
        // Process the webhook
        await (0, github_webhooks_1.githubWebhookHandler)(commentReviewRequest, mockRes);
        (0, globals_1.expect)(mockRes.status).toHaveBeenCalledWith(200);
        // Verify bounty status was NOT changed (should still be in_progress)
        bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty)
            throw new Error('Bounty not found');
        (0, globals_1.expect)(bounty.status).toBe('in_progress');
    });
});
//# sourceMappingURL=pr-review-operations.test.js.map