'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { TransactionHistory } from '@/components/payment/TransactionHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PaymentsPage() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to initialize
    if (user !== undefined) {
      setIsLoading(false);
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-700" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-2xl font-bold mb-4">Sign In Required</h1>
        <p className="text-gray-600 mb-4">You need to be signed in to view your payment history.</p>
        <a
          href="/login"
          className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
        >
          Sign In
        </a>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Payment History</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionHistory userId={user.uid} />
        </CardContent>
      </Card>
    </div>
  );
} 