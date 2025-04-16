import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

import type { Request, Response } from 'express';
import { createBounty, getBounty, updateBountyStatus } from '../services/firestore';

// Mock the functions.config()
jest.mock('firebase-functions', () => {
  const original = jest.requireActual('firebase-functions');
  return {
    config: jest.fn().mockReturnValue({
      github: {
        app_webhook_secret: 'test-webhook-secret'
      }
    }),
    logger: {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn()
    }
  };
});

// Import the handler after mocking config
const { githubAppWebhookHandler } = require('../routes/github-app-webhooks');

// Extend Request to include rawBody as required by webhook handler
interface WebhookRequest extends Request {
  rawBody: Buffer;
  method: string;
  path: string;
}

describe('GitHub App Webhook Tests', () => {
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
    status: 'open' as const
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

  it('should handle ping events with 200 status', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubAppWebhookHandler(mockRequest, mockResponse);
    
    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    expect(mockResponse.send).toHaveBeenCalledWith('Pong!');
  });

  it('should verify signatures and reject invalid ones', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubAppWebhookHandler(mockRequest, mockResponse);
    
    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.send).toHaveBeenCalledWith('Invalid signature');
  });

  it('should reject non-POST requests', async () => {
    // Create mock GET request
    const mockRequest = {
      method: 'GET',
      path: '/webhook',
      headers: {},
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubAppWebhookHandler(mockRequest, mockResponse);
    
    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(405);
    expect(mockResponse.send).toHaveBeenCalledWith('Method Not Allowed');
  });

  it('should handle pull request events and update bounties', async () => {
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
      get: (header: string) => mockRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;
    
    // Create mock response
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;
    
    // Process the webhook
    await githubAppWebhookHandler(mockRequest, mockResponse);
    
    // Verify response
    expect(mockResponse.status).toHaveBeenCalledWith(200);
    
    // Verify bounty status was updated
    const bounty = await getBounty(bountyId);
    if (!bounty) throw new Error('Bounty not found');
    
    // Get the bounty directly from Firestore to check all fields
    const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
    const bountyData = bountyDoc.data();
    
    // After a PR is opened, the bounty should have a PR URL and be in_progress
    expect(bountyData?.prUrl).toBe(mockPullRequestPayload.pull_request.html_url);
    expect(bountyData?.status).toBe('in_progress');
  });
}); 