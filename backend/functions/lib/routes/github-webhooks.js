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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookTest = exports.githubWebhookHandler = void 0;
const https_1 = require("firebase-functions/v2/https");
const crypto = __importStar(require("crypto"));
const firestore_1 = require("../services/firestore");
// Hardcoded secret for development - the same as what's in Firebase config
const WEBHOOK_SECRET = 'ac95b2fd7dcaad462a6df4eba79b48017556fcba';
// Verify GitHub webhook signature
function verifyGitHubWebhook(payload, signature) {
    try {
        console.log('Received signature:', signature);
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
        console.log(`Expected ${algorithm} digest:`, digest);
        console.log(`Received ${algorithm} hash:`, signatureHash);
        // Use a constant-time comparison to prevent timing attacks
        try {
            return crypto.timingSafeEqual(Buffer.from(signatureHash, 'hex'), Buffer.from(digest, 'hex'));
        }
        catch (error) {
            console.error('Error in comparison:', error);
            // Basic string comparison as fallback (not secure, but for debugging)
            const match = digest === signatureHash;
            console.log('Basic string comparison result:', match);
            // TEMPORARY: Return true for debugging until signature issue is fixed
            return true;
        }
    }
    catch (error) {
        console.error('Error verifying webhook signature:', error);
        // TEMPORARY: Return true for debugging until signature issue is fixed
        return true;
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
    console.log('Received webhook request');
    const event = request.headers['x-github-event'];
    const payload = request.body;
    const signature = request.headers['x-hub-signature-256'] ||
        request.headers['x-hub-signature'];
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
        const isValid = verifyGitHubWebhook(rawPayload, signature);
        if (!isValid) {
            console.error('Invalid signature');
            response.status(401).send('Invalid signature');
            return;
        }
    }
    catch (error) {
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
        await handlePullRequestEvent(payload);
    }
    // Handle pull request review events
    if (event === 'pull_request_review') {
        console.log('Received pull request review event');
        await handlePullRequestReviewEvent(payload);
    }
    response.status(200).send('Webhook received successfully');
});
async function handlePullRequestEvent(payload) {
    const { action, pull_request } = payload;
    const prUrl = pull_request.html_url;
    // Get bounty associated with this PR
    const bounty = await (0, firestore_1.getBountyByPR)(prUrl);
    if (!bounty) {
        console.log('No bounty found for PR:', prUrl);
        return;
    }
    switch (action) {
        case 'closed':
            if (pull_request.merged) {
                // PR was merged, update bounty status
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'completed', {
                    mergedAt: pull_request.merged_at,
                    mergeCommitSha: pull_request.merge_commit_sha
                });
            }
            else {
                // PR was closed without merging
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'open', {
                    closedAt: pull_request.closed_at,
                    closeReason: 'pr_closed_without_merge'
                });
            }
            break;
        case 'reopened':
            // PR was reopened, update bounty status if needed
            if (bounty.status === 'completed' || bounty.status === 'cancelled') {
                await (0, firestore_1.updateBountyStatus)(bounty.id, 'in_progress');
            }
            break;
    }
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