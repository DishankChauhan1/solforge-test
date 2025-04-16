import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';
import { createBounty, getBounty } from '../services/firestore';

// Mock the GitHub API client
jest.mock('../services/github-app', () => ({
  verifyPullRequestForBounty: jest.fn().mockImplementation((prUrl: any, bountyId: any) => {
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

describe('Repository Validation Tests', () => {
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
    status: 'open' as const
  };

  let bountyId: string;

  beforeAll(async () => {
    // Create test user
    await admin.firestore().collection('users').doc(testUser.id).set(testUser);
    
    // Create a test bounty
    const bounty = await createBounty(testBountyInput);
    bountyId = bounty.id;
  });

  afterAll(async () => {
    // Clean up test data
    await admin.firestore().collection('users').doc(testUser.id).delete();
    
    // Delete test bounty
    if (bountyId) {
      await admin.firestore().collection('bounties').doc(bountyId).delete();
    }
  });

  it('should validate a valid PR for a bounty', async () => {
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
    expect(result).toEqual({
      isValid: true,
      reason: 'Valid PR',
      bountyId
    });
  });

  it('should reject an invalid PR for a bounty', async () => {
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
    expect(result).toEqual({
      isValid: false,
      reason: 'Invalid PR',
      bountyId
    });
  });

  it('should reject requests with missing auth', async () => {
    // Create a mock request object without auth
    const mockRequest = {
      data: {
        prUrl: 'https://github.com/org/repo/pull/6-valid',
        bountyId
      }
    };
    
    // Expect the function to throw an error
    await expect(verifyPullRequestForBounty(mockRequest))
      .rejects
      .toThrow('Unauthenticated');
  });

  it('should reject requests with missing PR URL', async () => {
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
    await expect(verifyPullRequestForBounty(mockRequest))
      .rejects
      .toThrow('PR URL is required');
  });

  it('should reject requests with missing bounty ID', async () => {
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
    await expect(verifyPullRequestForBounty(mockRequest))
      .rejects
      .toThrow('Bounty ID is required');
  });
}); 