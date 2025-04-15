import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { PaymentStatus, PaymentStatusType } from './PaymentStatus';

interface Transaction {
  id: string;
  bountyId: string;
  bountyTitle: string;
  amount: number;
  currency: string;
  status: PaymentStatusType;
  transactionSignature?: string;
  attempt?: number;
  createdAt: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
}

interface TransactionHistoryProps {
  userId: string;
}

export const TransactionHistory: React.FC<TransactionHistoryProps> = ({ userId }) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/payments/history?userId=${userId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        
        const data = await response.json();
        setTransactions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching transactions:', err);
      } finally {
        setIsLoading(false);
      }
    };

    if (userId) {
      fetchTransactions();
    }
  }, [userId]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 text-red-700 rounded-md">
        <p>Error: {error}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="p-8 text-center border border-gray-200 rounded-md bg-gray-50">
        <p className="text-gray-600">No transaction history found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Transaction History</h3>
      
      {transactions.map((transaction) => (
        <Card key={transaction.id} className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold">
              Bounty: {transaction.bountyTitle}
            </CardTitle>
            <p className="text-sm text-gray-500">
              {new Date(transaction.createdAt).toLocaleString()}
            </p>
          </CardHeader>
          
          <CardContent>
            <div className="flex flex-col md:flex-row md:justify-between gap-4">
              <div>
                <p className="font-medium">Transaction Details</p>
                <p className="text-sm mt-1">
                  <span className="text-gray-500">ID:</span> {transaction.id.substring(0, 8)}...
                </p>
                <p className="text-sm mt-1">
                  <span className="text-gray-500">Bounty ID:</span> {transaction.bountyId.substring(0, 8)}...
                </p>
                <p className="text-sm mt-1">
                  <span className="text-gray-500">Amount:</span> {transaction.amount} {transaction.currency}
                </p>
              </div>
              
              <div className="grow">
                <PaymentStatus 
                  status={transaction.status}
                  transactionSignature={transaction.transactionSignature}
                  completedAt={transaction.completedAt}
                  failedAt={transaction.failedAt}
                  errorMessage={transaction.errorMessage}
                  attempt={transaction.attempt}
                  amount={transaction.amount}
                  currency={transaction.currency}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}; 