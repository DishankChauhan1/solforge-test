import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import type { Request, Response } from 'express';
import * as crypto from 'crypto';
import { getBountyByPR, updateBountyStatus, getBountyByIssueUrl, getBountyByRepo, updateBountyWithPR, getBounty, getUser, updateBountyPayment } from '../services/firestore';
import { BountyStatus } from '../types/bounty';
import { completeBounty } from '../services/solana';
import { getConfig, getGitHubConfig, getLoggingConfig } from '../config';
// import * as functions from 'firebase-functions';
// import { defineString, defineSecret } from 'firebase-functions/params';

// Replace hardcoded values with config
const config = getConfig();
const githubConfig = getGitHubConfig();
const loggingConfig = getLoggingConfig();

// Update logging configuration
if (loggingConfig.verbose) {
  // Firebase logger doesn't have a 'level' property, so use info to indicate verbose mode is on
  logger.info('Verbose logging enabled');
  // When verbose is true, we'll log additional details throughout the code
}

// Maximum number of payment retry attempts
const MAX_PAYMENT_RETRIES = 3;

// Payment status tracking (defined as enum values rather than just type)
enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Add middleware type extending Express.Request to include rawBody
type WebhookRequest = Request & {
  rawBody?: Buffer;
};

// GitHub webhook payload types
interface GitHubUser {
  login: string;
  id: number;
  node_id: string;
  avatar_url: string;
  gravatar_id: string;
  url: string;
  html_url: string;
  followers_url: string;
  following_url: string;
  gists_url: string;
  starred_url: string;
  subscriptions_url: string;
  organizations_url: string;
  repos_url: string;
  events_url: string;
  received_events_url: string;
  type: string;
  site_admin: boolean;
}

interface PullRequest {
  url: string;
  id: number;
  node_id: string;
  html_url: string;
  diff_url: string;
  patch_url: string;
  issue_url: string;
  number: number;
  state: string;
  locked: boolean;
  title: string;
  user: GitHubUser;
  body: string | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  merged_at: string | null;
  merge_commit_sha: string | null;
  assignee: GitHubUser | null;
  assignees: GitHubUser[];
  requested_reviewers: GitHubUser[];
  requested_teams: any[];
  labels: any[];
  milestone: any | null;
  draft: boolean;
  commits_url: string;
  review_comments_url: string;
  review_comment_url: string;
  comments_url: string;
  statuses_url: string;
  head: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: {
      id: number;
      node_id: string;
      name: string;
      full_name: string;
      private: boolean;
      owner: GitHubUser;
      html_url: string;
      description: string | null;
      url: string;
    }
  };
  base: {
    label: string;
    ref: string;
    sha: string;
    user: GitHubUser;
    repo: {
      id: number;
      node_id: string;
      name: string;
      full_name: string;
      private: boolean;
      owner: GitHubUser;
      html_url: string;
      description: string | null;
      url: string;
    }
  };
  _links: {
    self: { href: string };
    html: { href: string };
    issue: { href: string };
    comments: { href: string };
    review_comments: { href: string };
    review_comment: { href: string };
    commits: { href: string };
    statuses: { href: string };
  };
  author_association: string;
  auto_merge: any | null;
  active_lock_reason: string | null;
  merged: boolean;
  mergeable: boolean | null;
  rebaseable: boolean | null;
  mergeable_state: string;
  merged_by: GitHubUser | null;
  comments: number;
  review_comments: number;
  maintainer_can_modify: boolean;
  commits: number;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface Repository {
  id: number;
  node_id: string;
  name: string;
  full_name: string;
  private: boolean;
  owner: GitHubUser;
  html_url: string;
  description: string | null;
  fork: boolean;
  url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  homepage: string | null;
  size: number;
  stargazers_count: number;
  watchers_count: number;
  language: string | null;
  has_issues: boolean;
  has_projects: boolean;
  has_downloads: boolean;
  has_wiki: boolean;
  has_pages: boolean;
  forks_count: number;
  mirror_url: string | null;
  archived: boolean;
  disabled: boolean;
  open_issues_count: number;
  license: any | null;
  allow_forking: boolean;
  is_template: boolean;
  web_commit_signoff_required: boolean;
  topics: string[];
  visibility: string;
  forks: number;
  open_issues: number;
  watchers: number;
  default_branch: string;
}

interface PullRequestEvent {
  action: string;
  number: number;
  pull_request: PullRequest;
  repository: Repository;
  sender: GitHubUser;
}

interface PullRequestReviewEvent {
  action: string;
  review: {
    id: number;
    node_id: string;
    user: GitHubUser;
    body: string | null;
    commit_id: string;
    submitted_at: string;
    state: string;
    html_url: string;
    pull_request_url: string;
    author_association: string;
    _links: {
      html: { href: string };
      pull_request: { href: string };
    };
  };
  pull_request: PullRequest;
  repository: Repository;
  sender: GitHubUser;
}

// Verify GitHub webhook signature
function verifyGitHubWebhook(req: Request): boolean {
  const signature = req.headers['x-hub-signature-256'];
  const rawBody = (req as any).rawBody;

  if (!signature || !rawBody || typeof signature !== 'string') {
    return false;
  }

  const hmac = crypto.createHmac('sha256', githubConfig.webhookSecret);
  const digest = 'sha256=' + hmac.update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

/**
 * Process payment for a completed bounty
 * Includes retry logic, user verification, and payment confirmation
 */
async function processBountyPayment(bountyId: string, prSubmitterUsername: string, retryCount = 0): Promise<{
  success: boolean;
  signature?: string;
  error?: string;
}> {
  logger.info(`Processing payment for bounty ${bountyId}, attempt ${retryCount + 1}/${MAX_PAYMENT_RETRIES}`);
  
  try {
    // Get full bounty details
    const bounty = await getBounty(bountyId);
    if (!bounty) {
      logger.error(`Bounty ${bountyId} not found for payment processing`);
      return { success: false, error: 'Bounty not found' };
    }
    
    // Verify bounty is in completed status
    if (bounty.status !== 'completed') {
      logger.error(`Cannot process payment for bounty ${bountyId} with status ${bounty.status}`);
      return { success: false, error: `Invalid bounty status: ${bounty.status}` };
    }
    
    // Multi-user claim protection: Verify the PR submitter matches the bounty claimant
    if (!bounty.claimedBy) {
      logger.error(`Bounty ${bountyId} has not been claimed by any user`);
      return { success: false, error: 'Bounty has not been claimed' };
    }
    
    // Get the claimed user to verify GitHub username and get wallet address
    const claimantUser = await getUser(bounty.claimedBy);
    if (!claimantUser) {
      logger.error(`User ${bounty.claimedBy} not found for bounty ${bountyId}`);
      return { success: false, error: 'Claimant user not found' };
    }
    
    // Verify GitHub username matches PR submitter
    // Look for GitHub username in multiple possible locations
    // We need to cast bounty to any to access potential properties that aren't in the strict type
    const bountyData = bounty as any;
    const claimantGithubUsername = claimantUser.githubUsername || 
                                  (bountyData.statusMetadata && bountyData.statusMetadata.githubUsername) ||
                                  bountyData.prSubmitterGithubUsername;
    
    if (!claimantGithubUsername) {
      logger.error(`No GitHub username found for user ${bounty.claimedBy}`);
      return { success: false, error: 'Claimant GitHub username not found' };
    }
    
    if (claimantGithubUsername.toLowerCase() !== prSubmitterUsername.toLowerCase()) {
      logger.error(`GitHub username mismatch: expected ${claimantGithubUsername}, got ${prSubmitterUsername}`);
      return { 
        success: false, 
        error: `GitHub username mismatch: expected ${claimantGithubUsername}, got ${prSubmitterUsername}` 
      };
    }
    
    // Verify wallet address exists
    if (!claimantUser.walletAddress) {
      logger.error(`No wallet address found for user ${bounty.claimedBy}`);
      return { success: false, error: 'Claimant wallet address not found' };
    }
    
    // Update payment status to processing
    await updateBountyPayment(bountyId, {
      status: PaymentStatus.PROCESSING,
      processingStartedAt: new Date().toISOString(),
      attempt: retryCount + 1
    });
    
    // Extract PR URL for the smart contract AutoCompleteBounty instruction
    const prUrl = (bounty as any).prUrl || bounty.claimPR || '';
    if (!prUrl) {
      logger.warn(`No PR URL found for bounty ${bountyId}, proceeding with payment without PR verification`);
    }
    
    // Process payment using Solana service, now with PR URL for auto completion
    const paymentResult = await completeBounty(
      bounty.id, 
      claimantUser.walletAddress,
      prUrl
    );
    
    // Successfully processed payment
    logger.info(`Payment completed for bounty ${bountyId}, signature: ${paymentResult.signature}`);
    
    // Update payment status to completed with transaction signature
    await updateBountyPayment(bountyId, {
      status: PaymentStatus.COMPLETED,
      completedAt: new Date().toISOString(),
      transactionSignature: paymentResult.signature,
    });
    
    // Send notification to user
    await sendPaymentNotification(bounty.claimedBy, bounty, paymentResult.signature);
    
    return {
      success: true,
      signature: paymentResult.signature
    };
  } catch (error: any) {
    logger.error(`Payment processing failed for bounty ${bountyId}:`, error);
    
    // Handle retry logic
    if (retryCount < MAX_PAYMENT_RETRIES - 1) {
      logger.info(`Retrying payment for bounty ${bountyId} (attempt ${retryCount + 1}/${MAX_PAYMENT_RETRIES})`);
      
      // Update payment status to reflect failure but pending retry
      await updateBountyPayment(bountyId, {
        status: PaymentStatus.PENDING,
        failedAt: new Date().toISOString(),
        lastError: error.message || 'Unknown error',
        attempt: retryCount + 1
      });
      
      // Implement exponential backoff for retries
      const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
      logger.info(`Waiting ${backoffTime}ms before retry`);
      
      // Wait for backoff time
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // Retry payment
      return processBountyPayment(bountyId, prSubmitterUsername, retryCount + 1);
    }
    
    // Update payment status to failed after all retries are exhausted
    await updateBountyPayment(bountyId, {
      status: PaymentStatus.FAILED,
      failedAt: new Date().toISOString(),
      lastError: error.message || 'Unknown error',
      attempt: MAX_PAYMENT_RETRIES
    });
    
    // Send failure alert
    await sendPaymentFailureAlert(bountyId, error.message || 'Unknown error');
    
    return {
      success: false,
      error: error.message || 'Unknown error during payment processing'
    };
  }
}

/**
 * Send payment notification to user
 */
async function sendPaymentNotification(userId: string, bounty: any, transactionSignature: string): Promise<void> {
  try {
    logger.info(`Sending payment notification to user ${userId} for bounty ${bounty.id}`);
    
    // For now, just log the notification
    // You would implement your actual notification mechanism here (email, in-app, etc.)
    logger.info(`NOTIFICATION: Payment of ${bounty.amount} ${bounty.tokenMint || 'SOL'} for bounty "${bounty.title}" has been processed. Transaction signature: ${transactionSignature}`);
    
    // Update bounty with notification status
    await updateBountyPayment(bounty.id, {
      notificationSent: true,
      notificationSentAt: new Date().toISOString()
    });
  } catch (error) {
    logger.error(`Error sending payment notification to user ${userId}:`, error);
  }
}

/**
 * Send payment failure alert to admins
 */
async function sendPaymentFailureAlert(bountyId: string, errorMessage: string): Promise<void> {
  try {
    logger.info(`Sending payment failure alert for bounty ${bountyId}`);
    
    // For now, just log the alert
    // You would implement your actual alerting mechanism here (email, Slack, etc.)
    logger.error(`ADMIN ALERT: Payment failed for bounty ${bountyId}: ${errorMessage}`);
  } catch (error) {
    logger.error(`Error sending payment failure alert:`, error);
  }
}

/**
 * Handle pull request events from GitHub
 */
async function handlePullRequestEvent(payload: PullRequestEvent) {
  logger.info("Handling pull request event...");
  logger.info(`Action: ${payload.action}`);
  logger.info(`PR URL: ${payload.pull_request.html_url}`);
  
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
            mergedBy: payload.pull_request.merged_by?.login,
            prUrl: payload.pull_request.html_url
          };
          
          // Log PR and issue information for debugging
          logger.info(`PR Details - Number: ${payload.pull_request.number}, Title: ${payload.pull_request.title}`);
          logger.info(`PR Body: ${payload.pull_request.body || 'No body'}`);
          logger.info(`PR Issue URL: ${payload.pull_request.issue_url}`);
          
          // Update status to completed first
          logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
          await updateBountyStatus(bounty.id, newStatus, metadata);
          
          // Initialize payment tracking
          await updateBountyPayment(bounty.id, {
            status: PaymentStatus.PENDING,
            createdAt: new Date().toISOString(),
            prMergedAt: payload.pull_request.merged_at,
            prMergedBy: payload.pull_request.merged_by?.login,
            prUrl: payload.pull_request.html_url
          });
          
          // Then attempt to process payment with auto-completion via smart contract
          logger.info(`Initiating automated payment processing for bounty ${bounty.id}`);
          const paymentResult = await processBountyPayment(bounty.id, payload.pull_request.user.login);
          
          if (paymentResult.success) {
            logger.info(`Payment successful for bounty ${bounty.id}`);
            // Update metadata with payment info
            await updateBountyStatus(bounty.id, newStatus, {
              ...metadata,
              paymentCompleted: true,
              paymentCompletedAt: new Date().toISOString(),
              paymentMethod: 'auto',
              transactionSignature: paymentResult.signature
            });
          } else {
            logger.error(`Automatic payment processing failed for bounty ${bounty.id}: ${paymentResult.error}`);
            // Status was already updated, just log the error
          }
          
          // Return early since we've already updated status
          return;
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
async function handlePullRequestReviewEvent(payload: PullRequestReviewEvent) {
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

// Main webhook handler function
export const githubWebhookHandler = onRequest(async (req: Request, res: Response) => {
  // Verify webhook signature
  if (!verifyGitHubWebhook(req)) {
    logger.error('Invalid webhook signature');
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  const event = req.headers['x-github-event'];
  const payload = req.body;

  // Log event details if verbose logging is enabled
  if (loggingConfig.verbose) {
    logger.info('Received webhook event:', { event, payload });
  }

  try {
    switch (event) {
      case 'ping':
        res.status(200).json({ message: 'Webhook configured successfully' });
        return;

      case 'pull_request':
        const prUrl = payload.pull_request.html_url;
        const bounty = await getBountyByPR(prUrl);
        
        if (!bounty) {
          res.status(400).json({ error: 'No bounty found for this PR' });
          return;
        }

        if (payload.action === 'closed' && payload.pull_request.merged) {
          // PR was merged, update bounty status to completed
          await updateBountyStatus(bounty.id, 'completed');
          res.status(200).json({ message: 'Bounty completed' });
          return;
        } else if (payload.action === 'opened') {
          // New PR opened, update bounty status to in_progress
          await updateBountyStatus(bounty.id, 'in_progress');
          res.status(200).json({ message: 'Bounty status updated to in_progress' });
          return;
        }
        break;

      case 'pull_request_review':
        logger.info('Processing pull request review event');
        await handlePullRequestReviewEvent(payload as PullRequestReviewEvent);
        res.status(200).json({ message: 'Event processed' });
        return;

      default:
        res.status(400).json({ error: 'Unsupported event type' });
        return;
    }
  } catch (error) {
    logger.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Function to handle new pull requests and associate them with bounties
async function handleNewPullRequest(pullRequest: PullRequest, repository: Repository): Promise<void> {
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
    logger.info('Test endpoint hit, headers:', JSON.stringify(request.headers));
    response.status(200).json({
      message: 'Webhook test endpoint working correctly',
      timestamp: new Date().toISOString(),
      headers: request.headers
    });
  }
);

/**
 * Updates a bounty status based on the pull request URL
 */
/* 
async function updateBountyStatusForPR(
  prUrl: string,
  status: BountyStatus,
  metadata?: Record<string, any>
) {
  try {
    const bounty = await getBountyByPR(prUrl);
    if (bounty) {
      logger.info(`Updating bounty ${bounty.id} status to ${status}`);
      await updateBountyStatus(bounty.id, status, metadata);
    } else {
      logger.error(`No bounty found for PR: ${prUrl}`);
    }
  } catch (error) {
    logger.error('Error updating bounty status for PR:', error);
  }
} 
*/ 