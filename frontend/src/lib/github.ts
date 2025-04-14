import { IGithubProfile } from '@/types/user';

const GITHUB_API_URL = 'https://api.github.com';

export async function getUserProfile(username: string): Promise<IGithubProfile | null> {
  try {
    const response = await fetch(`${GITHUB_API_URL}/users/${username}`);
    if (!response.ok) {
      throw new Error('Failed to fetch GitHub profile');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub profile:', error);
    return null;
  }
}

export async function getRepoDetails(owner: string, repo: string) {
  try {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}`);
    if (!response.ok) {
      throw new Error('Failed to fetch repository details');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching repository details:', error);
    return null;
  }
}

export async function getPullRequest(owner: string, repo: string, prNumber: number) {
  try {
    const response = await fetch(`${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}`);
    if (!response.ok) {
      throw new Error('Failed to fetch pull request');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching pull request:', error);
    return null;
  }
}

export function parseGitHubUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== 'github.com') {
      throw new Error('Not a GitHub URL');
    }
    
    const [, owner, repo, type, number] = parsedUrl.pathname.split('/');
    
    return {
      owner,
      repo,
      type, // 'issues' or 'pull'
      number: number ? parseInt(number) : undefined,
    };
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
}

// Mock function for development that returns a placeholder GitHub profile
// This should be replaced with actual API call in production
export const getUserProfileMock = async (githubId?: string) => {
  console.log('Getting GitHub profile for:', githubId);
  
  // Return mock data for development
  return {
    login: 'github-user',
    avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    name: 'GitHub User',
    bio: 'Open source enthusiast',
    public_repos: 10,
    followers: 100,
    following: 50,
  };
};

interface GitHubIssue {
  url: string;
  repository_url: string;
  html_url: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
}

interface ValidationResult {
  isValid: boolean;
  issue?: GitHubIssue;
  error?: string;
}

export async function validateAndFetchIssue(issueUrl: string): Promise<ValidationResult> {
  try {
    // Validate URL format
    const url = new URL(issueUrl);
    if (!url.hostname.includes('github.com')) {
      return { isValid: false, error: 'Not a valid GitHub URL' };
    }

    // Extract owner, repo, and issue number from URL
    const parts = url.pathname.split('/');
    if (parts.length < 5 || parts[3] !== 'issues') {
      return { isValid: false, error: 'Not a valid GitHub issue URL' };
    }

    const [, owner, repo, , issueNumber] = parts;
    if (!owner || !repo || !issueNumber || isNaN(Number(issueNumber))) {
      return { isValid: false, error: 'Invalid GitHub issue URL format' };
    }

    // Fetch issue details from GitHub API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        // Add GitHub token if available
        ...(process.env.NEXT_PUBLIC_GITHUB_TOKEN && {
          'Authorization': `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
        })
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { isValid: false, error: 'GitHub issue not found' };
      }
      if (response.status === 403) {
        return { isValid: false, error: 'Rate limit exceeded. Please try again later.' };
      }
      return { isValid: false, error: 'Failed to fetch issue details' };
    }

    const issue = await response.json();

    // Validate issue state
    if (issue.state !== 'open') {
      return { isValid: false, error: 'Only open issues can be used for bounties' };
    }

    return { isValid: true, issue };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('URL')) {
        return { isValid: false, error: 'Invalid URL format' };
      }
      return { isValid: false, error: error.message };
    }
    return { isValid: false, error: 'An unexpected error occurred' };
  }
}

interface PullRequestDetails {
  url: string;
  html_url: string;
  number: number;
  state: string;
  title: string;
  body: string | null;
  user: {
    login: string;
    avatar_url: string;
  };
  merged: boolean;
  mergeable: boolean | null;
  merged_at: string | null;
  head: {
    sha: string;
    ref: string;
    repo: {
      full_name: string;
    };
  };
  base: {
    sha: string;
    ref: string;
    repo: {
      full_name: string;
    };
  };
}

interface PRValidationResult {
  isValid: boolean;
  pullRequest?: PullRequestDetails;
  error?: string;
}

export async function validateAndFetchPullRequest(prUrl: string): Promise<PRValidationResult> {
  try {
    // Validate URL format
    const url = new URL(prUrl);
    if (!url.hostname.includes('github.com')) {
      return { isValid: false, error: 'Not a valid GitHub URL' };
    }

    // Extract owner, repo, and PR number from URL
    const parts = url.pathname.split('/');
    if (parts.length < 5 || parts[3] !== 'pull') {
      return { isValid: false, error: 'Not a valid GitHub pull request URL' };
    }

    const [, owner, repo, , prNumber] = parts;
    if (!owner || !repo || !prNumber || isNaN(Number(prNumber))) {
      return { isValid: false, error: 'Invalid GitHub pull request URL format' };
    }

    // Fetch PR details from GitHub API
    const apiUrl = `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}`;
    const response = await fetch(apiUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        ...(process.env.NEXT_PUBLIC_GITHUB_TOKEN && {
          'Authorization': `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
        })
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        return { isValid: false, error: 'Pull request not found' };
      }
      if (response.status === 403) {
        return { isValid: false, error: 'Rate limit exceeded. Please try again later.' };
      }
      return { isValid: false, error: 'Failed to fetch pull request details' };
    }

    const pullRequest = await response.json();
    return { isValid: true, pullRequest };
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TypeError' && error.message.includes('URL')) {
        return { isValid: false, error: 'Invalid URL format' };
      }
      return { isValid: false, error: error.message };
    }
    return { isValid: false, error: 'An unexpected error occurred' };
  }
}

interface PRClaimValidation {
  canClaim: boolean;
  error?: string;
  pullRequest?: PullRequestDetails;
}

export async function validatePRForClaim(prUrl: string, issueUrl: string): Promise<PRClaimValidation> {
  try {
    // First validate the PR
    const prValidation = await validateAndFetchPullRequest(prUrl);
    if (!prValidation.isValid || !prValidation.pullRequest) {
      return { canClaim: false, error: prValidation.error };
    }

    const pr = prValidation.pullRequest;

    // Check if PR is merged
    if (!pr.merged) {
      return { 
        canClaim: false, 
        error: 'Pull request must be merged to claim the bounty',
        pullRequest: pr
      };
    }

    // Parse issue URL to get owner/repo/number
    const issueUrlParts = new URL(issueUrl).pathname.split('/');
    const [, issueOwner, issueRepo, , issueNumber] = issueUrlParts;

    // Verify PR and issue are in the same repository
    if (pr.base.repo.full_name !== `${issueOwner}/${issueRepo}`) {
      return {
        canClaim: false,
        error: 'Pull request must be in the same repository as the issue',
        pullRequest: pr
      };
    }

    // Fetch issue to verify it's referenced in the PR
    const issueResponse = await fetch(
      `${GITHUB_API_URL}/repos/${issueOwner}/${issueRepo}/issues/${issueNumber}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.NEXT_PUBLIC_GITHUB_TOKEN && {
            'Authorization': `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
          })
        }
      }
    );

    if (!issueResponse.ok) {
      return {
        canClaim: false,
        error: 'Failed to verify issue reference',
        pullRequest: pr
      };
    }

    // Check if PR body references the issue
    const issueRef = `#${issueNumber}`;
    if (!pr.body?.includes(issueRef)) {
      return {
        canClaim: false,
        error: 'Pull request must reference the bounty issue',
        pullRequest: pr
      };
    }

    return {
      canClaim: true,
      pullRequest: pr
    };
  } catch (error) {
    return {
      canClaim: false,
      error: error instanceof Error ? error.message : 'Failed to validate pull request'
    };
  }
}

export async function checkPRMergeStatus(owner: string, repo: string, prNumber: number): Promise<{
  merged: boolean;
  mergeable: boolean | null;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${GITHUB_API_URL}/repos/${owner}/${repo}/pulls/${prNumber}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          ...(process.env.NEXT_PUBLIC_GITHUB_TOKEN && {
            'Authorization': `token ${process.env.NEXT_PUBLIC_GITHUB_TOKEN}`
          })
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch PR merge status');
    }

    const pr = await response.json();
    return {
      merged: pr.merged,
      mergeable: pr.mergeable
    };
  } catch (error) {
    return {
      merged: false,
      mergeable: null,
      error: error instanceof Error ? error.message : 'Failed to check merge status'
    };
  }
}