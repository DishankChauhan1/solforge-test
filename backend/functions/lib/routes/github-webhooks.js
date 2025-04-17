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
exports.webhookTest = exports.githubWebhookHandler = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const crypto = __importStar(require("crypto"));
const firestore_1 = require("../services/firestore");
const solana_1 = require("../services/solana");
const config_1 = require("../config");
// import * as functions from 'firebase-functions';
// import { defineString, defineSecret } from 'firebase-functions/params';
// Replace hardcoded values with config
const config = (0, config_1.getConfig)();
const githubConfig = (0, config_1.getGitHubConfig)();
const loggingConfig = (0, config_1.getLoggingConfig)();
// Update logging configuration
if (loggingConfig.verbose) {
    // Firebase logger doesn't have a 'level' property, so use info to indicate verbose mode is on
    firebase_functions_1.logger.info('Verbose logging enabled');
    // When verbose is true, we'll log additional details throughout the code
}
// Maximum number of payment retry attempts
const MAX_PAYMENT_RETRIES = 3;
// Payment status tracking (defined as enum values rather than just type)
var PaymentStatus;
(function (PaymentStatus) {
    PaymentStatus["PENDING"] = "pending";
    PaymentStatus["PROCESSING"] = "processing";
    PaymentStatus["COMPLETED"] = "completed";
    PaymentStatus["FAILED"] = "failed";
})(PaymentStatus || (PaymentStatus = {}));
// Verify GitHub webhook signature
function verifyGitHubWebhook(req) {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody;
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
async function processBountyPayment(bountyId, prSubmitterUsername, retryCount = 0) {
    firebase_functions_1.logger.info(`Processing payment for bounty ${bountyId}, attempt ${retryCount + 1}/${MAX_PAYMENT_RETRIES}`);
    try {
        // Get full bounty details
        const bounty = await (0, firestore_1.getBounty)(bountyId);
        if (!bounty) {
            firebase_functions_1.logger.error(`Bounty ${bountyId} not found for payment processing`);
            return { success: false, error: 'Bounty not found' };
        }
        // Verify bounty is in completed status
        if (bounty.status !== 'completed') {
            firebase_functions_1.logger.error(`Cannot process payment for bounty ${bountyId} with status ${bounty.status}`);
            return { success: false, error: `Invalid bounty status: ${bounty.status}` };
        }
        // Multi-user claim protection: Verify the PR submitter matches the bounty claimant
        if (!bounty.claimedBy) {
            firebase_functions_1.logger.error(`Bounty ${bountyId} has not been claimed by any user`);
            return { success: false, error: 'Bounty has not been claimed' };
        }
        // Get the claimed user to verify GitHub username and get wallet address
        const claimantUser = await (0, firestore_1.getUser)(bounty.claimedBy);
        if (!claimantUser) {
            firebase_functions_1.logger.error(`User ${bounty.claimedBy} not found for bounty ${bountyId}`);
            return { success: false, error: 'Claimant user not found' };
        }
        // Verify GitHub username matches PR submitter
        // Look for GitHub username in multiple possible locations
        // We need to cast bounty to any to access potential properties that aren't in the strict type
        const bountyData = bounty;
        const claimantGithubUsername = claimantUser.githubUsername ||
            (bountyData.statusMetadata && bountyData.statusMetadata.githubUsername) ||
            bountyData.prSubmitterGithubUsername;
        if (!claimantGithubUsername) {
            firebase_functions_1.logger.error(`No GitHub username found for user ${bounty.claimedBy}`);
            return { success: false, error: 'Claimant GitHub username not found' };
        }
        if (claimantGithubUsername.toLowerCase() !== prSubmitterUsername.toLowerCase()) {
            firebase_functions_1.logger.error(`GitHub username mismatch: expected ${claimantGithubUsername}, got ${prSubmitterUsername}`);
            return {
                success: false,
                error: `GitHub username mismatch: expected ${claimantGithubUsername}, got ${prSubmitterUsername}`
            };
        }
        // Verify wallet address exists
        if (!claimantUser.walletAddress) {
            firebase_functions_1.logger.error(`No wallet address found for user ${bounty.claimedBy}`);
            return { success: false, error: 'Claimant wallet address not found' };
        }
        // Update payment status to processing
        await (0, firestore_1.updateBountyPayment)(bountyId, {
            status: PaymentStatus.PROCESSING,
            processingStartedAt: new Date().toISOString(),
            attempt: retryCount + 1
        });
        // Extract PR URL for the smart contract AutoCompleteBounty instruction
        const prUrl = bounty.prUrl || bounty.claimPR || '';
        if (!prUrl) {
            firebase_functions_1.logger.warn(`No PR URL found for bounty ${bountyId}, proceeding with payment without PR verification`);
        }
        // Process payment using Solana service, now with PR URL for auto completion
        const paymentResult = await (0, solana_1.completeBounty)(bounty.id, claimantUser.walletAddress, prUrl);
        // Successfully processed payment
        firebase_functions_1.logger.info(`Payment completed for bounty ${bountyId}, signature: ${paymentResult.signature}`);
        // Update payment status to completed with transaction signature
        await (0, firestore_1.updateBountyPayment)(bountyId, {
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
    }
    catch (error) {
        firebase_functions_1.logger.error(`Payment processing failed for bounty ${bountyId}:`, error);
        // Handle retry logic
        if (retryCount < MAX_PAYMENT_RETRIES - 1) {
            firebase_functions_1.logger.info(`Retrying payment for bounty ${bountyId} (attempt ${retryCount + 1}/${MAX_PAYMENT_RETRIES})`);
            // Update payment status to reflect failure but pending retry
            await (0, firestore_1.updateBountyPayment)(bountyId, {
                status: PaymentStatus.PENDING,
                failedAt: new Date().toISOString(),
                lastError: error.message || 'Unknown error',
                attempt: retryCount + 1
            });
            // Implement exponential backoff for retries
            const backoffTime = Math.pow(2, retryCount) * 1000; // Exponential backoff
            firebase_functions_1.logger.info(`Waiting ${backoffTime}ms before retry`);
            // Wait for backoff time
            await new Promise(resolve => setTimeout(resolve, backoffTime));
            // Retry payment
            return processBountyPayment(bountyId, prSubmitterUsername, retryCount + 1);
        }
        // Update payment status to failed after all retries are exhausted
        await (0, firestore_1.updateBountyPayment)(bountyId, {
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
async function sendPaymentNotification(userId, bounty, transactionSignature) {
    try {
        firebase_functions_1.logger.info(`Sending payment notification to user ${userId} for bounty ${bounty.id}`);
        // For now, just log the notification
        // You would implement your actual notification mechanism here (email, in-app, etc.)
        firebase_functions_1.logger.info(`NOTIFICATION: Payment of ${bounty.amount} ${bounty.tokenMint || 'SOL'} for bounty "${bounty.title}" has been processed. Transaction signature: ${transactionSignature}`);
        // Update bounty with notification status
        await (0, firestore_1.updateBountyPayment)(bounty.id, {
            notificationSent: true,
            notificationSentAt: new Date().toISOString()
        });
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error sending payment notification to user ${userId}:`, error);
    }
}
/**
 * Send payment failure alert to admins
 */
async function sendPaymentFailureAlert(bountyId, errorMessage) {
    try {
        firebase_functions_1.logger.info(`Sending payment failure alert for bounty ${bountyId}`);
        // For now, just log the alert
        // You would implement your actual alerting mechanism here (email, Slack, etc.)
        firebase_functions_1.logger.error(`ADMIN ALERT: Payment failed for bounty ${bountyId}: ${errorMessage}`);
    }
    catch (error) {
        firebase_functions_1.logger.error(`Error sending payment failure alert:`, error);
    }
}
/**
 * Handle pull request events from GitHub
 */
async function handlePullRequestEvent(payload) {
    firebase_functions_1.logger.info("Handling pull request event...");
    firebase_functions_1.logger.info(`Action: ${payload.action}`);
    firebase_functions_1.logger.info(`PR URL: ${payload.pull_request.html_url}`);
    try {
        // First try to find a bounty by the PR URL
        const bounty = await (0, firestore_1.getBountyByPR)(payload.pull_request.html_url);
        if (!bounty) {
            firebase_functions_1.logger.info("No bounty found for this PR, checking if this is a new PR...");
            // This could be a new PR, try to associate it with a bounty
            await handleNewPullRequest(payload.pull_request, payload.repository);
            return;
        }
        let newStatus = null;
        let metadata = {};
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
                    firebase_functions_1.logger.info(`PR Details - Number: ${payload.pull_request.number}, Title: ${payload.pull_request.title}`);
                    firebase_functions_1.logger.info(`PR Body: ${payload.pull_request.body || 'No body'}`);
                    firebase_functions_1.logger.info(`PR Issue URL: ${payload.pull_request.issue_url}`);
                    // Update status to completed first
                    firebase_functions_1.logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
                    await (0, firestore_1.updateBountyStatus)(bounty.id, newStatus, metadata);
                    // Initialize payment tracking
                    await (0, firestore_1.updateBountyPayment)(bounty.id, {
                        status: PaymentStatus.PENDING,
                        createdAt: new Date().toISOString(),
                        prMergedAt: payload.pull_request.merged_at,
                        prMergedBy: payload.pull_request.merged_by?.login,
                        prUrl: payload.pull_request.html_url
                    });
                    // Then attempt to process payment with auto-completion via smart contract
                    firebase_functions_1.logger.info(`Initiating automated payment processing for bounty ${bounty.id}`);
                    const paymentResult = await processBountyPayment(bounty.id, payload.pull_request.user.login);
                    if (paymentResult.success) {
                        firebase_functions_1.logger.info(`Payment successful for bounty ${bounty.id}`);
                        // Update metadata with payment info
                        await (0, firestore_1.updateBountyStatus)(bounty.id, newStatus, {
                            ...metadata,
                            paymentCompleted: true,
                            paymentCompletedAt: new Date().toISOString(),
                            paymentMethod: 'auto',
                            transactionSignature: paymentResult.signature
                        });
                    }
                    else {
                        firebase_functions_1.logger.error(`Automatic payment processing failed for bounty ${bounty.id}: ${paymentResult.error}`);
                        // Status was already updated, just log the error
                    }
                    // Return early since we've already updated status
                    return;
                }
                else {
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
                firebase_functions_1.logger.info(`PR action ${payload.action} doesn't require a bounty status update`);
                break;
        }
        // Update the bounty status if needed
        if (newStatus) {
            firebase_functions_1.logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
            await (0, firestore_1.updateBountyStatus)(bounty.id, newStatus, metadata);
            firebase_functions_1.logger.info("Bounty status updated successfully");
        }
    }
    catch (error) {
        firebase_functions_1.logger.error("Error handling pull request event:", error);
    }
}
/**
 * Handle pull request review events from GitHub
 */
async function handlePullRequestReviewEvent(payload) {
    firebase_functions_1.logger.info("Handling pull request review event...");
    firebase_functions_1.logger.info(`Action: ${payload.action}`);
    firebase_functions_1.logger.info(`Review state: ${payload.review.state}`);
    firebase_functions_1.logger.info(`PR URL: ${payload.pull_request.html_url}`);
    try {
        // Find the bounty associated with this PR
        const bounty = await (0, firestore_1.getBountyByPR)(payload.pull_request.html_url);
        if (!bounty) {
            firebase_functions_1.logger.info("No bounty found for this PR review");
            return;
        }
        // Only process submitted reviews
        if (payload.action !== 'submitted') {
            firebase_functions_1.logger.info(`Review action ${payload.action} doesn't require a bounty status update`);
            return;
        }
        let newStatus = null;
        let metadata = {};
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
                firebase_functions_1.logger.info("Review is just a comment, no status change needed");
                break;
            default:
                firebase_functions_1.logger.info(`Review state ${payload.review.state} doesn't require a bounty status update`);
                break;
        }
        // Update the bounty status if needed
        if (newStatus) {
            firebase_functions_1.logger.info(`Updating bounty ${bounty.id} status to ${newStatus}`);
            await (0, firestore_1.updateBountyStatus)(bounty.id, newStatus, metadata);
            firebase_functions_1.logger.info("Bounty status updated successfully");
        }
    }
    catch (error) {
        firebase_functions_1.logger.error("Error handling pull request review event:", error);
    }
}
// Main webhook handler function
exports.githubWebhookHandler = (0, https_1.onRequest)(async (req, res) => {
    // Verify webhook signature
    if (!verifyGitHubWebhook(req)) {
        firebase_functions_1.logger.error('Invalid webhook signature');
        res.status(401).json({ error: 'Invalid signature' });
        return;
    }
    const event = req.headers['x-github-event'];
    const payload = req.body;
    // Log event details if verbose logging is enabled
    if (loggingConfig.verbose) {
        firebase_functions_1.logger.info('Received webhook event:', { event, payload });
    }
    try {
        switch (event) {
            case 'ping':
                res.status(200).json({ message: 'Webhook configured successfully' });
                return;
            case 'pull_request':
                const prUrl = payload.pull_request.html_url;
                const bounty = await (0, firestore_1.getBountyByPR)(prUrl);
                if (!bounty) {
                    res.status(400).json({ error: 'No bounty found for this PR' });
                    return;
                }
                if (payload.action === 'closed' && payload.pull_request.merged) {
                    // PR was merged, update bounty status to completed
                    await (0, firestore_1.updateBountyStatus)(bounty.id, 'completed');
                    res.status(200).json({ message: 'Bounty completed' });
                    return;
                }
                else if (payload.action === 'opened') {
                    // New PR opened, update bounty status to in_progress
                    await (0, firestore_1.updateBountyStatus)(bounty.id, 'in_progress');
                    res.status(200).json({ message: 'Bounty status updated to in_progress' });
                    return;
                }
                break;
            case 'pull_request_review':
                firebase_functions_1.logger.info('Processing pull request review event');
                await handlePullRequestReviewEvent(payload);
                res.status(200).json({ message: 'Event processed' });
                return;
            default:
                res.status(400).json({ error: 'Unsupported event type' });
                return;
        }
    }
    catch (error) {
        firebase_functions_1.logger.error('Error processing webhook:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Function to handle new pull requests and associate them with bounties
async function handleNewPullRequest(pullRequest, repository) {
    // Strategy 1: Check PR body for issue URL references (common format: "Fixes #123" or "Closes #123")
    let issueNumber = null;
    if (pullRequest.body) {
        // Look for issue references in the PR body
        const issueRefs = pullRequest.body.match(/(?:fixes|closes|resolves)\s+#(\d+)/i);
        if (issueRefs && issueRefs[1]) {
            issueNumber = parseInt(issueRefs[1], 10);
            firebase_functions_1.logger.info(`Found issue reference in PR body: #${issueNumber}`);
        }
    }
    // Also check PR title for issue references
    if (!issueNumber) {
        const titleRefs = pullRequest.title.match(/#(\d+)/);
        if (titleRefs && titleRefs[1]) {
            issueNumber = parseInt(titleRefs[1], 10);
            firebase_functions_1.logger.info(`Found issue reference in PR title: #${issueNumber}`);
        }
    }
    // Store the GitHub username from the PR for later verification
    const githubUsername = pullRequest.user.login;
    firebase_functions_1.logger.info(`PR created by GitHub user: ${githubUsername}`);
    // If we found an issue number, construct the issue URL
    if (issueNumber) {
        const repoFullName = repository.full_name;
        const issueUrl = `https://github.com/${repoFullName}/issues/${issueNumber}`;
        firebase_functions_1.logger.info(`Looking for bounty with issue URL: ${issueUrl}`);
        // Try to find a bounty by issue URL
        const bounty = await (0, firestore_1.getBountyByIssueUrl)(issueUrl);
        if (bounty) {
            firebase_functions_1.logger.info(`Found bounty ${bounty.id} for issue #${issueNumber}`);
            // Update the bounty with PR information and the GitHub username
            await (0, firestore_1.updateBountyWithPR)(bounty.id, pullRequest.html_url, githubUsername);
            await (0, firestore_1.updateBountyStatus)(bounty.id, 'in_progress', {
                prSubmittedAt: new Date().toISOString(),
                prNumber: pullRequest.number,
                githubUsername: githubUsername
            });
            firebase_functions_1.logger.info(`Updated bounty ${bounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
        }
    }
    // Strategy 2: If no issue found, try to match by repository URL
    const repoUrl = repository.html_url;
    firebase_functions_1.logger.info(`No issue match found. Checking for bounties in repository: ${repoUrl}`);
    // Get all bounties associated with this repository
    const repoBounties = await (0, firestore_1.getBountyByRepo)(repoUrl);
    if (repoBounties && repoBounties.length > 0) {
        firebase_functions_1.logger.info(`Found ${repoBounties.length} bounties in this repository`);
        // For now, just use the first open bounty in the repo (could be enhanced with more logic)
        const openBounty = repoBounties.find(b => b.status === 'open');
        if (openBounty) {
            firebase_functions_1.logger.info(`Found open bounty ${openBounty.id} in repository`);
            // Update the bounty with PR information and the GitHub username
            await (0, firestore_1.updateBountyWithPR)(openBounty.id, pullRequest.html_url, githubUsername);
            await (0, firestore_1.updateBountyStatus)(openBounty.id, 'in_progress', {
                prSubmittedAt: new Date().toISOString(),
                prNumber: pullRequest.number,
                githubUsername: githubUsername
            });
            firebase_functions_1.logger.info(`Updated bounty ${openBounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
        }
        else {
            firebase_functions_1.logger.info('No open bounties found in this repository');
        }
    }
    else {
        firebase_functions_1.logger.info('No bounties found for this repository');
    }
}
// Add a test endpoint
exports.webhookTest = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    invoker: 'public'
}, async (request, response) => {
    firebase_functions_1.logger.info('Test endpoint hit, headers:', JSON.stringify(request.headers));
    response.status(200).json({
        message: 'Webhook test endpoint working correctly',
        timestamp: new Date().toISOString(),
        headers: request.headers
    });
});
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
//# sourceMappingURL=github-webhooks.js.map