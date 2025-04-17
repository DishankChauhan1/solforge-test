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
// Mock the GitHub API client
globals_1.jest.mock('../services/github-app', () => ({
    verifyPullRequestForBounty: globals_1.jest.fn().mockImplementation((prUrl, bountyId) => {
        // Return true if the test PR URL contains "valid", false otherwise
        return Promise.resolve({
            isValid: prUrl.includes('valid'),
            reason: prUrl.includes('valid') ? 'Valid PR' : 'Invalid PR',
            bountyId
        });
    })
}));
// Import after mocking
const { verifyPullRequestForBounty } = require('../routes/repository-validation');
(0, globals_1.describe)('Repository Validation Tests', () => {
    const testUser = {
        id: 'repo-validation-user',
        githubUsername: 'validationuser',
        githubAvatar: 'https://github.com/validationuser.png',
        walletAddress: 'test-wallet-validation'
    };
    const testBountyInput = {
        title: 'Repo Validation Test Bounty',
        description: 'Testing repository validation functionality',
        amount: 600,
        tokenMint: process.env.USDC_MINT_ADDRESS || 'mock-usdc-mint',
        issueUrl: 'https://github.com/org/repo/issues/6',
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
    });
    (0, globals_1.afterAll)(async () => {
        // Clean up test data
        await admin.firestore().collection('users').doc(testUser.id).delete();
        // Delete test bounty
        if (bountyId) {
            await admin.firestore().collection('bounties').doc(bountyId).delete();
        }
    });
    (0, globals_1.it)('should validate a valid PR for a bounty', async () => {
        // Create a mock request object
        const mockRequest = {
            auth: {
                uid: testUser.id
            },
            data: {
                prUrl: 'https://github.com/org/repo/pull/6-valid',
                bountyId
            }
        };
        // Call the verification function
        const result = await verifyPullRequestForBounty(mockRequest);
        // Verify the response
        (0, globals_1.expect)(result).toEqual({
            isValid: true,
            reason: 'Valid PR',
            bountyId
        });
    });
    (0, globals_1.it)('should reject an invalid PR for a bounty', async () => {
        // Create a mock request object
        const mockRequest = {
            auth: {
                uid: testUser.id
            },
            data: {
                prUrl: 'https://github.com/org/repo/pull/6-invalid',
                bountyId
            }
        };
        // Call the verification function
        const result = await verifyPullRequestForBounty(mockRequest);
        // Verify the response
        (0, globals_1.expect)(result).toEqual({
            isValid: false,
            reason: 'Invalid PR',
            bountyId
        });
    });
    (0, globals_1.it)('should reject requests with missing auth', async () => {
        // Create a mock request object without auth
        const mockRequest = {
            data: {
                prUrl: 'https://github.com/org/repo/pull/6-valid',
                bountyId
            }
        };
        // Expect the function to throw an error
        await (0, globals_1.expect)(verifyPullRequestForBounty(mockRequest))
            .rejects
            .toThrow('Unauthenticated');
    });
    (0, globals_1.it)('should reject requests with missing PR URL', async () => {
        // Create a mock request object without PR URL
        const mockRequest = {
            auth: {
                uid: testUser.id
            },
            data: {
                bountyId
            }
        };
        // Expect the function to throw an error
        await (0, globals_1.expect)(verifyPullRequestForBounty(mockRequest))
            .rejects
            .toThrow('PR URL is required');
    });
    (0, globals_1.it)('should reject requests with missing bounty ID', async () => {
        // Create a mock request object without bounty ID
        const mockRequest = {
            auth: {
                uid: testUser.id
            },
            data: {
                prUrl: 'https://github.com/org/repo/pull/6-valid'
            }
        };
        // Expect the function to throw an error
        await (0, globals_1.expect)(verifyPullRequestForBounty(mockRequest))
            .rejects
            .toThrow('Bounty ID is required');
    });
});
//# sourceMappingURL=repository-validation.test.js.map