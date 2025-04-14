'use client';

import { CreatorBountyManager } from '@/components/dashboard/CreatorBountyManager';

export default function MyBountiesPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Bounties</h1>
      <CreatorBountyManager />
    </div>
  );
} 