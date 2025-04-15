import React from 'react';

export type PaymentStatusType = 'pending' | 'processing' | 'completed' | 'failed';

interface PaymentStatusProps {
  status?: PaymentStatusType;
  transactionSignature?: string;
  completedAt?: string;
  failedAt?: string;
  errorMessage?: string;
  attempt?: number;
  amount?: number;
  currency?: string;
}

export const PaymentStatus: React.FC<PaymentStatusProps> = ({
  status,
  transactionSignature,
  completedAt,
  failedAt,
  errorMessage,
  attempt = 1,
  amount,
  currency = 'SOL'
}) => {
  if (!status) return null;
  
  const getStatusColor = () => {
    switch(status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const getStatusIcon = () => {
    switch(status) {
      case 'completed': 
        return (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
          </svg>
        );
      case 'processing': 
        return (
          <svg className="w-4 h-4 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        );
      case 'pending': 
        return (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
      case 'failed': 
        return (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
          </svg>
        );
      default: 
        return (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
        );
    }
  };

  const getStatusMessage = () => {
    switch(status) {
      case 'completed':
        return 'Payment has been processed successfully';
      case 'processing':
        return 'Payment is currently being processed';
      case 'pending':
        return attempt > 1 
          ? `Payment is pending (Attempt ${attempt}/${3})` 
          : 'Payment is pending processing';
      case 'failed':
        return errorMessage || 'Payment processing failed';
      default:
        return 'No payment information available';
    }
  };
  
  return (
    <div className="mt-4 p-4 border border-gray-200 rounded-md bg-gray-50">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-gray-700">Payment Status:</span>
          <span className={`px-2 py-1 rounded-md inline-flex items-center text-xs font-semibold ${getStatusColor()}`}>
            {getStatusIcon()} {status.toUpperCase()}
          </span>
        </div>

        {amount && (
          <p className="text-sm">
            Amount: <strong>{amount} {currency}</strong>
          </p>
        )}
        
        <p className={`text-sm ${status === 'failed' ? 'text-red-600' : 'text-gray-600'}`}>
          {getStatusMessage()}
        </p>
        
        {transactionSignature && (
          <div className="mt-1">
            <p className="text-sm">
              Transaction: 
              <a 
                href={`https://explorer.solana.com/tx/${transactionSignature}${process.env.REACT_APP_SOLANA_NETWORK === 'devnet' ? '?cluster=devnet' : ''}`} 
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-blue-600 hover:text-blue-800"
              >
                {transactionSignature.substring(0, 8)}...{transactionSignature.substring(transactionSignature.length - 8)}
                <svg className="w-3 h-3 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                </svg>
              </a>
            </p>
          </div>
        )}
        
        {completedAt && (
          <p className="text-sm mt-1">Completed: {new Date(completedAt).toLocaleString()}</p>
        )}
        
        {failedAt && (
          <p className="text-sm mt-1">Failed: {new Date(failedAt).toLocaleString()}</p>
        )}
        
        {status === 'failed' && errorMessage && (
          <div className="group relative">
            <p className="text-sm text-red-600 mt-1 cursor-help">
              Error: {errorMessage.length > 50 ? `${errorMessage.substring(0, 50)}...` : errorMessage}
            </p>
            <div className="hidden group-hover:block absolute z-10 p-2 bg-gray-800 text-white text-xs rounded shadow-lg max-w-xs">
              {errorMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 