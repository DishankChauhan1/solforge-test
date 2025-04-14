'use client';

import { useEffect, useState } from 'react';
import { getAllBountiesFunction } from '@/lib/firebase';
import { IBounty } from '@/types/bounty';
import { BountyCard } from '@/components/bounty/BountyCard';

export default function AvailableBounties() {
  const [bounties, setBounties] = useState<IBounty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBounties() {
      try {
        const getAllBounties = getAllBountiesFunction();
        const { data } = await getAllBounties();
        setBounties(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Error fetching bounties:', error);
        setBounties([]);
      } finally {
        setLoading(false);
      }
    }

    fetchBounties();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700"></div>
      </div>
    );
  }

  if (bounties.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">No open bounties</h3>
        <p className="mt-2 text-sm text-gray-500">Check back later for new opportunities!</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {bounties.map((bounty) => (
          <BountyCard key={bounty.id} bounty={bounty} />
        ))}
      </div>
    </div>
  );
} 