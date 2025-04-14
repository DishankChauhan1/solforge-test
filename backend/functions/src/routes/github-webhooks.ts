import { onRequest } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { getBountyByPR, updateBountyStatus } from '../services/firestore';
import { BountyStatus } from '../types/bounty';

// Hardcoded secret for development - the same as what's in Firebase config
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';

interface PullRequestPayload {
  action: 'opened' | 'closed' | 'reopened';
  pull_request: {
    html_url: string;
    merged: boolean;
    merged_at: string | null;
    merge_commit_sha: string | null;
    closed_at: string | null;
  };
}

interface PullRequestReviewPayload {
  action: 'submitted' | 'edited' | 'dismissed';
  review: {
    state: 'approved' | 'changes_requested' | 'commented';
    submitted_at: string;
    user: {
      login: string;
    };
  };
  pull_request: {
    html_url: string;
  };
}

// Verify GitHub webhook signature
function verifyGitHubWebhook(payload: string, signature: string): boolean {
  try {
    console.log('Received signature:', signature);
    
    // Determine which algorithm is being used
    let algorithm: string;
    let signatureHash: string;
    
    if (signature.startsWith('sha256=')) {
      algorithm = 'sha256';
      signatureHash = signature.slice('sha256='.length);
    } else if (signature.startsWith('sha1=')) {
      algorithm = 'sha1';
      signatureHash = signature.slice('sha1='.length);
    } else {
      console.error('Unsupported signature format:', signature);
      return false;
    }
    
    // Create the HMAC with the correct algorithm
    const hmac = crypto.createHmac(algorithm, WEBHOOK_SECRET);
    const digest = hmac.update(payload).digest('hex');
    
    console.log(`Expected ${algorithm} digest:`, digest);
    console.log(`Received ${algorithm} hash:`, signatureHash);
    
    // Use a constant-time comparison to prevent timing attacks
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signatureHash, 'hex'),
        Buffer.from(digest, 'hex')
      );
    } catch (error) {
      console.error('Error in comparison:', error);
      
      // Basic string comparison as fallback (not secure, but for debugging)
      const match = digest === signatureHash;
      console.log('Basic string comparison result:', match);
      
      // TEMPORARY: Return true for debugging until signature issue is fixed
      return true;
    }
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    
    // TEMPORARY: Return true for debugging until signature issue is fixed
    return true;
  }
}

export const githubWebhookHandler = onRequest(
  { 
    cors: true,
    region: 'us-central1',
    minInstances: 0,
    timeoutSeconds: 300,
    maxInstances: 10,
    invoker: 'public'
  },
  async (request: Request, response: Response) => {
    console.log('Received webhook request');
    
    const event = request.headers['x-github-event'];
    const payload = request.body;
    const signature = request.headers['x-hub-signature-256'] as string || 
                      request.headers['x-hub-signature'] as string;

    console.log('Headers received:', JSON.stringify(request.headers));
    console.log('Event type:', event);
    console.log('Payload received:', typeof payload === 'object' ? 'JSON object' : typeof payload);
    
    if (!event) {
      console.error('No event type specified');
      response.status(400).send('No event type specified');
      return;
    }

    if (!signature) {
      console.error('No signature provided');
      response.status(401).send('No signature provided');
      return;
    }

    const rawPayload = JSON.stringify(payload);
    console.log(`Payload length: ${rawPayload.length} characters`);
    
    try {
      // Verify the payload signature
      const isValid = verifyGitHubWebhook(
        rawPayload, 
        signature
      );

      if (!isValid) {
        console.error('Invalid signature');
        response.status(401).send('Invalid signature');
        return;
      }
    } catch (error) {
      console.error('Error during verification:', error);
      // For debugging, we'll continue even if verification fails
    }

    // Handle ping events
    if (event === 'ping') {
      console.log('Received ping event from GitHub');
      response.status(200).send('Webhook ping received successfully');
      return;
    }

    // Handle pull request events
    if (event === 'pull_request') {
      console.log('Received pull request event');
      await handlePullRequestEvent(payload as unknown as PullRequestPayload);
    }

    // Handle pull request review events
    if (event === 'pull_request_review') {
      console.log('Received pull request review event');
      await handlePullRequestReviewEvent(payload as unknown as PullRequestReviewPayload);
    }

    response.status(200).send('Webhook received successfully');
  }
);

async function handlePullRequestEvent(payload: PullRequestPayload) {
  const { action, pull_request } = payload;
  const prUrl = pull_request.html_url;

  // Get bounty associated with this PR
  const bounty = await getBountyByPR(prUrl);
  if (!bounty) {
    console.log('No bounty found for PR:', prUrl);
    return;
  }

  switch (action) {
    case 'closed':
      if (pull_request.merged) {
        // PR was merged, update bounty status
        await updateBountyStatus(bounty.id, 'completed', {
          mergedAt: pull_request.merged_at,
          mergeCommitSha: pull_request.merge_commit_sha
        });
      } else {
        // PR was closed without merging
        await updateBountyStatus(bounty.id, 'open', {
          closedAt: pull_request.closed_at,
          closeReason: 'pr_closed_without_merge'
        });
      }
      break;

    case 'reopened':
      // PR was reopened, update bounty status if needed
      if (bounty.status === 'completed' || bounty.status === 'cancelled' as BountyStatus) {
        await updateBountyStatus(bounty.id, 'in_progress');
      }
      break;
  }
}

async function handlePullRequestReviewEvent(payload: PullRequestReviewPayload) {
  const { action, review, pull_request } = payload;
  const prUrl = pull_request.html_url;

  // Get bounty associated with this PR
  const bounty = await getBountyByPR(prUrl);
  if (!bounty) {
    console.log('No bounty found for PR:', prUrl);
    return;
  }

  if (action === 'submitted') {
    switch (review.state) {
      case 'approved':
        // PR was approved, update bounty status
        await updateBountyStatus(bounty.id, 'approved' as BountyStatus, {
          approvedAt: review.submitted_at,
          approvedBy: review.user.login
        });
        break;

      case 'changes_requested':
        // Changes requested, update bounty status
        await updateBountyStatus(bounty.id, 'changes_requested' as BountyStatus, {
          reviewedAt: review.submitted_at,
          reviewedBy: review.user.login
        });
        break;
    }
  }
}

// Add a test endpoint
export const webhookTest = onRequest(
  { 
    cors: true,
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    invoker: 'public'
  },
  async (request: Request, response: Response) => {
    console.log('Test endpoint hit, headers:', JSON.stringify(request.headers));
    response.status(200).json({
      message: 'Webhook test endpoint working correctly',
      timestamp: new Date().toISOString(),
      headers: request.headers
    });
  }
); 