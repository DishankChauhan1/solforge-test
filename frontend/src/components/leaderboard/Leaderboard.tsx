import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface LeaderboardUser {
  position: number;
  userId: string;
  displayName: string;
  githubUsername?: string;
  avatarUrl?: string;
  stats: {
    totalEarned: number;
    completedBounties: number;
  };
  badges: string[];
}

const Leaderboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);
        
        // Fetch from our API
        const response = await fetch('/api/user/leaderboard?limit=10');
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data');
        }
        
        const data = await response.json();
        if (data.success) {
          setLeaderboard(data.leaderboard || []);
        } else {
          setError(data.error || 'Failed to load leaderboard');
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    };
    
    fetchLeaderboard();
  }, []);

  // Function to format currency values
  const formatCurrency = (amount: number) => {
    return `${amount.toLocaleString()} SOL`;
  };

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center justify-center py-10">
          <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="text-red-500 text-center py-8">
          <h3 className="font-medium text-lg">Unable to load leaderboard</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div className="p-6 bg-white rounded-lg shadow text-center">
        <h3 className="font-medium text-gray-700 text-lg mb-2">Leaderboard is Empty</h3>
        <p className="text-gray-500">Be the first to complete a bounty and get on the leaderboard!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">Top Contributors</h3>
        <p className="mt-1 text-sm text-gray-500">
          The leading contributors based on completed bounties and earnings
        </p>
      </div>

      <div className="divide-y divide-gray-200">
        {leaderboard.map((user) => (
          <div 
            key={user.userId} 
            className={`p-4 flex items-center justify-between ${
              user.position <= 3 ? 'bg-yellow-50' : ''
            }`}
          >
            <div className="flex items-center space-x-4">
              {/* Position */}
              <div className={`flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-white font-bold ${
                user.position === 1 ? 'bg-yellow-500' :
                user.position === 2 ? 'bg-gray-400' :
                user.position === 3 ? 'bg-yellow-700' : 'bg-gray-300'
              }`}>
                {user.position}
              </div>
              
              {/* Avatar */}
              <div className="flex-shrink-0">
                {user.avatarUrl ? (
                  <img
                    className="h-10 w-10 rounded-full"
                    src={user.avatarUrl}
                    alt={user.displayName}
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-800">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              
              {/* User info */}
              <div>
                <h4 className="font-medium text-gray-900">
                  {user.displayName}
                  {user.githubUsername && (
                    <a 
                      href={`https://github.com/${user.githubUsername}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-sm text-gray-500 hover:text-gray-700"
                    >
                      @{user.githubUsername}
                    </a>
                  )}
                </h4>
                <div className="flex items-center text-sm text-gray-500 mt-1">
                  <span className="mr-3">
                    {user.stats.completedBounties} bounties
                  </span>
                  <span>
                    {formatCurrency(user.stats.totalEarned)}
                  </span>
                </div>
              </div>
            </div>
            
            {/* Badges */}
            {user.badges && user.badges.length > 0 && (
              <div className="flex-shrink-0 flex space-x-1">
                {user.badges.includes('first_bounty') && (
                  <span className="inline-block" title="First Bounty">🏆</span>
                )}
                {user.badges.includes('five_bounties') && (
                  <span className="inline-block" title="Five Bounties">⭐</span>
                )}
                {user.badges.includes('ten_bounties') && (
                  <span className="inline-block" title="Ten Bounties">🌟</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard; 