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
import { verifyPR, createBountyHandler, claimBountyHandler, getAllBounties, getBountyById } from './routes/bounties';
import * as path from 'path';
import { githubWebhookHandler, webhookTest } from './routes/github-webhooks';

// Set global options for all functions
setGlobalOptions({
  maxInstances: 10,
});

// Initialize Firebase Admin with service account
try {
  // Try to load the service account file
  const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
  });
} catch (error) {
  // Fallback to application default credentials
  console.log('Failed to load service account, using application default credentials');
  admin.initializeApp();
}

// Export the Cloud Functions
export {
  verifyPR,
  createBountyHandler,
  claimBountyHandler,
  getAllBounties,
  getBountyById,
  githubWebhookHandler,
  webhookTest
};

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
