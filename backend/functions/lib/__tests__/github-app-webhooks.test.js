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
const crypto = __importStar(require("crypto"));
const firestore_1 = require("../services/firestore");
// Mock the functions.config()
globals_1.jest.mock('firebase-functions', () => {
    const original = globals_1.jest.requireActual('firebase-functions');
    return {
        config: globals_1.jest.fn().mockReturnValue({
            github: {
                app_webhook_secret: 'test-webhook-secret'
            }
        }),
        logger: {
            info: globals_1.jest.fn(),
            error: globals_1.jest.fn(),
            warn: globals_1.jest.fn(),
            debug: globals_1.jest.fn()
        }
    };
});
// Import the handler after mocking config
const { githubAppWebhookHandler } = require('../routes/github-app-webhooks');
(0, globals_1.describe)('GitHub App Webhook Tests', () => {
    const testUser = {
        id: 'github-app-test-user',
        githubUsername: 'appuser',
        githubAvatar: 'https://github.com/appuser.png',
        walletAddress: 'test-wallet-app'
    };
    const testBountyInput = {
        title: 'App Webhook Test Bounty',
        description: 'Testing GitHub App webhook functionality',
        amount: 750,
        tokenMint: process.env.USDC_MINT_ADDRESS || 'mock-usdc-mint',
        issueUrl: 'https://github.com/org/repo/issues/5',
        repositoryUrl: 'https://github.com/org/repo',
        createdBy: testUser.id,
        status: 'open'
    };
    // Mock GitHub webhook PR payload
    const mockPullRequestPayload = {
        action: 'opened',
        pull_request: {
            number: 5,
            html_url: 'https://github.com/org/repo/pull/5',
            body: 'Fixes #5',
            user: {
                id: 12345,
                login: testUser.githubUsername,
                avatar_url: testUser.githubAvatar
            },
            head: {
                ref: 'fix-branch',
                sha: 'app123'
            },
            base: {
                ref: 'main'
            }
        },
        repository: {
            full_name: 'org/repo',
            html_url: 'https://github.com/org/repo'
        },
        sender: {
            login: testUser.githubUsername,
            id: 12345,
            avatar_url: testUser.githubAvatar
        }
    };
    let bountyId;
    (0, globals_1.beforeAll)(async () => {
        // Create test user
        await admin.firestore().collection('users').doc(testUser.id).set(testUser);
        // Create a test bounty
        const bounty = await (0, firestore_1.createBounty)(testBountyInput);
        bountyId = bounty.id;
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await admin.firestore().collection('users').doc(testUser.id).delete();
        // Delete test bounty
        if (bountyId) {
            await admin.firestore().collection('bounties').doc(bountyId).delete();
        }
    });
    (0, globals_1.it)('should handle ping events with 200 status', async () => {
        // Create ping payload
        const pingPayload = {
            zen: 'Keep it logically awesome',
            hook_id: 12345,
            hook: {
                type: 'App',
                id: 12345,
                name: 'web',
                active: true,
                events: ['push', 'pull_request']
            },
            repository: {
                full_name: 'org/repo',
                html_url: 'https://github.com/org/repo'
            }
        };
        const payloadBuffer = Buffer.from(JSON.stringify(pingPayload));
        // Generate valid signature
        const hmac = crypto.createHmac('sha256', 'test-webhook-secret');
        hmac.update(payloadBuffer);
        const signature = 'sha256=' + hmac.digest('hex');
        // Create mock request
        const mockRequest = {
            method: 'POST',
            path: '/webhook',
            headers: {
                'x-github-event': 'ping',
                'x-hub-signature-256': signature
            },
            body: pingPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await githubAppWebhookHandler(mockRequest, mockResponse);
        // Verify response
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(200);
        (0, globals_1.expect)(mockResponse.send).toHaveBeenCalledWith('Pong!');
    });
    (0, globals_1.it)('should verify signatures and reject invalid ones', async () => {
        // Create test payload
        const testPayload = { test: 'data' };
        const payloadBuffer = Buffer.from(JSON.stringify(testPayload));
        // Generate invalid signature
        const hmac = crypto.createHmac('sha256', 'wrong-secret');
        hmac.update(payloadBuffer);
        const invalidSignature = 'sha256=' + hmac.digest('hex');
        // Create mock request with invalid signature
        const mockRequest = {
            method: 'POST',
            path: '/webhook',
            headers: {
                'x-github-event': 'ping',
                'x-hub-signature-256': invalidSignature
            },
            body: testPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await githubAppWebhookHandler(mockRequest, mockResponse);
        // Verify response
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(401);
        (0, globals_1.expect)(mockResponse.send).toHaveBeenCalledWith('Invalid signature');
    });
    (0, globals_1.it)('should reject non-POST requests', async () => {
        // Create mock GET request
        const mockRequest = {
            method: 'GET',
            path: '/webhook',
            headers: {},
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await githubAppWebhookHandler(mockRequest, mockResponse);
        // Verify response
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(405);
        (0, globals_1.expect)(mockResponse.send).toHaveBeenCalledWith('Method Not Allowed');
    });
    (0, globals_1.it)('should handle pull request events and update bounties', async () => {
        // Link the bounty to the PR explicitly in Firestore
        await admin.firestore().collection('bounties').doc(bountyId).update({
            issueUrl: mockPullRequestPayload.pull_request.body.replace('Fixes ', 'https://github.com/org/repo/issues/')
        });
        const payloadBuffer = Buffer.from(JSON.stringify(mockPullRequestPayload));
        // Generate valid signature
        const hmac = crypto.createHmac('sha256', 'test-webhook-secret');
        hmac.update(payloadBuffer);
        const signature = 'sha256=' + hmac.digest('hex');
        // Create mock request
        const mockRequest = {
            method: 'POST',
            path: '/webhook',
            headers: {
                'x-github-event': 'pull_request',
                'x-hub-signature-256': signature
            },
            body: mockPullRequestPayload,
            rawBody: payloadBuffer,
            get: (header) => mockRequest.headers[header.toLowerCase()]
        };
        // Create mock response
        const mockResponse = {
            status: globals_1.jest.fn().mockReturnThis(),
            send: globals_1.jest.fn().mockReturnThis()
        };
        // Process the webhook
        await githubAppWebhookHandler(mockRequest, mockResponse);
        // Verify response
        (0, globals_1.expect)(mockResponse.status).toHaveBeenCalledWith(200);
        // Verify bounty status was updated
        const bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty)
            throw new Error('Bounty not found');
        // Get the bounty directly from Firestore to check all fields
        const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
        const bountyData = bountyDoc.data();
        // After a PR is opened, the bounty should have a PR URL and be in_progress
        (0, globals_1.expect)(bountyData?.prUrl).toBe(mockPullRequestPayload.pull_request.html_url);
        (0, globals_1.expect)(bountyData?.status).toBe('in_progress');
    });
});
//# sourceMappingURL=github-app-webhooks.test.js.map