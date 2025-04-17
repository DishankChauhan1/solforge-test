import React, { useEffect, useState } from 'react';
import { functions } from '../../firebase/config';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';

interface Repository {
  id: number;
  name: string;
  fullName: string;
  description: string;
  url: string;
  stars: number;
  forks: number;
  language: string;
  isForked: boolean;
  updatedAt: string;
}

interface PullRequest {
  id: number;
  title: string;
  url: string;
  createdAt: string;
  merged: boolean;
  repositoryName: string;
}

interface GitHubContributions {
  repositories: Repository[];
  pullRequests: PullRequest[];
  commitCount: number;
  publicRepos: number;
  followers: number;
  following: number;
  profileUrl: string;
  avatar: string;
  bio?: string;
  company?: string;
  location?: string;
  error?: string;
  username?: string;
}

const GitHubContributions: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contributions, setContributions] = useState<GitHubContributions | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const fetchContributions = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch from our API
        const response = await fetch('/api/user/github-contributions', {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch GitHub contributions');
        }
        
        const data = await response.json();
        if (data.success && data.contributions) {
          setContributions(data.contributions);
        } else {
          setError(data.error || 'Failed to load GitHub data');
        }
      } catch (err) {
        console.error('Error fetching GitHub contributions:', err);
        setError('Failed to load GitHub contributions');
      } finally {
        setLoading(false);
      }
    };
    
    fetchContributions();
  }, [user]);

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading GitHub contributions...</span>
        </div>
      </div>
    );
  }

  if (error || !contributions) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="text-red-500">
          <h3 className="font-medium">Unable to load GitHub contributions</h3>
          <p className="text-sm">{error || 'Please check your GitHub connection'}</p>
          {contributions?.username && (
            <a 
              href={contributions.profileUrl || `https://github.com/${contributions.username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-block text-blue-500 hover:underline"
            >
              View GitHub Profile
            </a>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-5 sm:px-6">
        <div className="flex items-center">
          <img
            src={contributions.avatar}
            alt="GitHub Avatar"
            className="h-10 w-10 rounded-full mr-4"
          />
          <div>
            <h3 className="text-lg font-medium text-gray-900">GitHub Contributions</h3>
            <p className="text-sm text-gray-500">
              <a 
                href={contributions.profileUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                View Profile
              </a>
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 py-5 sm:p-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Repositories</p>
            <p className="text-xl font-semibold">{contributions.publicRepos}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Commits</p>
            <p className="text-xl font-semibold">{contributions.commitCount}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Followers</p>
            <p className="text-xl font-semibold">{contributions.followers}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-500">Following</p>
            <p className="text-xl font-semibold">{contributions.following}</p>
          </div>
        </div>

        {/* Repositories */}
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Top Repositories</h4>
          {contributions.repositories.length === 0 ? (
            <p className="text-gray-500">No repositories found</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {contributions.repositories.map(repo => (
                <li key={repo.id} className="py-3">
                  <a 
                    href={repo.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block hover:bg-gray-50 transition"
                  >
                    <div className="flex justify-between">
                      <p className="font-medium text-blue-600">{repo.name}</p>
                      <div className="flex space-x-3 text-sm text-gray-500">
                        <span>⭐ {repo.stars}</span>
                        <span>🍴 {repo.forks}</span>
                      </div>
                    </div>
                    {repo.description && (
                      <p className="text-gray-600 text-sm mt-1 line-clamp-2">{repo.description}</p>
                    )}
                    <div className="mt-1 flex items-center text-sm">
                      {repo.language && (
                        <span className="text-gray-500 mr-3">
                          <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>
                          {repo.language}
                        </span>
                      )}
                      {repo.isForked && <span className="text-gray-400 text-xs">Forked</span>}
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pull Requests */}
        <div>
          <h4 className="text-lg font-medium text-gray-900 mb-3">Recent Pull Requests</h4>
          {contributions.pullRequests.length === 0 ? (
            <p className="text-gray-500">No pull requests found</p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {contributions.pullRequests.map(pr => (
                <li key={pr.id} className="py-3">
                  <a 
                    href={pr.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center">
                      <span 
                        className={`mr-2 flex-shrink-0 inline-block h-2 w-2 rounded-full ${
                          pr.merged ? 'bg-purple-500' : 'bg-green-500'
                        }`}
                      ></span>
                      <p className="font-medium text-gray-900 truncate">{pr.title}</p>
                    </div>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <span className="truncate">{pr.repositoryName}</span>
                      <span className="mx-1">•</span>
                      <span>{new Date(pr.createdAt).toLocaleDateString()}</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default GitHubContributions; 