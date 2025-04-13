/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import * as admin from 'firebase-admin';
import { verifyPR, createBountyHandler, claimBountyHandler, getAllBounties, getBountyById } from './routes/bounties';
import * as path from 'path';

// Initialize Firebase Admin with service account
const serviceAccountPath = path.join(__dirname, '..', 'service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccountPath),
});

// Export the Cloud Functions
export {
  verifyPR,
  createBountyHandler,
  claimBountyHandler,
  getAllBounties,
  getBountyById
};

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// export const helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
