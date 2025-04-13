import { DashboardTabs } from '@/components/DashboardTabs';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/firebase';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // In a real app, you would check the server-side session here
  // Since we're using client-side auth, we'll redirect to a client-side page
  // that will then check the auth state
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
              Dashboard
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">
              Manage your bounties and submissions
            </p>
          </div>
          <DashboardTabs />
          <div className="bg-white shadow-sm ring-1 ring-gray-900/5 sm:rounded-xl">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
} 