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
const crypto = __importStar(require("crypto"));
const firestore_1 = require("../services/firestore");
const solana_1 = require("../services/solana");
// Hardcoded secret for development - the same as what's in Firebase config
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';
// Verify GitHub webhook signature
function verifyGitHubWebhook(payload, signature) {
    try {
        // For debugging purposes only
        console.log(`Verifying signature: ${signature.substring(0, 20)}...`);
        // Determine which algorithm is being used
        let algorithm;
        let signatureHash;
        if (signature.startsWith('sha256=')) {
            algorithm = 'sha256';
            signatureHash = signature.slice('sha256='.length);
        }
        else if (signature.startsWith('sha1=')) {
            algorithm = 'sha1';
            signatureHash = signature.slice('sha1='.length);
        }
        else {
            console.error('Unsupported signature format:', signature);
            return false;
        }
        // Create the HMAC with the correct algorithm
        const hmac = crypto.createHmac(algorithm, WEBHOOK_SECRET);
        const digest = hmac.update(payload).digest('hex');
        // Use a constant-time comparison to prevent timing attacks
        try {
            return crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(digest, 'hex'));
        }
        catch (error) {
            console.error('Error in signature comparison:', error);
            // Basic string comparison as fallback (not secure but better than nothing)
            const match = digest === signatureHash;
            console.log(`Fallback signature comparison result: ${match ? 'matched' : 'failed'}`);
            return match;
        }
    }
    catch (error) {
        console.error('Error verifying webhook signature:', error);
        return false;
    }
}
exports.githubWebhookHandler = (0, https_1.onRequest)({
    cors: true,
    region: 'us-central1',
    minInstances: 0,
    timeoutSeconds: 300,
    maxInstances: 10,
    invoker: 'public'
}, async (request, response) => {
    var _a;
    console.log('Received webhook request');
    try {
        const event = request.headers['x-github-event'];
        const payload = request.body;
        const signature = request.headers['x-hub-signature-256'] ||
            request.headers['x-hub-signature'];
        // Only log header names in production, not values
        console.log('Headers received:', Object.keys(request.headers).join(', '));
        console.log('Event type:', event);
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
        // Verify the payload signature
        const isValid = verifyGitHubWebhook(rawPayload, signature);
        if (!isValid) {
            console.error('Invalid signature');
            response.status(401).send('Invalid signature');
            return;
        }
        // Handle ping events
        if (event === 'ping') {
            console.log('Received ping event from GitHub');
            response.status(200).send('Webhook ping received successfully');
            return;
        }
        // Handle push events (not directly processed but logged)
        if (event === 'push') {
            console.log('Received push event');
            response.status(200).send('Webhook received successfully');
            return;
        }
        // Handle pull request events
        if (event === 'pull_request') {
            console.log('Received pull request event');
            try {
                await handlePullRequestEvent(payload);
            }
            catch (error) {
                console.error('Error handling pull request event:', error);
                // Log detailed error information for debugging
                const errorDetails = {
                    eventType: 'pull_request',
                    action: payload === null || payload === void 0 ? void 0 : payload.action,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    timestamp: new Date().toISOString()
                };
                console.error('Pull request processing error details:', JSON.stringify(errorDetails));
                // We don't want to fail the overall webhook if just one handler fails
                // This ensures GitHub keeps sending webhooks and other handlers can still process
                // The error is properly logged for investigation
                // In a production environment, you could add additional error handling here:
                // - Queue failed events for retry
                // - Send alerts to monitoring systems
                // - Track error metrics
            }
        }
        // Handle pull request review events
        if (event === 'pull_request_review') {
            console.log('Received pull request review event');
            try {
                await handlePullRequestReviewEvent(payload);
            }
            catch (error) {
                console.error('Error handling pull request review event:', error);
                // Log detailed error information for debugging
                const errorDetails = {
                    eventType: 'pull_request_review',
                    action: payload === null || payload === void 0 ? void 0 : payload.action,
                    reviewState: (_a = payload === null || payload === void 0 ? void 0 : payload.review) === null || _a === void 0 ? void 0 : _a.state,
                    error: error instanceof Error ? error.message : String(error),
                    stack: error instanceof Error ? error.stack : undefined,
                    timestamp: new Date().toISOString()
                };
                console.error('Pull request review processing error details:', JSON.stringify(errorDetails));
                // Same error handling strategy as above
                // Critical failures should be monitored and addressed quickly
            }
        }
        response.status(200).send('Webhook received successfully');
    }
    catch (error) {
        console.error('Unexpected error processing webhook:', error);
        // This is a critical error in the webhook processing infrastructure
        // Log detailed error information for immediate investigation
        const criticalErrorDetails = {
            eventType: request.headers['x-github-event'],
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString()
        };
        console.error('CRITICAL WEBHOOK ERROR:', JSON.stringify(criticalErrorDetails));
        // In production, you would implement:
        // 1. Error alerting to your monitoring system
        // 2. Potentially storing the raw event for reprocessing
        // 3. Metrics tracking for SLA monitoring
        // Still return 200 to GitHub to prevent webhook deactivation
        // But include an error code in the response
        response.status(200).send('Webhook received but encountered processing errors');
    }
});
async function handlePullRequestEvent(payload) {
    const { action, pull_request, repository } = payload;
    const prUrl = pull_request.html_url;
    console.log(`Processing ${action} action for PR: ${prUrl}`);
    // Handle PR opening - this is when we need to associate it with a bounty
    if (action === 'opened') {
        console.log('New PR opened, attempting to associate with a bounty');
        await handleNewPullRequest(pull_request, repository);
        return;
    }
    // For other actions, get bounty already associated with this PR
    const bounty = await (0, firestore_1.getBountyByPR)(prUrl);
    if (!bounty) {
        console.log(`No bounty found for PR: ${prUrl}`);
        return;
    }
    switch (action) {
        case 'closed':
            if (pull_request.merged) {
                try {
                    // First, update the database status
                    await (0, firestore_1.updateBountyStatus)(bounty.id, 'completed', {
                        mergedAt: pull_request.merged_at,
                        mergeCommitSha: pull_request.merge_commit_sha
                    });
                    console.log(`PR merged, updated bounty ${bounty.id} status to 'completed' in Firestore`);
                    // Get the full bounty details to get blockchain data
                    const fullBounty = await (0, firestore_1.getBounty)(bounty.id);
                    if (!fullBounty) {
                        throw new Error(`Could not find full bounty details for ID: ${bounty.id}`);
                    }
                    // Check if this bounty has blockchain data
                    const bountyData = fullBounty;
                    if (bountyData.solanaTxId && bountyData.claimedBy) {
                        console.log(`Completing bounty ${bounty.id} on the blockchain...`);
                        // If we have the bounty account, use it, otherwise we'll have to look it up
                        try {
                            // Call the smart contract to complete the bounty
                            // This assumes the claimedBy field contains the wallet address
                            const result = await (0, solana_1.completeBounty)(bountyData.solanaTxId, // This should be the bounty account public key
                            bountyData.claimedBy // This should be the claimer's wallet address
                            );
                            // Update the bounty with blockchain transaction data
                            await (0, firestore_1.updateBountyStatus)(bounty.id, 'completed', {
                                mergedAt: pull_request.merged_at,
                                mergeCommitSha: pull_request.merge_commit_sha,
                                completionTxHash: result.signature,
                                completedOnChain: true
                            });
                            console.log(`Successfully completed bounty ${bounty.id} on blockchain with tx: ${result.signature}`);
                        }
                        catch (error) {
                            console.error(`Error completing bounty ${bounty.id} on blockchain:`, error);
                            // Log detailed error for investigation
                            if (error instanceof Error) {
                                console.error('Error details:', error.message, error.stack);
                            }
                        }
                    }
                    else {
                        console.log(`Bounty ${bounty.id} doesn't have blockchain data, skipping on-chain completion`);
                        console.log(`Available data: ${JSON.stringify({
                            hasTxId: !!bountyData.solanaTxId,
                            hasClaimedBy: !!bountyData.claimedBy,
                            bountyData: Object.keys(bountyData)
                        })}`);
                    }
                }
                catch (error) {
                    console.error(`Error completing bounty ${bounty.id} on blockchain:`, error);
                    // The database update already happened, so we log the error but don't throw
                    // This allows the webhook to still return success to GitHub
                }
            }
            else {
                // PR was closed without merging
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'open', {
                    closedAt: pull_request.closed_at,
                    closeReason: 'pr_closed_without_merge'
                });
                console.log(`PR closed without merge, reset bounty ${bounty.id} status to 'open'`);
            }
            break;
        case 'reopened':
            // PR was reopened, update bounty status if needed
            if (bounty.status === 'completed' || bounty.status === 'cancelled') {
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'in_progress');
                console.log(`PR reopened, updated bounty ${bounty.id} status to 'in_progress'`);
            }
            break;
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
            console.log(`Found issue reference in PR body: #${issueNumber}`);
        }
    }
    // Also check PR title for issue references
    if (!issueNumber) {
        const titleRefs = pullRequest.title.match(/#(\d+)/);
        if (titleRefs && titleRefs[1]) {
            issueNumber = parseInt(titleRefs[1], 10);
            console.log(`Found issue reference in PR title: #${issueNumber}`);
        }
    }
    // Store the GitHub username from the PR for later verification
    const githubUsername = pullRequest.user.login;
    console.log(`PR created by GitHub user: ${githubUsername}`);
    // If we found an issue number, construct the issue URL
    if (issueNumber) {
        const repoFullName = repository.full_name;
        const issueUrl = `https://github.com/${repoFullName}/issues/${issueNumber}`;
        console.log(`Looking for bounty with issue URL: ${issueUrl}`);
        // Try to find a bounty by issue URL
        const bounty = await (0, firestore_1.getBountyByIssueUrl)(issueUrl);
        if (bounty) {
            console.log(`Found bounty ${bounty.id} for issue #${issueNumber}`);
            // Update the bounty with PR information and the GitHub username
            await (0, firestore_1.updateBountyWithPR)(bounty.id, pullRequest.html_url, githubUsername);
            await (0, firestore_1.updateBountyStatus)(bounty.id, 'in_progress', {
                prSubmittedAt: new Date().toISOString(),
                prNumber: pullRequest.number,
                githubUsername: githubUsername
            });
            console.log(`Updated bounty ${bounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
            return;
        }
    }
    // Strategy 2: If no issue found, try to match by repository URL
    const repoUrl = repository.html_url;
    console.log(`No issue match found. Checking for bounties in repository: ${repoUrl}`);
    // Get all bounties associated with this repository
    const repoBounties = await (0, firestore_1.getBountyByRepo)(repoUrl);
    if (repoBounties && repoBounties.length > 0) {
        console.log(`Found ${repoBounties.length} bounties in this repository`);
        // For now, just use the first open bounty in the repo (could be enhanced with more logic)
        const openBounty = repoBounties.find(b => b.status === 'open');
        if (openBounty) {
            console.log(`Found open bounty ${openBounty.id} in repository`);
            // Update the bounty with PR information and the GitHub username
            await (0, firestore_1.updateBountyWithPR)(openBounty.id, pullRequest.html_url, githubUsername);
            await (0, firestore_1.updateBountyStatus)(openBounty.id, 'in_progress', {
                prSubmittedAt: new Date().toISOString(),
                prNumber: pullRequest.number,
                githubUsername: githubUsername
            });
            console.log(`Updated bounty ${openBounty.id} with PR ${pullRequest.html_url} and status 'in_progress'`);
            return;
        }
        else {
            console.log('No open bounties found in this repository');
        }
    }
    else {
        console.log('No bounties found for this repository');
    }
    console.log(`Could not associate PR ${pullRequest.html_url} with any bounty`);
}
async function handlePullRequestReviewEvent(payload) {
    const { action, review, pull_request } = payload;
    const prUrl = pull_request.html_url;
    // Get bounty associated with this PR
    const bounty = await (0, firestore_1.getBountyByPR)(prUrl);
    if (!bounty) {
        console.log('No bounty found for PR:', prUrl);
        return;
    }
    if (action === 'submitted') {
        switch (review.state) {
            case 'approved':
                // PR was approved, update bounty status
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'approved', {
                    approvedAt: review.submitted_at,
                    approvedBy: review.user.login
                });
                break;
            case 'changes_requested':
                // Changes requested, update bounty status
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'changes_requested', {
                    reviewedAt: review.submitted_at,
                    reviewedBy: review.user.login
                });
                break;
        }
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
    console.log('Test endpoint hit, headers:', JSON.stringify(request.headers));
    response.status(200).json({
        message: 'Webhook test endpoint working correctly',
        timestamp: new Date().toISOString(),
        headers: request.headers
    });
});
//# sourceMappingURL=github-webhooks.js.map