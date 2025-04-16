import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import * as admin from 'firebase-admin';

import { createBounty, getBounty, updateBountyStatus, updateBountyWithPR } from '../services/firestore';
import { githubWebhookHandler } from '../routes/github-webhooks';
import type { Request, Response } from 'express';

// Extend Request to include rawBody as required by webhook handler
interface WebhookRequest extends Request {
  rawBody: Buffer;
}

describe('Pull Request Review Operations Tests', () => {
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
    status: 'open' as const
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

  let bountyId: string;

  beforeAll(async () => {
    // Create test users
    await admin.firestore().collection('users').doc(testUser.id).set(testUser);
    await admin.firestore().collection('users').doc(reviewerUser.id).set(reviewerUser);
    
    // Create a bounty that we'll use for all tests
    const bounty = await createBounty(testBountyInput);
    bountyId = bounty.id;
    
    // Link PR to bounty
    await updateBountyWithPR(bountyId, mockPullRequestPayload.pull_request.html_url, testUser.githubUsername);
    
    // Set status to in_progress (simulating PR submission)
    await updateBountyStatus(bountyId, 'in_progress');
  });

  afterAll(async () => {
    // Clean up test data
    await admin.firestore().collection('users').doc(testUser.id).delete();
    await admin.firestore().collection('users').doc(reviewerUser.id).delete();
    
    // Delete test bounty
    if (bountyId) {
      const bountyRef = admin.firestore().collection('bounties').doc(bountyId);
      await bountyRef.delete();
    }
  });

  it('should update bounty status to approved when PR is approved', async () => {
    // Create mock response object
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    // Create mock request with review payload
    const approvedReviewRequest = {
      headers: {
        'x-github-event': 'pull_request_review',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: mockApprovedReviewPayload,
      rawBody: Buffer.from(JSON.stringify(mockApprovedReviewPayload)),
      get: (header: string) => approvedReviewRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    // Process the webhook
    await githubWebhookHandler(approvedReviewRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);

    // Verify bounty status was updated to approved
    const approvedBounty = await getBounty(bountyId);
    if (!approvedBounty) throw new Error('Bounty not found');
    expect(approvedBounty.status).toBe('approved');
    
    // Get the bounty document directly to check metadata
    const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
    const bountyData = bountyDoc.data();
    expect(bountyData?.statusMetadata).toBeDefined();
    expect(bountyData?.statusMetadata?.reviewer).toBe(reviewerUser.githubUsername);
    expect(bountyData?.statusMetadata?.reviewId).toBe(mockApprovedReviewPayload.review.id);
  });

  it('should update bounty status to changes_requested when changes are requested', async () => {
    // Create mock response object
    const mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    // Create mock request with changes requested payload
    const changesRequestedReviewRequest = {
      headers: {
        'x-github-event': 'pull_request_review',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: mockChangesRequestedReviewPayload,
      rawBody: Buffer.from(JSON.stringify(mockChangesRequestedReviewPayload)),
      get: (header: string) => changesRequestedReviewRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    // Process the webhook
    await githubWebhookHandler(changesRequestedReviewRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);

    // Verify bounty status was updated to changes_requested
    const changesRequestedBounty = await getBounty(bountyId);
    if (!changesRequestedBounty) throw new Error('Bounty not found');
    expect(changesRequestedBounty.status).toBe('changes_requested');
    
    // Get the bounty document directly to check metadata
    const bountyDoc = await admin.firestore().collection('bounties').doc(bountyId).get();
    const bountyData = bountyDoc.data();
    expect(bountyData?.statusMetadata).toBeDefined();
    expect(bountyData?.statusMetadata?.reviewer).toBe(reviewerUser.githubUsername);
    expect(bountyData?.statusMetadata?.reviewId).toBe(mockChangesRequestedReviewPayload.review.id);
  });

  it('should handle PR comments without changing bounty status', async () => {
    // First, set the bounty back to in_progress
    await updateBountyStatus(bountyId, 'in_progress');
    
    // Verify the status was reset
    let bounty = await getBounty(bountyId);
    if (!bounty) throw new Error('Bounty not found');
    expect(bounty.status).toBe('in_progress');
    
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
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis()
    } as unknown as Response;

    // Create mock request with comment payload
    const commentReviewRequest = {
      headers: {
        'x-github-event': 'pull_request_review',
        'x-hub-signature-256': 'sha256=mock_signature'
      },
      body: mockCommentReviewPayload,
      rawBody: Buffer.from(JSON.stringify(mockCommentReviewPayload)),
      get: (header: string) => commentReviewRequest.headers[header.toLowerCase()]
    } as unknown as WebhookRequest;

    // Process the webhook
    await githubWebhookHandler(commentReviewRequest, mockRes);
    expect(mockRes.status).toHaveBeenCalledWith(200);

    // Verify bounty status was NOT changed (should still be in_progress)
    bounty = await getBounty(bountyId);
    if (!bounty) throw new Error('Bounty not found');
    expect(bounty.status).toBe('in_progress');
  });
}); 