import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { listenForPaymentEvents } from '../../services/bounty';

// Notification types
export type NotificationType = 'success' | 'error' | 'info' | 'warning';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
}

interface NotificationContextValue {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
}

// Create the notification context
const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

// Custom hook to use the notification context
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

// Single notification component
export const PaymentNotification: React.FC<Notification & { onClose: () => void }> = ({
  type,
  title,
  message,
  onClose
}) => {
  const getAlertStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-100 border-green-500 text-green-700';
      case 'error':
        return 'bg-red-100 border-red-500 text-red-700';
      case 'info':
        return 'bg-blue-100 border-blue-500 text-blue-700';
      case 'warning':
        return 'bg-yellow-100 border-yellow-500 text-yellow-700';
      default:
        return 'bg-gray-100 border-gray-500 text-gray-700';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
          </svg>
        );
      case 'error':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        );
      case 'info':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-1 9a1 1 0 01-1-1v-4a1 1 0 112 0v4a1 1 0 01-1 1z" clipRule="evenodd"></path>
          </svg>
        );
      case 'warning':
        return (
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`p-4 mb-4 border-l-4 rounded-md relative ${getAlertStyles()}`}>
      <div className="flex">
        <div className="flex-shrink-0 mr-3">{getIcon()}</div>
        <div className="flex-1">
          <h3 className="text-sm font-medium">{title}</h3>
          <div className="text-sm mt-1">{message}</div>
        </div>
        <button
          type="button"
          className="ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 focus:outline-none focus:ring-2 focus:ring-gray-300"
          onClick={onClose}
          aria-label="Close"
        >
          <span className="sr-only">Close</span>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};

// Notification provider component
export const NotificationProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Add notification
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-remove notification after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
    
    return id;
  }, []);
  
  // Remove notification
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  }, []);
  
  // Listen for payment events (if user is logged in)
  useEffect(() => {
    const userId = localStorage.getItem('userId'); // Replace with your auth method
    if (!userId) return;
    
    const unsubscribe = listenForPaymentEvents(userId, (event) => {
      if (event.type === 'payment_completed') {
        addNotification({
          type: 'success',
          title: 'Payment Received!',
          message: `You received ${event.amount} ${event.currency} for bounty: ${event.bountyTitle}`
        });
      } else if (event.type === 'payment_failed') {
        addNotification({
          type: 'error',
          title: 'Payment Failed',
          message: `Payment for bounty "${event.bountyTitle}" failed: ${event.error}`
        });
      } else if (event.type === 'payment_processing') {
        addNotification({
          type: 'info',
          title: 'Payment Processing',
          message: `Your payment for "${event.bountyTitle}" is being processed.`
        });
      }
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [addNotification]);
  
  return (
    <NotificationContext.Provider value={{ notifications, addNotification, removeNotification }}>
      {children}
      
      {/* Notification container */}
      <div 
        className="fixed bottom-4 right-4 z-50 w-full max-w-md"
      >
        <div className="space-y-2">
          {notifications.map(notification => (
            <PaymentNotification
              key={notification.id}
              {...notification}
              onClose={() => removeNotification(notification.id)}
            />
          ))}
        </div>
      </div>
    </NotificationContext.Provider>
  );
}; 