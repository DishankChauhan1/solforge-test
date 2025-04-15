import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import * as functions from 'firebase-functions';
import { getBountyByPR, updateBountyStatus, getBountyByIssueUrl, getBountyByRepo, updateBountyWithPR } from '../services/firestore';
import { BountyStatus } from '../types/bounty';

// Define an interface that extends Express.Request to include rawBody
interface WebhookRequest extends Request {
  rawBody?: Buffer;
}

// Get the GitHub App webhook secret from Firebase config or environment variables
const GITHUB_APP_WEBHOOK_SECRET = functions.config().github.app_webhook_secret || process.env.GITHUB_APP_WEBHOOK_SECRET;

/**
 * Verify that the webhook is from GitHub by checking the signature
 */
function verifyGitHubWebhook(
  signature: string | undefined,
  signatureSha256: string | undefined,
  rawBody: string | Buffer,
): boolean {
  logger.info("Verifying GitHub webhook signature...");
  
  // If no signature provided, verification fails
  if (!signature && !signatureSha256) {
    logger.error("No signature provided in the request");
    return false;
  }

  try {
    const webhookSecret = GITHUB_APP_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      logger.error("No webhook secret configured");
      return false;
    }

    // Convert rawBody to string if it's a Buffer
    const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
    
    // Try SHA-256 signature first (preferred)
    if (signatureSha256) {
      logger.info(`Received SHA-256 signature: ${signatureSha256}`);
      const [algorithm, signatureValue] = signatureSha256.split('=');
      
      if (!algorithm || !signatureValue) {
        logger.error("Invalid SHA-256 signature format");
        return false;
      }

      const hmac = crypto.createHmac('sha256', webhookSecret);
      hmac.update(payloadString);
      const digest = hmac.digest('hex');
      
      try {
        const result = crypto.timingSafeEqual(
          Buffer.from(digest, 'hex'),
          Buffer.from(signatureValue, 'hex')
        );
        
        logger.info(`SHA-256 signature verification result: ${result}`);
        if (result) return true;
      } catch (err) {
        logger.error("Error comparing SHA-256 signatures:", err);
      }
    }

    // Fall back to SHA-1 signature if SHA-256 fails or isn't provided
    if (signature) {
      logger.info(`Received SHA-1 signature: ${signature}`);
      const [algorithm, signatureValue] = signature.split('=');
      
      if (!algorithm || !signatureValue) {
        logger.error("Invalid SHA-1 signature format");
        return false;
      }

      const hmac = crypto.createHmac('sha1', webhookSecret);
      hmac.update(payloadString);
      const digest = hmac.digest('hex');
      
      try {
        const result = crypto.timingSafeEqual(
          Buffer.from(digest, 'hex'),
          Buffer.from(signatureValue, 'hex')
        );
        
        logger.info(`SHA-1 signature verification result: ${result}`);
        return result;
      } catch (err) {
        logger.error("Error comparing SHA-1 signatures:", err);
        return false;
      }
    }

    return false;
  } catch (error) {
    logger.error("Error verifying webhook signature:", error);
    return false;
  }
}

/**
 * Handle pull request events from GitHub
 */
async function handlePullRequestEvent(payload: any) {
  logger.info("Handling pull request event...");
  logger.info(`Action: ${payload.action}`);
  logger.info(`PR URL: ${payload.pull_request.html_url}`);
  logger.info(`Repository: ${payload.repository.html_url}`);
  
  try {
    // First try to find a bounty by the PR URL
    const bounty = await getBountyByPR(payload.pull_request.html_url);
    
    if (!bounty) {
      logger.info("No bounty found for this PR, checking if this is a new PR...");
      // This could be a new PR, try to associate it with a bounty
      await handleNewPullRequest(payload.pull_request, payload.repository);
      return;
    }
    
    let newStatus: BountyStatus | null = null;
    let metadata: Record<string, any> = {};
    
    // Update bounty status based on PR action
    switch (payload.action) {
      case 'opened':
        newStatus = 'in_progress';
        metadata = {
          prNumber: payload.pull_request.number,
          prTitle: payload.pull_request.title,
          updatedAt: new Date().toISOString()
        };
        break;
      
      case 'closed':
        if (payload.pull_request.merged) {
          newStatus = 'completed';
          metadata = {
            merged: true,
            mergedAt: payload.pull_request.merged_at,
            mergedBy: payload.pull_request.merged_by?.login
          };
        } else {
          newStatus = 'changes_requested';
          metadata = {
            closed: true,
            closedAt: payload.pull_request.closed_at
          };
        }
        break;
      
      case 'reopened':
        newStatus = 'in_progress';
        metadata = {
          reopenedAt: new Date().toISOString()
        };
        break;
      
      default:
        logger.info(`PR action ${payload.action} doesn't require a bounty status update`);
        break;
    }
    
    // Update the bounty status if needed
    if (newStatus) {
      logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
      await updateBountyStatus(bounty.id, newStatus, metadata);
      logger.info("Bounty status updated successfully");
    }
  } catch (error) {
    logger.error("Error handling pull request event:", error);
  }
}

/**
 * Handle pull request review events from GitHub
 */
async function handlePullRequestReviewEvent(payload: any) {
  logger.info("Handling pull request review event...");
  logger.info(`Action: ${payload.action}`);
  logger.info(`Review state: ${payload.review.state}`);
  logger.info(`PR URL: ${payload.pull_request.html_url}`);
  
  try {
    // Find the bounty associated with this PR
    const bounty = await getBountyByPR(payload.pull_request.html_url);
    
    if (!bounty) {
      logger.info("No bounty found for this PR review");
      return;
    }
    
    // Only process submitted reviews
    if (payload.action !== 'submitted') {
      logger.info(`Review action ${payload.action} doesn't require a bounty status update`);
      return;
    }
    
    let newStatus: BountyStatus | null = null;
    let metadata: Record<string, any> = {};
    
    // Update bounty status based on review state
    switch (payload.review.state) {
      case 'approved':
        newStatus = 'approved';
        metadata = {
          reviewId: payload.review.id,
          reviewer: payload.review.user.login,
          reviewSubmittedAt: payload.review.submitted_at
        };
        break;
      
      case 'changes_requested':
        newStatus = 'changes_requested';
        metadata = {
          reviewId: payload.review.id,
          reviewer: payload.review.user.login,
          reviewSubmittedAt: payload.review.submitted_at
        };
        break;
      
      case 'commented':
        // Just a comment, no status change needed
        logger.info("Review is just a comment, no status change needed");
        break;
      
      default:
        logger.info(`Review state ${payload.review.state} doesn't require a bounty status update`);
        break;
    }
    
    // Update the bounty status if needed
    if (newStatus) {
      logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
      await updateBountyStatus(bounty.id, newStatus, metadata);
      logger.info("Bounty status updated successfully");
    }
  } catch (error) {
    logger.error("Error handling pull request review event:", error);
  }
}

/**
 * Handle issue events from GitHub
 */
async function handleIssueEvent(payload: any) {
  logger.info("Handling issue event...");
  logger.info(`Action: ${payload.action}`);
  logger.info(`Issue URL: ${payload.issue.html_url}`);
  
  try {
    // Find the bounty associated with this issue
    const bounty = await getBountyByIssueUrl(payload.issue.html_url);
    
    if (!bounty) {
      logger.info("No bounty found for this issue");
      return;
    }
    
    let newStatus: BountyStatus | null = null;
    let metadata: Record<string, any> = {};
    
    // Update bounty status based on issue action
    switch (payload.action) {
      case 'closed':
        // Check if the bounty has a PR associated with it
        // We can't directly check bounty.prUrl as it might not be in the type
        // so we'll check if the bounty has a claimPR field
        if (!bounty.claimPR) {
          // If the issue is closed without a PR, cancel the bounty
          newStatus = 'cancelled';
          metadata = {
            closedAt: payload.issue.closed_at,
            closedBy: payload.sender.login,
            reason: 'Issue closed without a pull request'
          };
        }
        break;
      
      case 'reopened':
        // Check if the bounty is cancelled and reopen it
        if (bounty.status === 'cancelled' as BountyStatus) {
          newStatus = 'open';
          metadata = {
            reopenedAt: new Date().toISOString(),
            reopenedBy: payload.sender.login
          };
        }
        break;
      
      default:
        logger.info(`Issue action ${payload.action} doesn't require a bounty status update`);
        break;
    }
    
    // Update the bounty status if needed
    if (newStatus) {
      logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
      await updateBountyStatus(bounty.id, newStatus, metadata);
      logger.info("Bounty status updated successfully");
    }
  } catch (error) {
    logger.error("Error handling issue event:", error);
  }
}

// Function to handle new pull requests and associate them with bounties
async function handleNewPullRequest(pullRequest: any, repository: any): Promise<void> {
  // Strategy 1: Check PR body for issue URL references (common format: "Fixes #123" or "Closes #123")
  let issueNumber: number | null = null;
  
  if (pullRequest.body) {
    // Look for issue references in the PR body
    const issueRefs = pullRequest.body.match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
    if (issueRefs && issueRefs[1]) {
      issueNumber = parseInt(issueRefs[1], 10);
      logger.info(`Found issue reference in PR body: #${issueNumber}`);
    }
  }
  
  // Also check PR title for issue references
  if (!issueNumber) {
    const titleRefs = pullRequest.title.match(/#(\d+)/);
    if (titleRefs && titleRefs[1]) {
      issueNumber = parseInt(titleRefs[1], 10);
      logger.info(`Found issue reference in PR title: #${issueNumber}`);
    }
  }
  
  // Store the GitHub username from the PR for later verification
  const githubUsername = pullRequest.user.login;
  logger.info(`PR created by GitHub user: ${githubUsername}`);
  
  // If we found an issue number, construct the issue URL
  if (issueNumber) {
    const repoFullName = repository.full_name;
    const issueUrl = `https://github.com/${repoFullName}/issues/${issueNumber}`;
    logger.info(`Looking for bounty with issue URL: ${issueUrl}`);
    
    // Try to find a bounty by issue URL
    const bounty = await getBountyByIssueUrl(issueUrl);
    
    if (bounty) {
      logger.info(`Found bounty ${bounty.id} for issue #${issueNumber}`);
      
      // Update the bounty with PR information and the GitHub username
      await updateBountyWithPR(bounty.id, pullRequest.html_url, githubUsername);
      await updateBountyStatus(bounty.id, 'in_progress', {
        prSubmittedAt: new Date().toISOString(),
        prNumber: pullRequest.number,
        githubUsername: githubUsername
      });
      
      logger.info(`Updated bounty ${bounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
    }
  }
  
  // Strategy 2: If no issue found, try to match by repository URL
  const repoUrl = repository.html_url;
  logger.info(`No issue match found. Checking for bounties in repository: ${repoUrl}`);
  
  // Get all bounties associated with this repository
  const repoBounties = await getBountyByRepo(repoUrl);
  
  if (repoBounties && repoBounties.length > 0) {
    logger.info(`Found ${repoBounties.length} bounties in this repository`);
    
    // For now, just use the first open bounty in the repo (could be enhanced with more logic)
    const openBounty = repoBounties.find(b => b.status === 'open');
    
    if (openBounty) {
      logger.info(`Found open bounty ${openBounty.id} in repository`);
      
      // Update the bounty with PR information and the GitHub username
      await updateBountyWithPR(openBounty.id, pullRequest.html_url, githubUsername);
      await updateBountyStatus(openBounty.id, 'in_progress', {
        prSubmittedAt: new Date().toISOString(),
        prNumber: pullRequest.number,
        githubUsername: githubUsername
      });
      
      logger.info(`Updated bounty ${openBounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
    } else {
      logger.info('No open bounties found in this repository');
    }
  } else {
    logger.info('No bounties found for this repository');
  }
}

// Main GitHub App webhook handler
export const githubAppWebhookHandler = onRequest({
  maxInstances: 10,
  timeoutSeconds: 60,
  region: 'us-central1'
}, async (req: WebhookRequest, res: Response) => {
  logger.info('Received GitHub App webhook request', {
    method: req.method,
    path: req.path,
    eventType: req.headers['x-github-event']
  });

  // Log all headers for debugging
  logger.debug('Request headers:', req.headers);

  // Only allow POST requests
  if (req.method !== 'POST') {
    logger.warn(`Invalid method: ${req.method}`);
    res.status(405).send('Method Not Allowed');
    return;
  }

  const event = req.headers['x-github-event'] as string;
  logger.info(`Received GitHub event: ${event}`);

  // Handle ping event (sent when app is installed)
  if (event === 'ping') {
    logger.info('Received ping event');
    res.status(200).send('Pong!');
    return;
  }

  // Get signatures from headers
  const signature = req.headers['x-hub-signature'] as string;
  const signatureSha256 = req.headers['x-hub-signature-256'] as string;
  
  if (!signature && !signatureSha256) {
    logger.error('No signature found in headers');
    res.status(401).send('No signature provided');
    return;
  }

  // Determine what to use for verification
  let bodyToVerify: string | Buffer;
  
  if (req.rawBody) {
    // Use rawBody if available (preferred)
    bodyToVerify = req.rawBody;
    logger.info('Using raw request body for verification');
  } else {
    // Fall back to stringified body if rawBody not available
    bodyToVerify = JSON.stringify(req.body);
    logger.warn('Raw body not available, using JSON.stringify(req.body) as fallback (less reliable)');
  }
  
  // Verify the signature against the body
  const isValidSignature = verifyGitHubWebhook(
    signature,
    signatureSha256,
    bodyToVerify
  );

  if (!isValidSignature) {
    logger.error('Invalid signature');
    res.status(401).send('Invalid signature');
    return;
  }

  logger.info('Signature verified, processing webhook');

  try {
    // Process different event types
    switch (event) {
      case 'pull_request':
        logger.info('Processing pull request event');
        await handlePullRequestEvent(req.body);
        break;
      
      case 'pull_request_review':
        logger.info('Processing pull request review event');
        await handlePullRequestReviewEvent(req.body);
        break;
        
      case 'issues':
        logger.info('Processing issue event');
        await handleIssueEvent(req.body);
        break;
      
      case 'installation':
      case 'installation_repositories':
        logger.info(`Received ${event} event`);
        // Handle app installation events if needed
        break;
        
      default:
        logger.info(`Received unhandled event type: ${event}`);
        break;
    }

    // Default success response
    res.status(200).send('Webhook processed successfully');
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).send('Error processing webhook');
  }
});

// Add a test endpoint for the GitHub App webhook
export const githubAppWebhookTest = onRequest({
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  invoker: 'public'
}, async (req: WebhookRequest, res: Response) => {
  logger.info('GitHub App webhook test endpoint hit, headers:', JSON.stringify(req.headers));
  res.status(200).json({
    message: 'GitHub App webhook test endpoint working correctly',
    timestamp: new Date().toISOString(),
    headers: req.headers
  });
}); 