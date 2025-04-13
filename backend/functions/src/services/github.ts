import { Octokit } from '@octokit/rest';
import * as functions from "firebase-functions";

const octokit = new Octokit({
  auth: functions.config().github.token,
});

interface PRDetails {
  owner: string;
  repo: string;
  pull_number: number;
}

export const extractPRDetails = (prUrl: string): PRDetails | null => {
  try {
    const url = new URL(prUrl);
    const [, owner, repo, , pull_number] = url.pathname.split('/');
    return {
      owner,
      repo,
      pull_number: parseInt(pull_number),
    };
  } catch (error) {
    console.error('Error parsing PR URL:', error);
    return null;
  }
};

export const verifyPullRequest = async (
  prUrl: string,
  expectedAuthor: string
): Promise<{ isValid: boolean; error?: string }> => {
  const prDetails = extractPRDetails(prUrl);
  
  if (!prDetails) {
    return { isValid: false, error: 'Invalid PR URL format' };
  }

  try {
    const { data: pr } = await octokit.pulls.get({
      ...prDetails,
    });

    // Check if PR is merged
    if (!pr.merged) {
      return { isValid: false, error: 'Pull request is not merged' };
    }

    // Check if author matches
    if (pr.user?.login.toLowerCase() !== expectedAuthor.toLowerCase()) {
      return { isValid: false, error: 'Pull request author does not match' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error verifying PR:', error);
    return { isValid: false, error: 'Error verifying pull request' };
  }
};

export const getGithubUsername = async (
  githubToken: string
): Promise<string> => {
  try {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Invalid GitHub token"
      );
    }

    const user = await response.json();
    return user.login;
  } catch (error) {
    console.error("Error fetching GitHub username:", error);
    throw error;
  }
}; 