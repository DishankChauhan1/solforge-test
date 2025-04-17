import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Add an interface for the auth context
interface AuthContext {
  auth?: {
    uid: string;
    token: any;
  };
}

// Define a submission interface
interface Submission {
  id: string;
  bountyId?: string;
  userId?: string;
  pullRequestUrl?: string;
  status?: string;
  createdAt?: any;
  bountyTitle?: string;
  bountyAmount?: number;
  bountyTokenMint?: string;
  [key: string]: any;
}

/**
 * Cloud Function to get the authenticated user's submissions
 * This is exported as a callable function for direct use from the client
 */
export const getUserSubmissions = functions.https.onCall(async (data, context) => {
  // Type assertion to make TypeScript happy
  const authContext = context as unknown as AuthContext;
  
  // Ensure the user is authenticated
  if (!authContext.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }
  
  try {
    const userId = authContext.auth.uid;
    const db = admin.firestore();
    
    // Get all submissions for the user
    const submissionsSnapshot = await db.collection('submissions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    if (submissionsSnapshot.empty) {
      return { success: true, submissions: [] };
    }
    
    // Process submissions and include bounty data
    const submissions = await Promise.all(submissionsSnapshot.docs.map(async (doc) => {
      const submission: Submission = { id: doc.id, ...doc.data() };
      
      // Get the bounty details for each submission
      if (submission.bountyId) {
        const bountyDoc = await db.collection('bounties').doc(submission.bountyId).get();
        if (bountyDoc.exists) {
          const bountyData = bountyDoc.data() || {};
          submission.bountyTitle = bountyData.title;
          submission.bountyAmount = bountyData.amount;
          submission.bountyTokenMint = bountyData.tokenMint;
        }
      }
      
      return submission;
    }));
    
    return { success: true, submissions };
  } catch (error) {
    console.error('Error getting user submissions:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to retrieve submissions'
    );
  }
}); 