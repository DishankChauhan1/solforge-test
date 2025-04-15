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
import { verifyPR, createBountyHandler, createBountyHandlerV2, claimBountyHandler, getAllBounties, getBountyById } from './routes/bounties';
import { githubWebhookHandler, webhookTest } from './routes/github-webhooks';
import { githubAppWebhookHandler, githubAppWebhookTest } from './routes/github-app-webhooks';
import { validateGitHubRepository, verifyPullRequestForBounty } from './routes/repository-validation';
import { githubOAuthInitiate, githubOAuthCallback, refreshGithubToken, revokeGithubAccess } from './routes/auth-routes';


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
