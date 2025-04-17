import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

interface Badge {
  id: string;
  name: string;
  description: string;
  awardedAt: string;
}

const UserBadges: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const { user } = useAuth();

  useEffect(() => {
    const fetchBadges = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch from our API
        const response = await fetch('/api/user/badges', {
          headers: {
            'Authorization': `Bearer ${await user.getIdToken()}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch badges');
        }
        
        const data = await response.json();
        if (data.success) {
          setBadges(data.badges || []);
        } else {
          setError(data.error || 'Failed to load badges');
        }
      } catch (err) {
        console.error('Error fetching badges:', err);
        setError('Failed to load badges');
      } finally {
        setLoading(false);
      }
    };
    
    fetchBadges();
  }, [user]);

  // Badge icon mapping
  const getBadgeIcon = (badgeId: string) => {
    switch(badgeId) {
      case 'first_bounty':
        return '🏆';
      case 'five_bounties':
        return '⭐⭐⭐⭐⭐';
      case 'ten_bounties':
        return '🌟';
      default:
        return '🎖️';
    }
  };

  // Badge color mapping
  const getBadgeColor = (badgeId: string) => {
    switch(badgeId) {
      case 'first_bounty':
        return 'bg-blue-100 text-blue-800';
      case 'five_bounties':
        return 'bg-purple-100 text-purple-800';
      case 'ten_bounties':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Loading badges...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="text-red-500">
          <h3 className="font-medium">Unable to load badges</h3>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (badges.length === 0) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="text-center text-gray-500">
          <h3 className="font-medium">No Badges Yet</h3>
          <p className="text-sm mt-1">Complete bounties to earn achievement badges!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-5 sm:px-6">
        <h3 className="text-lg font-medium text-gray-900">Achievement Badges</h3>
        <p className="mt-1 text-sm text-gray-500">
          Badges earned for completing milestones
        </p>
      </div>

      <div className="px-4 py-5 sm:p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {badges.map(badge => (
            <div 
              key={badge.id} 
              className={`rounded-lg p-4 ${getBadgeColor(badge.id)}`}
            >
              <div className="flex items-center mb-2">
                <span className="text-2xl mr-2">{getBadgeIcon(badge.id)}</span>
                <h4 className="font-medium">{badge.name}</h4>
              </div>
              <p className="text-sm">{badge.description}</p>
              <p className="text-xs mt-2 opacity-75">
                Earned on {new Date(badge.awardedAt).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserBadges; 