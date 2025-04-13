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