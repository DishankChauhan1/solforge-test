import { logger } from 'firebase-functions';
import * as functions from 'firebase-functions';
// import { App } from '@octokit/app';
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
// import * as fs from 'fs';
// import * as path from 'path';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin if it hasn't been initialized already
if (!admin.apps.length) {
  admin.initializeApp();
}

// Get Firestore instance
const db = admin.firestore();

// GitHub App configuration from environment variables
const GITHUB_APP_ID = functions.config().github.app_id || process.env.GITHUB_APP_ID;
// const GITHUB_APP_CLIENT_ID = functions.config().github.app_client_id || process.env.GITHUB_APP_CLIENT_ID;
// const GITHUB_APP_CLIENT_SECRET = functions.config().github.app_client_secret || process.env.GITHUB_APP_CLIENT_SECRET;
const GITHUB_APP_PRIVATE_KEY = functions.config().github.app_private_key || process.env.GITHUB_APP_PRIVATE_KEY;
// const GITHUB_APP_WEBHOOK_SECRET = functions.config().github.app_webhook_secret || process.env.GITHUB_APP_WEBHOOK_SECRET;

// Initialize GitHub App
// let githubApp: App;
let appOctokit: Octokit;

// Function to initialize the GitHub App
export const initializeGitHubApp = () => {
  if (!GITHUB_APP_PRIVATE_KEY) {
    logger.warn('GitHub App private key not found, skipping GitHub App initialization');
    return null;
  }
  
  try {
    // Format the private key if needed
    const privateKey = GITHUB_APP_PRIVATE_KEY;
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');
    
    // Initialize Octokit with app authentication
    appOctokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: GITHUB_APP_ID,
        privateKey: formattedPrivateKey,
      },
    });
    
    logger.info(`GitHub App initialized successfully with ID: ${GITHUB_APP_ID}`);
    return appOctokit;
  } catch (error) {
    logger.error('Failed to initialize GitHub App:', error);
    return null;
  }
};

/**
 * Create an installation access token for a specific GitHub repository
 */
export async function getInstallationToken(owner: string, repo: string): Promise<string | null> {
  try {
    logger.info(`Getting installation token for ${owner}/${repo}`);
    
    // Check if we have a cached token
    const tokenDoc = await db.collection('githubAppTokens').doc(`${owner}-${repo}`).get();
    
    if (tokenDoc.exists) {
      const tokenData = tokenDoc.data();
      
      // Check if token is still valid (with 5 minute buffer)
      if (tokenData && tokenData.expiresAt && tokenData.expiresAt.toDate() > new Date(Date.now() + 5 * 60 * 1000)) {
        logger.info(`Using cached installation token for ${owner}/${repo}`);
        return tokenData.token;
      }
    }
    
    // Find the installation ID for this repository
    const { data: installations } = await appOctokit.apps.listInstallations();
    
    // Look for an installation that has access to this repository
    for (const installation of installations) {
      try {
        // Check if this installation has access to the repository
        const { data: repos } = await appOctokit.apps.listReposAccessibleToInstallation({
          installation_id: installation.id,
          per_page: 100
        });
        
        const hasAccess = repos.repositories.some(repository => 
          repository.owner.login.toLowerCase() === owner.toLowerCase() && 
          repository.name.toLowerCase() === repo.toLowerCase()
        );
        
        if (hasAccess) {
          logger.info(`Found installation ${installation.id} for ${owner}/${repo}`);
          
          // Create an installation access token
          const { data: tokenData } = await appOctokit.apps.createInstallationAccessToken({
            installation_id: installation.id
          });
          
          // Cache the token in Firestore
          await db.collection('githubAppTokens').doc(`${owner}-${repo}`).set({
            token: tokenData.token,
            installationId: installation.id,
            expiresAt: admin.firestore.Timestamp.fromDate(new Date(tokenData.expires_at)),
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
          
          logger.info(`Created installation token for ${owner}/${repo}`);
          return tokenData.token;
        }
      } catch (installError) {
        logger.error(`Error checking installation ${installation.id} for ${owner}/${repo}:`, installError);
        continue;
      }
    }
    
    logger.warn(`No installation found for ${owner}/${repo}`);
    return null;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting installation token for ${owner}/${repo}:`, errorMessage);
    return null;
  }
}

/**
 * Get an authenticated Octokit instance for a specific repository using our GitHub App
 */
export async function getOctokitForRepo(owner: string, repo: string): Promise<Octokit | null> {
  try {
    const token = await getInstallationToken(owner, repo);
    
    if (!token) {
      logger.warn(`Could not get installation token for ${owner}/${repo}`);
      return null;
    }
    
    return new Octokit({ auth: token });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error creating Octokit for ${owner}/${repo}:`, errorMessage);
    return null;
  }
}

/**
 * Validate a GitHub repository using our GitHub App
 * This checks if the repository exists and if our app has access to it
 */
export async function validateRepository(repoUrl: string): Promise<{
  isValid: boolean;
  owner?: string;
  repo?: string;
  error?: string;
}> {
  try {
    // Parse GitHub URL
    const url = new URL(repoUrl);
    if (!url.hostname.includes('github.com')) {
      return { isValid: false, error: 'Not a valid GitHub URL' };
    }
    
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return { isValid: false, error: 'Invalid GitHub repository URL format' };
    }
    
    const owner = parts[0];
    const repo = parts[1];
    
    // Check if our GitHub App has access to this repository
    const octokit = await getOctokitForRepo(owner, repo);
    
    if (!octokit) {
      return {
        isValid: false,
        owner,
        repo,
        error: 'GitHub App does not have access to this repository. Please install the app on this repository.'
      };
    }
    
    // Try to get repository info to confirm it exists and we have access
    try {
      await octokit.repos.get({ owner, repo });
      
      // Successfully fetched repo, it's valid
      return {
        isValid: true,
        owner,
        repo
      };
    } catch (repoError) {
      const typedError = repoError as { status?: number };
      if (typedError.status === 404) {
        return {
          isValid: false,
          owner,
          repo,
          error: 'Repository not found'
        };
      }
      
      return {
        isValid: false,
        owner,
        repo,
        error: 'Error validating repository access'
      };
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error validating repository:', errorMessage);
    return { isValid: false, error: 'Invalid repository URL' };
  }
}

/**
 * Get information about a GitHub issue
 */
export async function getIssueInfo(owner: string, repo: string, issueNumber: number) {
  try {
    const octokit = await getOctokitForRepo(owner, repo);
    
    if (!octokit) {
      return { error: 'GitHub App does not have access to this repository' };
    }
    
    const { data: issue } = await octokit.issues.get({
      owner,
      repo,
      issue_number: issueNumber
    });
    
    return { issue };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting issue ${owner}/${repo}#${issueNumber}:`, errorMessage);
    return { error: 'Error fetching issue information' };
  }
}

/**
 * Get information about a GitHub pull request
 */
export async function getPullRequestInfo(owner: string, repo: string, pullNumber: number) {
  try {
    const octokit = await getOctokitForRepo(owner, repo);
    
    if (!octokit) {
      return { error: 'GitHub App does not have access to this repository' };
    }
    
    const { data: pullRequest } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });
    
    return { pullRequest };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error getting PR ${owner}/${repo}#${pullNumber}:`, errorMessage);
    return { error: 'Error fetching pull request information' };
  }
}

/**
 * Check if a pull request references a specific issue
 */
export async function checkPRReferencesIssue(owner: string, repo: string, pullNumber: number, issueNumber: number): Promise<boolean> {
  try {
    const octokit = await getOctokitForRepo(owner, repo);
    
    if (!octokit) {
      logger.error(`GitHub App does not have access to ${owner}/${repo}`);
      return false;
    }
    
    // Get the pull request info
    const { data: pr } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber
    });
    
    // Check if PR body mentions the issue
    if (pr.body && pr.body.includes(`#${issueNumber}`)) {
      return true;
    }
    
    // Check if PR title mentions the issue
    if (pr.title && pr.title.includes(`#${issueNumber}`)) {
      return true;
    }
    
    // Check commit messages for issue references
    const { data: commits } = await octokit.pulls.listCommits({
      owner,
      repo,
      pull_number: pullNumber
    });
    
    for (const commit of commits) {
      if (commit.commit.message && commit.commit.message.includes(`#${issueNumber}`)) {
        return true;
      }
    }
    
    return false;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Error checking if PR ${owner}/${repo}#${pullNumber} references issue #${issueNumber}:`, errorMessage);
    return false;
  }
}

/**
 * Verify a pull request is valid for claiming a bounty
 */
export async function verifyPullRequestForBounty(
  prUrl: string, 
  issueUrl: string,
  expectedAuthor?: string
): Promise<{ 
  isValid: boolean; 
  error?: string;
  pullRequest?: any;
}> {
  try {
    // Parse GitHub PR URL
    const prUrlObj = new URL(prUrl);
    const prParts = prUrlObj.pathname.split('/');
    
    if (prParts.length < 5 || prParts[3] !== 'pull') {
      return { isValid: false, error: 'Invalid pull request URL format' };
    }
    
    const prOwner = prParts[1];
    const prRepo = prParts[2];
    const prNumber = parseInt(prParts[4]);
    
    if (isNaN(prNumber)) {
      return { isValid: false, error: 'Invalid pull request number' };
    }
    
    // Parse GitHub Issue URL
    const issueUrlObj = new URL(issueUrl);
    const issueParts = issueUrlObj.pathname.split('/');
    
    if (issueParts.length < 5 || issueParts[3] !== 'issues') {
      return { isValid: false, error: 'Invalid issue URL format' };
    }
    
    const issueOwner = issueParts[1];
    const issueRepo = issueParts[2];
    const issueNumber = parseInt(issueParts[4]);
    
    if (isNaN(issueNumber)) {
      return { isValid: false, error: 'Invalid issue number' };
    }
    
    // Verify repository access
    const octokit = await getOctokitForRepo(prOwner, prRepo);
    
    if (!octokit) {
      return { isValid: false, error: 'GitHub App does not have access to this repository' };
    }
    
    // Verify PR and issue are in the same repository
    if (prOwner !== issueOwner || prRepo !== issueRepo) {
      return { isValid: false, error: 'Pull request and issue must be in the same repository' };
    }
    
    // Get PR details
    const { data: pr } = await octokit.pulls.get({
      owner: prOwner,
      repo: prRepo,
      pull_number: prNumber
    });
    
    // Verify author if specified
    if (expectedAuthor && pr.user.login.toLowerCase() !== expectedAuthor.toLowerCase()) {
      return { 
        isValid: false, 
        error: 'Pull request author does not match expected author',
        pullRequest: pr
      };
    }
    
    // Verify PR is merged
    if (!pr.merged) {
      return { 
        isValid: false, 
        error: 'Pull request has not been merged yet',
        pullRequest: pr
      };
    }
    
    // Verify PR references the issue
    const referencesIssue = await checkPRReferencesIssue(prOwner, prRepo, prNumber, issueNumber);
    
    if (!referencesIssue) {
      return { 
        isValid: false, 
        error: 'Pull request does not reference the bounty issue',
        pullRequest: pr
      };
    }
    
    // All checks passed
    return {
      isValid: true,
      pullRequest: pr
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Error verifying pull request for bounty:', errorMessage);
    return { isValid: false, error: 'Error verifying pull request' };
  }
} 