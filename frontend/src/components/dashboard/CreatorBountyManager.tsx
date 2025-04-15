'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { IBounty, BountyStatus } from '@/types/bounty';
import { getBounties, updateBountyStatus } from '@/lib/firebase';
import { BountyCard } from '@/components/bounty/BountyCard';

type BountyFilter = 'all' | 'open' | 'in_progress' | 'completed' | 'cancelled';
type SortOption = 'newest' | 'oldest' | 'amount_high' | 'amount_low';

export function CreatorBountyManager() {
  const { user } = useAuth();
  const [bounties, setBounties] = useState<IBounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BountyFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.uid) {
      fetchBounties();
    }
  }, [user]);

  const fetchBounties = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const userBounties = await getBounties();
      // Filter just the bounties created by this user
      setBounties(userBounties.filter(b => b.creatorId === user.uid));
    } catch (error) {
      console.error('Error fetching bounties:', error);
      setError('Failed to load your bounties');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort bounties
  const filteredBounties = bounties
    .filter(bounty => filter === 'all' || bounty.status === filter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.createdAt.seconds - a.createdAt.seconds;
        case 'oldest':
          return a.createdAt.seconds - b.createdAt.seconds;
        case 'amount_high':
          return b.amount - a.amount;
        case 'amount_low':
          return a.amount - b.amount;
        default:
          return 0;
      }
    });

  const handleStatusChange = async (bountyId: string, newStatus: string) => {
    try {
      // Cast the string to BountyStatus type
      const typedStatus = newStatus as BountyStatus;
      await updateBountyStatus(bountyId, typedStatus);
      setBounties(bounties.map(b => 
        b.id === bountyId ? { ...b, status: typedStatus } : b
      ));
    } catch (err) {
      setError('Failed to update bounty status');
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as BountyFilter)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="amount_high">Highest Amount</option>
            <option value="amount_low">Lowest Amount</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {filteredBounties.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No bounties found
          </div>
        ) : (
          filteredBounties.map(bounty => (
            <div key={bounty.id} className="relative">
              <BountyCard bounty={bounty} />
              <div className="absolute top-4 right-4">
                <select
                  value={bounty.status}
                  onChange={(e) => handleStatusChange(bounty.id, e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm bg-white"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
} 