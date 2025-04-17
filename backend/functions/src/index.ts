/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';
import { setGlobalOptions } from 'firebase-functions/v2';
import { logger } from 'firebase-functions';
import { verifyPR, createBountyHandler, createBountyHandlerV2, claimBountyHandler, getAllBounties, getBountyById } from './routes/bounties';
import { githubWebhookHandler, webhookTest } from './routes/github-webhooks';

// Import GitHub app related modules safely
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

// Export the Cloud Functions

// Legacy functions (maintained for backward compatibility)
export {
  verifyPR,
  createBountyHandler,
  createBountyHandlerV2,
  claimBountyHandler,
  getAllBounties,
  getBountyById,
  githubWebhookHandler,
  webhookTest
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
