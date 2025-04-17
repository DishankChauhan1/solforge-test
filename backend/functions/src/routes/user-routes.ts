import * as express from 'express';
import * as admin from 'firebase-admin';
import { validateFirebaseIdToken, AuthenticatedRequest } from '../middleware/auth';

const router = express.Router();

// Define a submission interface for better type checking
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
  [key: string]: any; // Allow for additional properties
}

// Define a user stats interface
interface UserStats {
  totalEarned: number;
  completedBounties: number;
  totalSubmissions: number;
  [key: string]: any; // Allow for additional properties
}

// Define a badge interface
interface Badge {
  id: string;
  name: string;
  description: string;
  awardedAt: string;
  [key: string]: any; // Allow for additional properties
}

// Protected routes - require authentication
router.use(validateFirebaseIdToken);

/**
 * Get the authenticated user's submissions
 */
router.get('/submissions', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    
    // Get all submissions for the user
    const submissionsSnapshot = await db.collection('submissions')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    if (submissionsSnapshot.empty) {
      return res.json({ success: true, submissions: [] });
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
    
    res.json({ success: true, submissions });
  } catch (error) {
    console.error('Error getting user submissions:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve submissions' });
  }
});

/**
 * Get the authenticated user's profile data
 */
router.get('/profile', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User profile not found' });
    }
    
    const userData = userDoc.data();
    
    // Don't return sensitive information like tokens
    const { githubAccessToken, githubRefreshToken, ...safeUserData } = userData || {};
    
    res.json({ success: true, profile: safeUserData });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve user profile' });
  }
});

/**
 * Get the top contributors leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const db = admin.firestore();
    const limit = parseInt(req.query.limit as string) || 10; // Default to top 10
    
    // Get users with stats, ordered by total earned
    const usersSnapshot = await db.collection('users')
      .where('stats.completedBounties', '>', 0) // Only include users who have completed bounties
      .orderBy('stats.completedBounties', 'desc')
      .orderBy('stats.totalEarned', 'desc')
      .limit(limit)
      .get();
    
    if (usersSnapshot.empty) {
      return res.json({ success: true, leaderboard: [] });
    }
    
    // Map user data to leaderboard entries
    const leaderboard = usersSnapshot.docs.map((doc, index) => {
      const userData = doc.data();
      const { githubAccessToken, githubRefreshToken, email, ...safeUserData } = userData;
      
      return {
        position: index + 1,
        userId: doc.id,
        displayName: userData.displayName || userData.username || 'Anonymous User',
        githubUsername: userData.githubUsername,
        avatarUrl: userData.avatarUrl,
        stats: userData.stats || { totalEarned: 0, completedBounties: 0 },
        badges: userData.badges || []
      };
    });
    
    res.json({ success: true, leaderboard });
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve leaderboard' });
  }
});

/**
 * Get the authenticated user's badges
 */
router.get('/badges', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    
    // Get the user's badges subcollection
    const badgesSnapshot = await db.collection('users').doc(userId)
      .collection('badges')
      .orderBy('awardedAt', 'desc')
      .get();
    
    const badges = badgesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json({ success: true, badges });
  } catch (error) {
    console.error('Error getting user badges:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve badges' });
  }
});

/**
 * Get GitHub contribution history for the authenticated user
 */
router.get('/github-contributions', async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user!.uid;
    const db = admin.firestore();
    
    // Get the user document to check for GitHub username
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const userData = userDoc.data() || {};
    
    if (!userData.githubUsername) {
      return res.status(400).json({ 
        success: false, 
        error: 'No GitHub username associated with this account' 
      });
    }

    const githubUsername = userData.githubUsername;
    
    // Check if we have cached GitHub data
    const githubDataDoc = await db.collection('users').doc(userId)
      .collection('github_data').doc('contributions').get();
    
    let contributions;
    const now = new Date();
    
    if (githubDataDoc.exists) {
      const data = githubDataDoc.data();
      const lastUpdated = data?.lastUpdated?.toDate() || new Date(0);
      const oneDay = 24 * 60 * 60 * 1000; // milliseconds in a day
      
      // If data is less than a day old, use cached data
      if ((now.getTime() - lastUpdated.getTime()) < oneDay) {
        contributions = data?.contributions || null;
      } else {
        // Data is stale, we'll fetch new data below
        contributions = null;
      }
    }
    
    // If we don't have valid cached data, fetch from GitHub API
    if (!contributions) {
      try {
        // Get access token if available (for higher rate limits)
        let accessToken = '';
        if (userData.githubAccessToken) {
          accessToken = userData.githubAccessToken;
        }
        
        // Fetch repositories
        const reposResponse = await fetchFromGitHub(
          `users/${githubUsername}/repos?sort=updated&per_page=100`,
          accessToken
        );
        
        // Fetch user data
        const userResponse = await fetchFromGitHub(
          `users/${githubUsername}`,
          accessToken
        );
        
        // Fetch contribution stats (last year of activity)
        const statsResponse = await fetchFromGitHub(
          `users/${githubUsername}/events?per_page=100`,
          accessToken
        );
        
        // Process repository data
        const repositories = reposResponse.data.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description,
          url: repo.html_url,
          stars: repo.stargazers_count,
          forks: repo.forks_count,
          language: repo.language,
          isForked: repo.fork,
          updatedAt: repo.updated_at
        }));
        
        // Extract pull requests from events
        const pullRequests = statsResponse.data
          .filter((event: any) => event.type === 'PullRequestEvent')
          .map((event: any) => ({
            id: event.payload.pull_request.id,
            title: event.payload.pull_request.title,
            url: event.payload.pull_request.html_url,
            createdAt: event.payload.pull_request.created_at,
            merged: event.payload.pull_request.merged,
            repositoryName: event.repo.name
          }));
        
        // Count commit events
        const commitCount = statsResponse.data
          .filter((event: any) => event.type === 'PushEvent')
          .reduce((count: number, event: any) => count + event.payload.size, 0);
        
        // Build contributions object
        contributions = {
          repositories: repositories.slice(0, 10), // Top 10 repos
          pullRequests: pullRequests.slice(0, 10), // Most recent 10 PRs
          commitCount,
          publicRepos: userResponse.data.public_repos,
          followers: userResponse.data.followers,
          following: userResponse.data.following,
          profileUrl: userResponse.data.html_url,
          avatar: userResponse.data.avatar_url,
          bio: userResponse.data.bio,
          company: userResponse.data.company,
          location: userResponse.data.location
        };
        
        // Cache the data
        await db.collection('users').doc(userId)
          .collection('github_data').doc('contributions').set({
            contributions,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });
        
      } catch (githubError) {
        console.error('Error fetching GitHub data:', githubError);
        
        // Return basic user data if API call fails but we have the user
        if (userData.githubUsername) {
          contributions = {
            error: 'Error fetching complete GitHub data',
            username: userData.githubUsername,
            profileUrl: `https://github.com/${userData.githubUsername}`,
            avatar: userData.avatarUrl || null
          };
        } else {
          throw new Error('Failed to fetch GitHub contribution data');
        }
      }
    }
    
    res.json({ success: true, contributions });
  } catch (error) {
    console.error('Error getting GitHub contributions:', error);
    res.status(500).json({ success: false, error: 'Failed to retrieve GitHub contributions' });
  }
});

/**
 * Helper function to fetch data from GitHub API
 */
async function fetchFromGitHub(endpoint: string, token?: string): Promise<any> {
  const options: any = {
    method: 'GET',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'SolForge-Bounty-Platform'
    }
  };
  
  // Add auth token if available
  if (token) {
    options.headers.Authorization = `token ${token}`;
  }
  
  const baseUrl = 'https://api.github.com/';
  const response = await fetch(`${baseUrl}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  return { data, headers: response.headers };
}

// Note: The getUserSubmissions cloud function has been moved to a separate file
// to avoid TypeScript typing issues. Import it from '../cloud-functions/user-functions'

export default router; 