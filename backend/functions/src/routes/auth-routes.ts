import { onRequest } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import { getFirestore } from 'firebase-admin/firestore';
import type { Request, Response } from 'express';

// GitHub OAuth configuration from Firebase config
const GITHUB_CLIENT_ID = functions.config().github.client_id || process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = functions.config().github.client_secret || process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URL = functions.config().github.redirect_url || 'https://solforge-main.web.app/auth/github/callback';

// Initialize Firestore if not already initialized
const db = getFirestore();

/**
 * Initiates GitHub OAuth flow
 * 
 * This function generates a state parameter for CSRF protection and redirects to GitHub's OAuth page
 */
export const githubOAuthInitiate = onRequest(async (req: Request, res: Response) => {
  try {
    logger.info('Starting GitHub OAuth flow');
    
    // Generate a random state parameter to prevent CSRF attacks
    const state = crypto.randomBytes(20).toString('hex');
    const userId = req.query.userId as string;
    
    if (!userId) {
      logger.error('No userId provided for OAuth flow');
      res.status(400).send('User ID is required');
      return;
    }
    
    // Store state in Firestore for verification during the callback
    await db.collection('oauthStates').doc(state).set({
      userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiration
      )
    });
    
    // Construct GitHub authorization URL
    const githubAuthUrl = new URL('https://github.com/login/oauth/authorize');
    githubAuthUrl.searchParams.append('client_id', GITHUB_CLIENT_ID);
    githubAuthUrl.searchParams.append('redirect_uri', REDIRECT_URL);
    githubAuthUrl.searchParams.append('state', state);
    githubAuthUrl.searchParams.append('scope', 'user:email,repo');
    
    logger.info(`Redirecting to GitHub with state: ${state}`);
    
    // Redirect user to GitHub OAuth page
    res.redirect(githubAuthUrl.toString());
  } catch (error) {
    logger.error('Error initiating GitHub OAuth flow:', error);
    res.status(500).send('Error starting GitHub authorization');
  }
});

/**
 * Handles the callback from GitHub OAuth
 * 
 * This function verifies the state parameter, exchanges the code for an access token,
 * and stores the token in Firestore for future use.
 */
export const githubOAuthCallback = onRequest(async (req: Request, res: Response) => {
  try {
    logger.info('Received GitHub OAuth callback');
    
    const { code, state } = req.query as { code: string; state: string };
    
    if (!code || !state) {
      logger.error('Missing code or state parameters');
      res.status(400).send('Invalid request: Missing parameters');
      return;
    }
    
    // Verify the state to prevent CSRF attacks
    const stateDoc = await db.collection('oauthStates').doc(state).get();
    
    if (!stateDoc.exists) {
      logger.error(`Invalid state parameter: ${state}`);
      res.status(400).send('Invalid state parameter');
      return;
    }
    
    const stateData = stateDoc.data();
    if (!stateData) {
      logger.error('State document exists but has no data');
      res.status(500).send('Error retrieving state data');
      return;
    }
    
    // Check if the state is expired
    if (stateData.expiresAt.toDate() < new Date()) {
      logger.error('OAuth state has expired');
      await db.collection('oauthStates').doc(state).delete();
      res.status(400).send('Authorization request has expired. Please try again.');
      return;
    }
    
    const userId = stateData.userId;
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URL
      })
    });
    
    if (!tokenResponse.ok) {
      logger.error('Failed to exchange code for token', tokenResponse.statusText);
      res.status(500).send('Failed to obtain access token');
      return;
    }
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      logger.error('GitHub token exchange error:', tokenData.error);
      res.status(400).send(`Error: ${tokenData.error_description || tokenData.error}`);
      return;
    }
    
    const { access_token, refresh_token, expires_in, scope } = tokenData;
    
    // Get user info from GitHub API
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${access_token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!userResponse.ok) {
      logger.error('Failed to fetch GitHub user info');
      res.status(500).send('Failed to fetch user information');
      return;
    }
    
    const githubUser = await userResponse.json();
    
    // Store tokens in Firestore
    await db.collection('users').doc(userId).collection('providers').doc('github').set({
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: refresh_token ? null : admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + expires_in * 1000)
      ),
      scope,
      githubId: githubUser.id,
      username: githubUser.login,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Update user profile with GitHub info
    await db.collection('users').doc(userId).set({
      githubConnected: true,
      githubUsername: githubUser.login,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Delete the state document
    await db.collection('oauthStates').doc(state).delete();
    
    // Redirect to success page
    res.redirect(`/auth/success?provider=github&username=${githubUser.login}`);
  } catch (error) {
    logger.error('Error handling GitHub OAuth callback:', error);
    res.status(500).send('Error processing GitHub authorization');
  }
});

/**
 * Refreshes a GitHub access token using a refresh token
 */
export const refreshGithubToken = onRequest(async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    
    // Get the current GitHub token info
    const githubDoc = await db.collection('users').doc(userId).collection('providers').doc('github').get();
    
    if (!githubDoc.exists) {
      res.status(404).json({ error: 'No GitHub token found for this user' });
      return;
    }
    
    const githubData = githubDoc.data();
    if (!githubData || !githubData.refreshToken) {
      res.status(400).json({ error: 'No refresh token available' });
      return;
    }
    
    // Exchange refresh token for a new access token
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        refresh_token: githubData.refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!tokenResponse.ok) {
      logger.error('Failed to refresh token', tokenResponse.statusText);
      res.status(500).json({ error: 'Failed to refresh token' });
      return;
    }
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      logger.error('GitHub token refresh error:', tokenData.error);
      res.status(400).json({ error: tokenData.error_description || tokenData.error });
      return;
    }
    
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // Update stored tokens
    await db.collection('users').doc(userId).collection('providers').doc('github').update({
      accessToken: access_token,
      refreshToken: refresh_token || githubData.refreshToken, // Keep old refresh token if not provided
      expiresAt: expires_in ? admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + expires_in * 1000)
      ) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error refreshing GitHub token:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

/**
 * Handles revoking GitHub access and removing tokens
 */
export const revokeGithubAccess = onRequest(async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      res.status(400).json({ error: 'User ID is required' });
      return;
    }
    
    // Get the GitHub token
    const githubDoc = await db.collection('users').doc(userId).collection('providers').doc('github').get();
    
    if (githubDoc.exists) {
      const githubData = githubDoc.data();
      if (githubData && githubData.accessToken) {
        // Revoke the token with GitHub
        await fetch(`https://api.github.com/applications/${GITHUB_CLIENT_ID}/token`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Basic ${Buffer.from(`${GITHUB_CLIENT_ID}:${GITHUB_CLIENT_SECRET}`).toString('base64')}`,
            'Accept': 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({ access_token: githubData.accessToken })
        });
      }
      
      // Delete the token from Firestore
      await db.collection('users').doc(userId).collection('providers').doc('github').delete();
      
      // Update user profile
      await db.collection('users').doc(userId).update({
        githubConnected: false,
        githubUsername: admin.firestore.FieldValue.delete()
      });
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error revoking GitHub access:', error);
    res.status(500).json({ error: 'Failed to revoke GitHub access' });
  }
});

/**
 * Gets GitHub token from user's providers collection
 */
export async function getGithubToken(userId: string): Promise<string | null> {
  try {
    const githubDoc = await db.collection('users').doc(userId).collection('providers').doc('github').get();
    
    if (!githubDoc.exists) {
      logger.warn(`No GitHub token found for user ${userId}`);
      return null;
    }
    
    const githubData = githubDoc.data();
    if (!githubData || !githubData.accessToken) {
      logger.warn(`Invalid GitHub token data for user ${userId}`);
      return null;
    }
    
    // Check if token is expired and needs refresh
    if (githubData.expiresAt && githubData.expiresAt.toDate() < new Date()) {
      if (githubData.refreshToken) {
        logger.info(`Refreshing expired GitHub token for user ${userId}`);
        try {
          const refreshed = await refreshTokenInternal(userId, githubData.refreshToken);
          if (refreshed) {
            const updatedDoc = await db.collection('users').doc(userId).collection('providers').doc('github').get();
            const updatedData = updatedDoc.data();
            return updatedData?.accessToken || null;
          }
        } catch (error) {
          logger.error(`Failed to refresh GitHub token for user ${userId}:`, error);
          return null;
        }
      } else {
        logger.warn(`GitHub token expired for user ${userId} but no refresh token available`);
        return null;
      }
    }
    
    return githubData.accessToken;
  } catch (error) {
    logger.error(`Error getting GitHub token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Internal function to refresh tokens
 */
async function refreshTokenInternal(userId: string, refreshToken: string): Promise<boolean> {
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });
    
    if (!tokenResponse.ok) {
      logger.error('Failed to refresh token in internal function', tokenResponse.statusText);
      return false;
    }
    
    const tokenData = await tokenResponse.json();
    
    if (tokenData.error) {
      logger.error('GitHub token refresh error in internal function:', tokenData.error);
      return false;
    }
    
    const { access_token, refresh_token, expires_in } = tokenData;
    
    // Update stored tokens
    await db.collection('users').doc(userId).collection('providers').doc('github').update({
      accessToken: access_token,
      refreshToken: refresh_token || refreshToken, // Keep old refresh token if not provided
      expiresAt: expires_in ? admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + expires_in * 1000)
      ) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return true;
  } catch (error) {
    logger.error('Error in refreshTokenInternal:', error);
    return false;
  }
} 