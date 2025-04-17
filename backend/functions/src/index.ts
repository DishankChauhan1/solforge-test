/**
 * SolForge Bounty Platform Backend - Firebase Cloud Functions
 * This file serves as the main entry point for all cloud functions and API routes.
 */

import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { verifyPR, createBountyHandler, createBountyHandlerV2, claimBountyHandler, getAllBounties, getBountyById, submitClaimHandler, getBountySubmissionsHandler, approveSubmissionHandler, rejectSubmissionHandler, cancelBountyHandler, extendDeadlineHandler } from './routes/bounties';
import { githubWebhookHandler, webhookTest } from './routes/github-webhooks';
import * as functions from 'firebase-functions';
import express from 'express';
import cors from 'cors';
import * as bountyRoutes from './routes/bounty-routes';
import * as userRoutes from './routes/user-routes';
import { getUserSubmissions } from './cloud-functions/user-functions';

// Import GitHub app related modules safely with fallbacks for robustness
let githubAppWebhookHandler: any;
let githubAppWebhookTest: any;
let validateGitHubRepository: any;
let verifyPullRequestForBounty: any;
let githubOAuthInitiate: any;
let githubOAuthCallback: any;
let refreshGithubToken: any;
let revokeGithubAccess: any;

try {
  // Try to import GitHub app related modules
  const githubAppWebhooks = require('./routes/github-app-webhooks');
  const repositoryValidation = require('./routes/repository-validation');
  const authRoutes = require('./routes/auth-routes');
  
  // Assign imported functions if available
  githubAppWebhookHandler = githubAppWebhooks.githubAppWebhookHandler;
  githubAppWebhookTest = githubAppWebhooks.githubAppWebhookTest;
  validateGitHubRepository = repositoryValidation.validateGitHubRepository;
  verifyPullRequestForBounty = repositoryValidation.verifyPullRequestForBounty;
  githubOAuthInitiate = authRoutes.githubOAuthInitiate;
  githubOAuthCallback = authRoutes.githubOAuthCallback;
  refreshGithubToken = authRoutes.refreshGithubToken;
  revokeGithubAccess = authRoutes.revokeGithubAccess;
  
  logger.info("GitHub app integrations loaded successfully");
} catch (error) {
  // Create mock implementations for functions that couldn't be imported
  // This ensures the application can run even if GitHub integration is unavailable
  logger.warn("Error loading GitHub app integrations:", error);
  logger.warn("Using mock implementations for GitHub app functions");
  
  // Mock implementations for GitHub app functions
  githubAppWebhookHandler = (req: any, res: any) => res.status(503).send('GitHub app integration not available');
  githubAppWebhookTest = (req: any, res: any) => res.status(200).json({ status: 'mock', message: 'Mock endpoint' });
  validateGitHubRepository = (data: any) => ({ valid: false, error: 'GitHub app integration not available' });
  verifyPullRequestForBounty = (data: any) => ({ valid: false, error: 'GitHub app integration not available' });
  githubOAuthInitiate = (req: any, res: any) => res.status(503).send('GitHub OAuth not available');
  githubOAuthCallback = (req: any, res: any) => res.status(503).send('GitHub OAuth not available');
  refreshGithubToken = (req: any, res: any) => res.status(503).json({ error: 'GitHub OAuth not available' });
  revokeGithubAccess = (req: any, res: any) => res.status(503).json({ error: 'GitHub OAuth not available' });
}

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
});

// Initialize Firebase Admin if it hasn't been initialized already
if (!admin.apps.length) {
  admin.initializeApp();
}

// Set up Express app for REST API
const app = express();
app.use(cors({ origin: true }));

// Add API routes
app.use('/bounties', bountyRoutes.default);
app.use('/user', userRoutes.default);

// Export REST API as an HTTP function
export const api = functions.https.onRequest(app);

// Export individual Cloud Functions
// Legacy functions (maintained for backward compatibility)
export {
  // Bounty management
  verifyPR,
  createBountyHandler,
  createBountyHandlerV2,
  claimBountyHandler,
  getAllBounties,
  getBountyById,
  submitClaimHandler,
  getBountySubmissionsHandler,
  approveSubmissionHandler,
  rejectSubmissionHandler,
  cancelBountyHandler,
  extendDeadlineHandler,
  
  // GitHub webhook handling
  githubWebhookHandler,
  webhookTest,
  
  // User data management
  getUserSubmissions
};

// New GitHub App integration
export {
  // GitHub App webhook handlers
  githubAppWebhookHandler,
  githubAppWebhookTest,
  
  // Repository validation functions
  validateGitHubRepository,
  verifyPullRequestForBounty,
  
  // OAuth flow handlers
  githubOAuthInitiate,
  githubOAuthCallback,
  refreshGithubToken,
  revokeGithubAccess
};

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

