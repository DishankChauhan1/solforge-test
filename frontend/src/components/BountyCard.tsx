import Link from 'next/link';
import { IBounty } from '@/types/bounty';
import { formatCurrency } from '@/lib/utils';

interface BountyCardProps {
  bounty: IBounty;
}

export function BountyCard({ bounty }: BountyCardProps) {
  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
              ${bounty.status === 'open' ? 'bg-green-100 text-green-700' :
                bounty.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                'bg-gray-100 text-gray-700'}`}>
              {bounty.status.charAt(0).toUpperCase() + bounty.status.slice(1).replace('_', ' ')}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatCurrency(bounty.amount)} {bounty.currency}
          </div>
        </div>
        <h3 className="mt-4 text-lg font-semibold">
          <Link href={`/bounty/${bounty.id}`} className="hover:underline">
            {bounty.title}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
          {bounty.description}
        </p>
        <div className="mt-4 flex items-center space-x-4 text-sm text-muted-foreground">
          <Link href={bounty.repositoryUrl} className="hover:underline" target="_blank" rel="noopener noreferrer">
            View Repository
          </Link>
          <Link href={bounty.issueUrl} className="hover:underline" target="_blank" rel="noopener noreferrer">
            View Issue
          </Link>
        </div>
      </div>
    </div>
  );
} 