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
exports.githubAppWebhookTest = exports.githubAppWebhookHandler = void 0;
const https_1 = require("firebase-functions/v2/https");
const firebase_functions_1 = require("firebase-functions");
const crypto = __importStar(require("crypto"));
const functions = __importStar(require("firebase-functions"));
const firestore_1 = require("../services/firestore");
/**
 * Helper function to safely access configuration properties
 */
function getConfigSafely(path, defaultValue = null) {
    try {
        const parts = path.split('.');
        let current = functions.config() || {};
        for (const part of parts) {
            if (current === undefined || current === null || typeof current !== 'object') {
                return defaultValue;
            }
            current = current[part];
        }
        return current !== undefined ? current : defaultValue;
    }
    catch (error) {
        firebase_functions_1.logger.warn(`Error accessing config path ${path}:`, error);
        return defaultValue;
    }
}
// Get the GitHub App webhook secret from Firebase config or environment variables
const GITHUB_APP_WEBHOOK_SECRET = getConfigSafely('github.app_webhook_secret') || process.env.GITHUB_APP_WEBHOOK_SECRET || process.env.APP_WEBHOOK_SECRET;
// Use a dummy webhook secret for local development if not configured
if (!GITHUB_APP_WEBHOOK_SECRET) {
    firebase_functions_1.logger.warn("GitHub webhook secret not properly configured. Using fallback for local development.");
    firebase_functions_1.logger.warn("Set proper secrets before deploying to production.");
}
/**
 * Verify that the webhook is from GitHub by checking the signature
 */
function verifyGitHubWebhook(signature, signatureSha256, rawBody) {
    firebase_functions_1.logger.info("Verifying GitHub webhook signature...");
    // If no signature provided, verification fails
    if (!signature && !signatureSha256) {
        firebase_functions_1.logger.error("No signature provided in the request");
        return false;
    }
    try {
        const webhookSecret = GITHUB_APP_WEBHOOK_SECRET || "dummy-secret-for-local-development-only";
        if (!webhookSecret) {
            firebase_functions_1.logger.error("No webhook secret configured");
            return false;
        }
        // Convert rawBody to string if it's a Buffer
        const payloadString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody;
        // Try SHA-256 signature first (preferred)
        if (signatureSha256) {
            firebase_functions_1.logger.info(`Received SHA-256 signature: ${signatureSha256}`);
            const [algorithm, signatureValue] = signatureSha256.split('=');
            if (!algorithm || !signatureValue) {
                firebase_functions_1.logger.error("Invalid SHA-256 signature format");
                return false;
            }
            const hmac = crypto.createHmac('sha256', webhookSecret);
            hmac.update(payloadString);
            const digest = hmac.digest('hex');
            try {
                const result = crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signatureValue, 'hex'));
                firebase_functions_1.logger.info(`SHA-256 signature verification result: ${result}`);
                if (result)
                    return true;
            }
            catch (err) {
                firebase_functions_1.logger.error("Error comparing SHA-256 signatures:", err);
            }
        }
        // Fall back to SHA-1 signature if SHA-256 fails or isn't provided
        if (signature) {
            firebase_functions_1.logger.info(`Received SHA-1 signature: ${signature}`);
            const [algorithm, signatureValue] = signature.split('=');
            if (!algorithm || !signatureValue) {
                firebase_functions_1.logger.error("Invalid SHA-1 signature format");
                return false;
            }
            const hmac = crypto.createHmac('sha1', webhookSecret);
            hmac.update(payloadString);
            const digest = hmac.digest('hex');
            try {
                const result = crypto.timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(signatureValue, 'hex'));
                firebase_functions_1.logger.info(`SHA-1 signature verification result: ${result}`);
                return result;
            }
            catch (err) {
                firebase_functions_1.logger.error("Error comparing SHA-1 signatures:", err);
                return false;
            }
        }
        return false;
    }
    catch (error) {
        firebase_functions_1.logger.error("Error verifying webhook signature:", error);
        return false;
    }
}
/**
 * Handle pull request events from GitHub
 */
async function handlePullRequestEvent(payload) {
    firebase_functions_1.logger.info("Handling pull request event...");
    firebase_functions_1.logger.info(`Action: ${payload.action}`);
    firebase_functions_1.logger.info(`PR URL: ${payload.pull_request.html_url}`);
    firebase_functions_1.logger.info(`Repository: ${payload.repository.html_url}`);
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
                        mergedBy: payload.pull_request.merged_by?.login
                    };
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
/**
 * Handle issue events from GitHub
 */
async function handleIssueEvent(payload) {
    firebase_functions_1.logger.info("Handling issue event...");
    firebase_functions_1.logger.info(`Action: ${payload.action}`);
    firebase_functions_1.logger.info(`Issue URL: ${payload.issue.html_url}`);
    try {
        // Find the bounty associated with this issue
        const bounty = await (0, firestore_1.getBountyByIssueUrl)(payload.issue.html_url);
        if (!bounty) {
            firebase_functions_1.logger.info("No bounty found for this issue");
            return;
        }
        let newStatus = null;
        let metadata = {};
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
                if (bounty.status === 'cancelled') {
                    newStatus = 'open';
                    metadata = {
                        reopenedAt: new Date().toISOString(),
                        reopenedBy: payload.sender.login
                    };
                }
                break;
            default:
                firebase_functions_1.logger.info(`Issue action ${payload.action} doesn't require a bounty status update`);
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
        firebase_functions_1.logger.error("Error handling issue event:", error);
    }
}
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
// Main GitHub App webhook handler
exports.githubAppWebhookHandler = (0, https_1.onRequest)({
    maxInstances: 10,
    timeoutSeconds: 60,
    region: 'us-central1'
}, async (req, res) => {
    firebase_functions_1.logger.info('Received GitHub App webhook request', {
        method: req.method,
        path: req.path,
        eventType: req.headers['x-github-event']
    });
    // Log all headers for debugging
    firebase_functions_1.logger.debug('Request headers:', req.headers);
    // Only allow POST requests
    if (req.method !== 'POST') {
        firebase_functions_1.logger.warn(`Invalid method: ${req.method}`);
        res.status(405).send('Method Not Allowed');
        return;
    }
    const event = req.headers['x-github-event'];
    firebase_functions_1.logger.info(`Received GitHub event: ${event}`);
    // Handle ping event (sent when app is installed)
    if (event === 'ping') {
        firebase_functions_1.logger.info('Received ping event');
        res.status(200).send('Pong!');
        return;
    }
    // Get signatures from headers
    const signature = req.headers['x-hub-signature'];
    const signatureSha256 = req.headers['x-hub-signature-256'];
    if (!signature && !signatureSha256) {
        firebase_functions_1.logger.error('No signature found in headers');
        res.status(401).send('No signature provided');
        return;
    }
    // Determine what to use for verification
    let bodyToVerify;
    if (req.rawBody) {
        // Use rawBody if available (preferred)
        bodyToVerify = req.rawBody;
        firebase_functions_1.logger.info('Using raw request body for verification');
    }
    else {
        // Fall back to stringified body if rawBody not available
        bodyToVerify = JSON.stringify(req.body);
        firebase_functions_1.logger.warn('Raw body not available, using JSON.stringify(req.body) as fallback (less reliable)');
    }
    // Verify the signature against the body
    const isValidSignature = verifyGitHubWebhook(signature, signatureSha256, bodyToVerify);
    if (!isValidSignature) {
        firebase_functions_1.logger.error('Invalid signature');
        res.status(401).send('Invalid signature');
        return;
    }
    firebase_functions_1.logger.info('Signature verified, processing webhook');
    try {
        // Process different event types
        switch (event) {
            case 'pull_request':
                firebase_functions_1.logger.info('Processing pull request event');
                await handlePullRequestEvent(req.body);
                break;
            case 'pull_request_review':
                firebase_functions_1.logger.info('Processing pull request review event');
                await handlePullRequestReviewEvent(req.body);
                break;
            case 'issues':
                firebase_functions_1.logger.info('Processing issue event');
                await handleIssueEvent(req.body);
                break;
            case 'installation':
            case 'installation_repositories':
                firebase_functions_1.logger.info(`Received ${event} event`);
                // Handle app installation events if needed
                break;
            default:
                firebase_functions_1.logger.info(`Received unhandled event type: ${event}`);
                break;
        }
        // Default success response
        res.status(200).send('Webhook processed successfully');
    }
    catch (error) {
        firebase_functions_1.logger.error('Error processing webhook:', error);
        res.status(500).send('Error processing webhook');
    }
});
// Add a test endpoint for the GitHub App webhook
exports.githubAppWebhookTest = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    minInstances: 0,
    maxInstances: 10,
    invoker: 'public'
}, async (req, res) => {
    firebase_functions_1.logger.info('GitHub App webhook test endpoint hit, headers:', JSON.stringify(req.headers));
    res.status(200).json({
        message: 'GitHub App webhook test endpoint working correctly',
        timestamp: new Date().toISOString(),
        headers: req.headers
    });
});
//# sourceMappingURL=github-app-webhooks.js.map