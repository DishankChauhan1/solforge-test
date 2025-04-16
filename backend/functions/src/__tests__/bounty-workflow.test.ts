import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';

import { createBounty, getBounty, updateBountyStatus } from '../services/firestore';
import { githubWebhookHandler } from '../routes/github-webhooks';
import type { Request, Response } from 'express';

// Extend Request to include rawBody as required by webhook handler
interface WebhookRequest extends Request {
  rawBody: Buffer;
}

describe('End-to-End Bounty Workflow Tests', () => {
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
    status: 'open' as const
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

  beforeAll(async () => {
    // Create test user in Firestore
    await admin.firestore().collection('users').doc(testUser.id).set(testUser);
  });

  afterAll(async () => {
    // Clean up test data
    await admin.firestore().collection('users').doc(testUser.id).delete();
  });

  it('should complete full bounty lifecycle from creation to payment', async () => {
    // 1. Create a new bounty
    const bounty = await createBounty(testBountyInput);
    expect(bounty.id).toBeDefined();

    const createdBounty = await getBounty(bounty.id);
    expect(createdBounty).toMatchObject({
      ...testBountyInput,
      id: bounty.id
    });

    // 2. Simulate pull request creation
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    const prWebhookRequest = {
      headers: {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: mockPullRequestPayload,
      rawBody: Buffer.from(JSON.stringify(mockPullRequestPayload)),
      get: (header: string) => prWebhookRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    await githubWebhookHandler(prWebhookRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);

    // 3. Verify bounty status updated to in_progress
    const inProgressBounty = await getBounty(bounty.id);
    if (!inProgressBounty) throw new Error('Bounty not found');
    expect(inProgressBounty.status).toBe('in_progress');
    expect(inProgressBounty.claimedBy).toBe(testUser.id);

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
      get: (header: string) => mergeWebhookRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    const mockMergeRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    await githubWebhookHandler(mergeWebhookRequest, mockMergeRes);
    expect(mockMergeRes.status).toHaveBeenCalledWith(200);

    // 5. Verify final bounty status and payment
    const completedBounty = await getBounty(bounty.id);
    if (!completedBounty) throw new Error('Bounty not found');
    expect(completedBounty.status).toBe('completed');
    
    // 6. Verify payment record
    const paymentSnapshot = await admin.firestore()
      .collection('payments')
      .where('bountyId', '==', bounty.id)
      .get();
    
    expect(paymentSnapshot.empty).toBe(false);
    const payment = paymentSnapshot.docs[0].data();
    expect(payment).toMatchObject({
      amount: testBountyInput.amount,
      tokenMint: testBountyInput.tokenMint,
      recipientId: testUser.id,
      status: 'completed'
    });
  });

  it('should handle invalid pull request submissions', async () => {
    // Create a new bounty
    const bounty = await createBounty(testBountyInput);

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
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    const invalidPrRequest = {
      headers: {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: invalidPrPayload,
      rawBody: Buffer.from(JSON.stringify(invalidPrPayload)),
      get: (header: string) => invalidPrRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    await githubWebhookHandler(invalidPrRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);

    // Verify bounty remains open
    const openBounty = await getBounty(bounty.id);
    if (!openBounty) throw new Error('Bounty not found');
    expect(openBounty.status).toBe('open');
  });

  it('should handle bounty cancellation', async () => {
    // Create a new bounty
    const bounty = await createBounty(testBountyInput);

    // Cancel the bounty
    await updateBountyStatus(bounty.id, 'cancelled');

    // Verify cancelled status
    const cancelledBounty = await getBounty(bounty.id);
    if (!cancelledBounty) throw new Error('Bounty not found');
    expect(cancelledBounty.status).toBe('cancelled');

    // Attempt to submit PR for cancelled bounty
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    const prRequest = {
      headers: {
        'x-github-event': 'pull_request',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: mockPullRequestPayload,
      rawBody: Buffer.from(JSON.stringify(mockPullRequestPayload)),
      get: (header: string) => prRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    await githubWebhookHandler(prRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
}); 